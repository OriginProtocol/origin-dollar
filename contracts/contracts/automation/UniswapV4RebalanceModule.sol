// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IUniswapV4RebalanceModule } from "../interfaces/automation/IUniswapV4RebalanceModule.sol";
import { IPoolManager, IUnlockCallback, PoolKey } from "../interfaces/uniswap/v4/IPoolManager.sol";
import { IPositionManager } from "../interfaces/uniswap/v4/IPositionManager.sol";

/**
 * @title UniswapV4RebalanceModule
 * @notice Gnosis Safe module that lets an operator keep the Safe's Uniswap v4
 *         positions one-sided. Each position provides `currency0` (OUSD) just
 *         above the price, so it only buys `currency1` (USDe). `rebalance`
 *         pulls the position to the Safe, swaps the price back to the range
 *         bottom and puts `currency0` back, so what it bought cannot be bought
 *         back from the pool.
 *
 * @dev    All decisions (when, how much, which price limit) are made off-chain
 *         by the operator. The module only enforces guardrails, fixed at
 *         deployment:
 *         - it only touches Safe-owned positions in one hookless pool;
 *         - every token it moves ends up in the Safe;
 *         - adds can never deposit `currency1` and pull at most `maxAmount0`;
 *         - the reset swap sells at most `maxAmount0` of `currency0` and never
 *           pushes the price below `minSqrtPriceX96` (par for OUSD/USDe).
 *
 *         The Safe must enable this module and, once, approve OUSD to Permit2
 *         and Permit2 to the PositionManager, which pays the adds.
 */
contract UniswapV4RebalanceModule is AbstractSafeModule, IUnlockCallback {
    // v4-periphery `Actions` understood by the PositionManager.
    uint8 internal constant INCREASE_LIQUIDITY = 0x00;
    uint8 internal constant DECREASE_LIQUIDITY = 0x01;
    uint8 internal constant CLOSE_CURRENCY = 0x12;

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    /// @notice The only pool this module may touch.
    bytes32 public immutable poolId;
    /// @notice Lowest price the reset swap may reach.
    uint160 public immutable minSqrtPriceX96;
    /// @notice Cap on `currency0` per add and per reset swap.
    uint128 public immutable maxAmount0;

    constructor(
        address _safeContract,
        address _operator,
        address _poolManager,
        address _positionManager,
        PoolKey memory _poolKey,
        uint160 _minSqrtPriceX96,
        uint128 _maxAmount0
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        require(_poolKey.hooks == address(0), "Hooked pool");
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        poolId = keccak256(abi.encode(_poolKey));
        minSqrtPriceX96 = _minSqrtPriceX96;
        maxAmount0 = _maxAmount0;
        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Pull a position to the Safe, optionally reset the price and add
     *         `currency0` back.
     * @param _tokenId           Safe-owned position in the module's pool.
     * @param _liquidityToAdd    Liquidity to add after the pull; 0 to only pull.
     * @param _resetAmount0      Max `currency0` the reset swap sells; 0 for no
     *                           reset.
     * @param _sqrtPriceLimitX96 Price the reset swap stops at, normally the
     *                           range bottom.
     */
    function rebalance(
        uint256 _tokenId,
        uint128 _liquidityToAdd,
        uint128 _resetAmount0,
        uint160 _sqrtPriceLimitX96
    ) external onlyOperator {
        require(
            positionManager.ownerOf(_tokenId) == address(safeContract),
            "Not a Safe position"
        );
        (PoolKey memory key, ) = positionManager.getPoolAndPositionInfo(
            _tokenId
        );
        require(keccak256(abi.encode(key)) == poolId, "Wrong pool");

        uint128 liquidity = positionManager.getPositionLiquidity(_tokenId);
        if (liquidity > 0) {
            _modifyLiquidity(
                key,
                DECREASE_LIQUIDITY,
                abi.encode(_tokenId, liquidity, 0, 0, "")
            );
        }

        if (_resetAmount0 > 0) {
            require(_resetAmount0 <= maxAmount0, "Reset too large");
            require(
                _sqrtPriceLimitX96 >= minSqrtPriceX96,
                "Price limit below floor"
            );
            poolManager.unlock(
                abi.encode(key, _resetAmount0, _sqrtPriceLimitX96)
            );
        }

        if (_liquidityToAdd > 0) {
            // amount1Max = 0: the add can only deposit currency0.
            _modifyLiquidity(
                key,
                INCREASE_LIQUIDITY,
                abi.encode(_tokenId, _liquidityToAdd, maxAmount0, 0, "")
            );
        }

        emit IUniswapV4RebalanceModule.Rebalanced(
            _tokenId,
            liquidity,
            _resetAmount0,
            _liquidityToAdd
        );
    }

    /**
     * @notice Runs the reset swap. The PoolManager only calls back the address
     *         that called `unlock`, so this only runs inside `rebalance`. The
     *         Safe pays the pool and receives the output.
     */
    function unlockCallback(bytes calldata _data)
        external
        override
        returns (bytes memory)
    {
        require(msg.sender == address(poolManager), "Not the pool manager");
        (PoolKey memory key, uint128 amount0, uint160 sqrtPriceLimitX96) = abi
            .decode(_data, (PoolKey, uint128, uint160));

        int256 delta = poolManager.swap(
            key,
            IPoolManager.SwapParams(
                true,
                -int256(uint256(amount0)),
                sqrtPriceLimitX96
            ),
            ""
        );
        // Exact-in zeroForOne: owes currency0 (upper 128 bits, <= 0) and
        // receives currency1 (lower 128 bits, >= 0).
        uint256 paid = uint128(-int128(delta >> 128));
        uint256 received = uint128(int128(delta));

        if (paid > 0) {
            poolManager.sync(key.currency0);
            _exec(
                key.currency0,
                abi.encodeWithSelector(
                    IERC20.transfer.selector,
                    address(poolManager),
                    paid
                )
            );
            poolManager.settle();
        }
        if (received > 0) {
            poolManager.take(key.currency1, address(safeContract), received);
        }
        return "";
    }

    /// @dev One liquidity action, then CLOSE_CURRENCY on both currencies,
    ///      which settles or takes each full delta with the Safe.
    function _modifyLiquidity(
        PoolKey memory _key,
        uint8 _action,
        bytes memory _params
    ) internal {
        bytes[] memory params = new bytes[](3);
        params[0] = _params;
        params[1] = abi.encode(_key.currency0);
        params[2] = abi.encode(_key.currency1);
        _exec(
            address(positionManager),
            abi.encodeWithSelector(
                IPositionManager.modifyLiquidities.selector,
                abi.encode(
                    abi.encodePacked(_action, CLOSE_CURRENCY, CLOSE_CURRENCY),
                    params
                ),
                block.timestamp
            )
        );
    }

    function _exec(address _target, bytes memory _data) internal {
        require(
            safeContract.execTransactionFromModule(_target, 0, _data, 0),
            "Safe call failed"
        );
    }
}
