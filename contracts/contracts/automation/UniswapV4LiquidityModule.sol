// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IUniswapV4LiquidityModule } from "../interfaces/automation/IUniswapV4LiquidityModule.sol";
import { IPoolManager, IUnlockCallback, PoolKey } from "../interfaces/uniswap/v4/IPoolManager.sol";
import { IPositionManager } from "../interfaces/uniswap/v4/IPositionManager.sol";

/**
 * @title UniswapV4LiquidityModule
 * @notice Gnosis Safe module that lets an operator move the Safe's Uniswap v4
 *         liquidity: burn a Safe position, optionally swap the pool price to a
 *         new level, and mint a new position owned by the Safe.
 *
 * @dev    No pricing logic: the operator (Talos) picks the pool, range, size
 *         and reset, so a pricing change never needs a redeploy. The module
 *         only protects the Safe's funds:
 *         - hookless pools only, and only Safe-owned positions are burned;
 *         - every token it moves ends up in the Safe;
 *         - over a UTC day, the Safe's net outflow of each token through the
 *           module (summed per call) stays within `maxPerDay`, set by the
 *           Safe. A compromised operator loses at most that per day; the Safe
 *           can disable the module in one transaction.
 *
 *         The Safe must enable this module and, once per token it lets the
 *         module pay, approve the token to Permit2 and Permit2 to the
 *         PositionManager, which pays the mints.
 */
contract UniswapV4LiquidityModule is AbstractSafeModule, IUnlockCallback {
    // v4-periphery `Actions` understood by the PositionManager.
    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant BURN_POSITION = 0x03;
    uint8 internal constant CLOSE_CURRENCY = 0x12;

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;

    /// @notice Most net outflow of a token from the Safe per UTC day.
    mapping(address => uint256) public maxPerDay;
    /// @notice Net outflow of a token from the Safe, per UTC day
    ///         (`block.timestamp / 1 days`).
    mapping(uint256 => mapping(address => uint256)) public spentOn;

    constructor(
        address _safeContract,
        address _operator,
        address _poolManager,
        address _positionManager
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Burn a Safe position, optionally reset the pool price and mint
     *         a new Safe position, all in one hookless pool.
     * @return newTokenId The minted position, 0 if none.
     */
    function rebalance(IUniswapV4LiquidityModule.RebalanceParams calldata _p)
        external
        onlyOperator
        returns (uint256 newTokenId)
    {
        PoolKey memory key = _p.key;
        require(key.hooks == address(0), "Hooked pool");
        bytes32 id = keccak256(abi.encode(key));
        address safe = address(safeContract);
        uint256 before0 = IERC20(key.currency0).balanceOf(safe);
        uint256 before1 = IERC20(key.currency1).balanceOf(safe);

        if (_p.tokenId != 0) {
            require(
                positionManager.ownerOf(_p.tokenId) == safe,
                "Not a Safe position"
            );
            (PoolKey memory positionKey, ) = positionManager
                .getPoolAndPositionInfo(_p.tokenId);
            require(keccak256(abi.encode(positionKey)) == id, "Wrong pool");
            // amount0Min = amount1Min = 0: everything goes to the Safe.
            _modifyLiquidity(
                key,
                BURN_POSITION,
                abi.encode(_p.tokenId, uint128(0), uint128(0), "")
            );
        }

        if (_p.resetAmountIn > 0) {
            poolManager.unlock(
                abi.encode(
                    key,
                    _p.resetZeroForOne,
                    _p.resetAmountIn,
                    _p.sqrtPriceLimitX96
                )
            );
        }

        if (_p.liquidity > 0) {
            newTokenId = positionManager.nextTokenId();
            _modifyLiquidity(
                key,
                MINT_POSITION,
                abi.encode(
                    key,
                    _p.tickLower,
                    _p.tickUpper,
                    uint256(_p.liquidity),
                    _p.amount0Max,
                    _p.amount1Max,
                    safe,
                    ""
                )
            );
        }

        _trackOutflow(key.currency0, before0);
        _trackOutflow(key.currency1, before1);

        emit IUniswapV4LiquidityModule.Rebalanced(
            id,
            _p.tokenId,
            newTokenId,
            _p.tickLower,
            _p.tickUpper,
            _p.liquidity,
            _p.resetZeroForOne,
            _p.resetAmountIn
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
        (
            PoolKey memory key,
            bool zeroForOne,
            uint128 amountIn,
            uint160 sqrtPriceLimitX96
        ) = abi.decode(_data, (PoolKey, bool, uint128, uint160));

        int256 delta = poolManager.swap(
            key,
            IPoolManager.SwapParams(
                zeroForOne,
                -int256(uint256(amountIn)),
                sqrtPriceLimitX96
            ),
            ""
        );
        // amount0 in the upper 128 bits, amount1 in the lower 128 bits;
        // negative = owed by the Safe, positive = owed to the Safe.
        _settleOrTake(key.currency0, int128(delta >> 128));
        _settleOrTake(key.currency1, int128(delta));
        return "";
    }

    function setMaxPerDay(address _token, uint256 _amount) external onlySafe {
        maxPerDay[_token] = _amount;
        emit IUniswapV4LiquidityModule.MaxPerDaySet(_token, _amount);
    }

    /// @dev Adds the call's net outflow of `_token`, if any, to today's
    ///      total, which must stay within `maxPerDay`.
    function _trackOutflow(address _token, uint256 _before) internal {
        uint256 afterBalance = IERC20(_token).balanceOf(address(safeContract));
        if (afterBalance >= _before) return;
        uint256 day = block.timestamp / 1 days;
        uint256 spent = spentOn[day][_token] + _before - afterBalance;
        require(spent <= maxPerDay[_token], "Above max per day");
        spentOn[day][_token] = spent;
    }

    function _settleOrTake(address _currency, int128 _amount) internal {
        if (_amount < 0) {
            poolManager.sync(_currency);
            _exec(
                _currency,
                abi.encodeWithSelector(
                    IERC20.transfer.selector,
                    address(poolManager),
                    uint256(uint128(-_amount))
                )
            );
            poolManager.settle();
        } else if (_amount > 0) {
            poolManager.take(
                _currency,
                address(safeContract),
                uint256(uint128(_amount))
            );
        }
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
