// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IUniswapV4ERC4626RebalanceModule } from "../interfaces/automation/IUniswapV4ERC4626RebalanceModule.sol";
import { IPoolManager, IUnlockCallback, PoolKey } from "../interfaces/uniswap/v4/IPoolManager.sol";
import { IPositionManager } from "../interfaces/uniswap/v4/IPositionManager.sol";

interface IERC4626ConvertToShares {
    function convertToShares(uint256 assets) external view returns (uint256);
}

/**
 * @title UniswapV4ERC4626RebalanceModule
 * @notice Gnosis Safe module that lets an operator keep the Safe's Uniswap v4
 *         position on a `currency0`/ERC4626 pool (OUSD/sUSDe) one-sided and
 *         priced just below the vault's NAV. The NAV grows, so the range has
 *         to move with it: `rebalance` burns the position to the Safe, swaps
 *         the price back down to the new range bottom and mints `currency0`
 *         on the new range, owned by the Safe.
 *
 * @dev    Same design as `UniswapV4RebalanceModule`: every decision (when,
 *         which range, how much, which price limit) is made off-chain by the
 *         operator. The module only enforces guardrails:
 *         - it only burns Safe-owned positions in one hookless pool and mints
 *           to the Safe in that pool;
 *         - every token it moves ends up in the Safe;
 *         - mints can never deposit `currency1` and pull at most `maxAmount0`;
 *         - the reset swap sells at most `maxAmount0` of `currency0`;
 *         - neither the reset swap nor a new range ever sells `currency0`
 *           below the vault's NAV, read from `convertToShares` at call time
 *           and taking one `currency0` as worth one vault asset (OUSD = USDe).
 *           Both currencies must have 18 decimals.
 *
 *         The Safe must enable this module and, once, approve `currency0` to
 *         Permit2 and Permit2 to the PositionManager, which pays the mints.
 */
contract UniswapV4ERC4626RebalanceModule is
    AbstractSafeModule,
    IUnlockCallback
{
    // v4-periphery `Actions` understood by the PositionManager.
    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant BURN_POSITION = 0x03;
    uint8 internal constant CLOSE_CURRENCY = 0x12;
    // Storage slot of `PoolManager._pools`, as used by v4-core `StateLibrary`.
    uint256 internal constant POOLS_SLOT = 6;

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    /// @notice OUSD.
    address public immutable currency0;
    /// @notice The ERC4626 vault (sUSDe) whose asset trades at par with `currency0`.
    address public immutable currency1;
    uint24 public immutable fee;
    int24 public immutable tickSpacing;
    /// @notice The only pool this module may touch.
    bytes32 public immutable poolId;
    /// @notice Cap on `currency0` per mint and per reset swap.
    uint128 public immutable maxAmount0;

    constructor(
        address _safeContract,
        address _operator,
        address _poolManager,
        address _positionManager,
        PoolKey memory _poolKey,
        uint128 _maxAmount0
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        require(_poolKey.hooks == address(0), "Hooked pool");
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        currency0 = _poolKey.currency0;
        currency1 = _poolKey.currency1;
        fee = _poolKey.fee;
        tickSpacing = _poolKey.tickSpacing;
        poolId = keccak256(abi.encode(_poolKey));
        maxAmount0 = _maxAmount0;
        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Burn a position to the Safe, optionally reset the price and mint
     *         `currency0` on a new range.
     * @param _tokenId           Safe-owned position in the module's pool; 0 if
     *                           there is none to burn.
     * @param _tickLower         Bottom of the new range. Must sit at or above
     *                           the NAV, which the pool price check enforces.
     * @param _tickUpper         Top of the new range.
     * @param _liquidity         Liquidity of the new position; 0 to only burn.
     * @param _resetAmount0      Max `currency0` the reset swap sells; 0 for no
     *                           reset.
     * @param _sqrtPriceLimitX96 Price the reset swap stops at, normally the
     *                           new range bottom.
     * @return newTokenId The minted position, 0 if none.
     */
    function rebalance(
        uint256 _tokenId,
        int24 _tickLower,
        int24 _tickUpper,
        uint128 _liquidity,
        uint128 _resetAmount0,
        uint160 _sqrtPriceLimitX96
    ) external onlyOperator returns (uint256 newTokenId) {
        PoolKey memory key = poolKey();

        if (_tokenId != 0) {
            require(
                positionManager.ownerOf(_tokenId) == address(safeContract),
                "Not a Safe position"
            );
            (PoolKey memory positionKey, ) = positionManager
                .getPoolAndPositionInfo(_tokenId);
            require(keccak256(abi.encode(positionKey)) == poolId, "Wrong pool");
            // amount0Min = amount1Min = 0: everything goes to the Safe.
            _modifyLiquidity(
                key,
                BURN_POSITION,
                abi.encode(_tokenId, uint128(0), uint128(0), "")
            );
        }

        uint256 navFloorX192 = navPriceX192();

        if (_resetAmount0 > 0) {
            require(_resetAmount0 <= maxAmount0, "Reset too large");
            require(
                uint256(_sqrtPriceLimitX96)**2 >= navFloorX192,
                "Price limit below NAV"
            );
            poolManager.unlock(
                abi.encode(key, _resetAmount0, _sqrtPriceLimitX96)
            );
        }

        if (_liquidity > 0) {
            // amount1Max = 0 makes the mint `currency0`-only, so the range
            // starts at or above the pool price, itself at or above the NAV.
            require(
                uint256(poolSqrtPriceX96())**2 >= navFloorX192,
                "Pool price below NAV"
            );
            newTokenId = positionManager.nextTokenId();
            _modifyLiquidity(
                key,
                MINT_POSITION,
                abi.encode(
                    key,
                    _tickLower,
                    _tickUpper,
                    uint256(_liquidity),
                    maxAmount0,
                    uint128(0),
                    address(safeContract),
                    ""
                )
            );
        }

        emit IUniswapV4ERC4626RebalanceModule.Rebalanced(
            _tokenId,
            newTokenId,
            _tickLower,
            _tickUpper,
            _liquidity,
            _resetAmount0
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

    function poolKey() public view returns (PoolKey memory) {
        return PoolKey(currency0, currency1, fee, tickSpacing, address(0));
    }

    /// @notice The NAV as a v4 price (vault shares per `currency0`) in X192,
    ///         the square of a `sqrtPriceX96`.
    function navPriceX192() public view returns (uint256) {
        return
            (IERC4626ConvertToShares(currency1).convertToShares(1e18) << 192) /
            1e18;
    }

    /// @notice Current pool price, from the pool's slot0.
    function poolSqrtPriceX96() public view returns (uint160) {
        return
            uint160(
                uint256(
                    poolManager.extsload(
                        keccak256(abi.encode(poolId, POOLS_SLOT))
                    )
                )
            );
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
