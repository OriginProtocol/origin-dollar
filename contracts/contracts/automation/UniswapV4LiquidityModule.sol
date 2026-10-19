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
 * @dev    The module holds no pricing logic: no price floor, no NAV, no tick
 *         bounds. Which pool, range, size and reset to use is decided
 *         off-chain by the operator (Talos), so a change of pricing logic,
 *         pool or token never needs a redeploy. The module only protects the
 *         Safe's funds, with limits the Safe can change:
 *         - it acts only on hookless pools the Safe allowed, with ERC20
 *           currencies, and burns only Safe-owned positions in that pool;
 *         - every token it moves ends up in the Safe;
 *         - a mint pulls at most `maxPerCall` of each currency, and the reset
 *           swap spends at most `maxPerCall` of its input;
 *         - over a UTC day, the Safe's net outflow of each currency through
 *           the module (what it paid less what it got back, per call) stays
 *           within `maxPerDay`;
 *         - the Safe can pause it.
 *         A compromised operator can therefore buy at a bad price, but loses
 *         at most `maxPerDay` of each currency per day.
 *
 *         The Safe must enable this module and, once per currency it lets the
 *         module pay, approve the token to Permit2 and Permit2 to the
 *         PositionManager, which pays the mints.
 */
contract UniswapV4LiquidityModule is AbstractSafeModule, IUnlockCallback {
    // v4-periphery `Actions` understood by the PositionManager.
    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant BURN_POSITION = 0x03;
    uint8 internal constant CLOSE_CURRENCY = 0x12;
    // Storage slot of `PoolManager._pools`, as used by v4-core `StateLibrary`.
    uint256 internal constant POOLS_SLOT = 6;

    IPoolManager internal immutable _poolManager;
    IPositionManager internal immutable _positionManager;

    /// @notice When true, `rebalance` reverts.
    bool public paused;
    /// @notice Pools the module may act on, by v4 pool id.
    mapping(bytes32 => bool) public isPoolAllowed;
    /// @notice Most of a token one mint, or one reset swap, may take from the Safe.
    mapping(address => uint256) public maxPerCall;
    /// @notice Most net outflow of a token from the Safe through the module per UTC day.
    mapping(address => uint256) public maxPerDay;
    /// @notice Net outflow of a token from the Safe through the module, per UTC day.
    mapping(uint256 => mapping(address => uint256)) public spentOn;

    constructor(
        address _safeContract,
        address _operator,
        address _poolManagerAddress,
        address _positionManagerAddress
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        require(_poolManagerAddress != address(0), "Invalid pool manager");
        require(
            _positionManagerAddress != address(0),
            "Invalid position manager"
        );
        _poolManager = IPoolManager(_poolManagerAddress);
        _positionManager = IPositionManager(_positionManagerAddress);
        _grantRole(OPERATOR_ROLE, _operator);
    }

    // ==================== Operator ==================== //

    /**
     * @notice Burn a Safe position, optionally reset the pool price and mint
     *         a new Safe position, all in one pool the Safe allowed.
     * @return newTokenId The minted position, 0 if none.
     */
    function rebalance(IUniswapV4LiquidityModule.RebalanceParams calldata _p)
        external
        onlyOperator
        returns (uint256 newTokenId)
    {
        require(!paused, "Paused");
        PoolKey memory key = _p.key;
        bytes32 id = keccak256(abi.encode(key));
        require(isPoolAllowed[id], "Pool not allowed");

        uint256 before0 = IERC20(key.currency0).balanceOf(
            address(safeContract)
        );
        uint256 before1 = IERC20(key.currency1).balanceOf(
            address(safeContract)
        );

        if (_p.tokenId != 0) {
            require(
                _positionManager.ownerOf(_p.tokenId) == address(safeContract),
                "Not a Safe position"
            );
            (PoolKey memory positionKey, ) = _positionManager
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
            address input = _p.resetZeroForOne ? key.currency0 : key.currency1;
            require(
                _p.resetAmountIn <= maxPerCall[input],
                "Reset above max per call"
            );
            _poolManager.unlock(
                abi.encode(
                    key,
                    _p.resetZeroForOne,
                    _p.resetAmountIn,
                    _p.sqrtPriceLimitX96
                )
            );
        }

        if (_p.liquidity > 0) {
            require(
                _p.amount0Max <= maxPerCall[key.currency0] &&
                    _p.amount1Max <= maxPerCall[key.currency1],
                "Mint above max per call"
            );
            newTokenId = _positionManager.nextTokenId();
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
                    address(safeContract),
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
        require(msg.sender == address(_poolManager), "Not the pool manager");
        (
            PoolKey memory key,
            bool zeroForOne,
            uint128 amountIn,
            uint160 sqrtPriceLimitX96
        ) = abi.decode(_data, (PoolKey, bool, uint128, uint160));

        int256 delta = _poolManager.swap(
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

    // ==================== Safe ==================== //

    /// @notice Let the module act on a hookless pool with ERC20 currencies.
    function allowPool(PoolKey calldata _key) external onlySafe {
        require(_key.hooks == address(0), "Hooked pool");
        require(
            _key.currency0 != address(0) && _key.currency1 != address(0),
            "Native currency"
        );
        bytes32 id = keccak256(abi.encode(_key));
        isPoolAllowed[id] = true;
        emit IUniswapV4LiquidityModule.PoolAllowed(id, _key);
    }

    function revokePool(bytes32 _poolId) external onlySafe {
        isPoolAllowed[_poolId] = false;
        emit IUniswapV4LiquidityModule.PoolRevoked(_poolId);
    }

    function setMaxPerCall(address _token, uint256 _amount) external onlySafe {
        maxPerCall[_token] = _amount;
        emit IUniswapV4LiquidityModule.MaxPerCallSet(_token, _amount);
    }

    function setMaxPerDay(address _token, uint256 _amount) external onlySafe {
        maxPerDay[_token] = _amount;
        emit IUniswapV4LiquidityModule.MaxPerDaySet(_token, _amount);
    }

    function setPaused(bool _paused) external onlySafe {
        paused = _paused;
        emit IUniswapV4LiquidityModule.PausedSet(_paused);
    }

    // ==================== Views ==================== //

    function poolManager() external view returns (address) {
        return address(_poolManager);
    }

    function positionManager() external view returns (address) {
        return address(_positionManager);
    }

    /// @notice Net outflow of `_token` from the Safe through the module today.
    function spentToday(address _token) external view returns (uint256) {
        return spentOn[_today()][_token];
    }

    /// @notice Net outflow of `_token` the module may still cause today.
    function remainingToday(address _token) external view returns (uint256) {
        uint256 spent = spentOn[_today()][_token];
        uint256 cap = maxPerDay[_token];
        return spent >= cap ? 0 : cap - spent;
    }

    /// @notice Current price of a pool, from its slot0.
    function poolSqrtPriceX96(bytes32 _poolId) external view returns (uint160) {
        return
            uint160(
                uint256(
                    _poolManager.extsload(
                        keccak256(abi.encode(_poolId, POOLS_SLOT))
                    )
                )
            );
    }

    // ==================== Internal ==================== //

    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @dev Adds the call's net outflow of `_token` to today's total, which
    ///      must stay within `maxPerDay`. A net inflow lowers it, not below 0.
    function _trackOutflow(address _token, uint256 _before) internal {
        uint256 afterBalance = IERC20(_token).balanceOf(address(safeContract));
        uint256 day = _today();
        uint256 spent = spentOn[day][_token];
        if (afterBalance < _before) {
            spent += _before - afterBalance;
            require(spent <= maxPerDay[_token], "Above max per day");
        } else {
            uint256 inflow = afterBalance - _before;
            spent = inflow >= spent ? 0 : spent - inflow;
        }
        spentOn[day][_token] = spent;
    }

    function _settleOrTake(address _currency, int128 _amount) internal {
        if (_amount < 0) {
            uint256 owed = uint256(uint128(-_amount));
            _poolManager.sync(_currency);
            _exec(
                _currency,
                abi.encodeWithSelector(
                    IERC20.transfer.selector,
                    address(_poolManager),
                    owed
                )
            );
            _poolManager.settle();
        } else if (_amount > 0) {
            _poolManager.take(
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
            address(_positionManager),
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
