// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IUniswapV4RebalanceModule } from "../interfaces/automation/IUniswapV4RebalanceModule.sol";
import { IPermit2 } from "../interfaces/uniswap/IPermit2.sol";
import { IPoolManager, IUnlockCallback, PoolKey } from "../interfaces/uniswap/v4/IPoolManager.sol";
import { IPositionManager } from "../interfaces/uniswap/v4/IPositionManager.sol";
import { TickMath } from "../utils/TickMath.sol";

/**
 * @title UniswapV4RebalanceModule
 * @notice Gnosis Safe module that keeps Safe-owned Uniswap v4 positions
 *         one-sided. A position provides `currency0` (OUSD) on a range just
 *         above the price, so it only ever buys `currency1` (e.g. USDe) from
 *         sellers. An operator pulls the `currency1` bought to the Safe and puts
 *         `currency0` back, so it cannot be bought back from the pool, and moves
 *         the range when the bid price should change.
 *
 * @dev    `rebalance` is one transaction:
 *         1. Pull: decrease the whole position, both currencies to the Safe.
 *         2. Reset: if the price is still inside the range, swap it back down to
 *            the bottom of the range with a price limit. The swap runs through
 *            the module's own `unlock` because the v4 Universal Router takes no
 *            price limit. With no other liquidity in the range it trades
 *            nothing; otherwise the Safe pays `currency0` at or above the range
 *            price, capped by `maxResetAmount0`.
 *         3. Re-add: increase the position back to `targetLiquidity` with
 *            `amount1Max = 0`, so the add can only ever deposit `currency0`.
 *
 *         `reposition` moves a position to a new range of the same width: it
 *         burns the old position to the Safe, resets the price to the new range
 *         bottom and mints the new position. It is all or nothing.
 *
 *         Safety properties against a compromised operator key:
 *         - All calldata is built here. The operator passes a tokenId and, to
 *           reposition, a lower tick inside bounds the Safe set. Every token the
 *           module moves ends up in the Safe.
 *         - `currency0` is only ever sold at or above the price of a range
 *           bottom the Safe allowed, and the amounts are capped by the Safe.
 *         - The operator can pause, but only the Safe can unpause. `pull` keeps
 *           working while paused.
 *
 *         A re-add that cannot happen is skipped with a `ReAddSkipped` event
 *         instead of reverting, so the pull is never undone. A later call tops
 *         the position back up.
 *
 *         The Safe must call `enableModule(address(this))` before this module
 *         can do anything at all.
 */
contract UniswapV4RebalanceModule is AbstractSafeModule, IUnlockCallback {
    /// @dev v4-periphery `Actions` values understood by the PositionManager.
    uint256 internal constant INCREASE_LIQUIDITY = 0x00;
    uint256 internal constant DECREASE_LIQUIDITY = 0x01;
    uint256 internal constant MINT_POSITION = 0x02;
    uint256 internal constant BURN_POSITION = 0x03;
    uint256 internal constant CLOSE_CURRENCY = 0x12;

    /// @dev Storage slot of `PoolManager._pools`, as used by v4-core `StateLibrary`.
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    uint256 internal constant Q96 = 2**96;

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    IPermit2 public immutable permit2;

    /// @notice When true, no liquidity is added. Pulling still works.
    bool public paused;

    mapping(uint256 => IUniswapV4RebalanceModule.PositionConfig)
        internal positions;
    uint256[] internal tokenIds;

    event PositionConfigured(
        uint256 indexed tokenId,
        bytes32 indexed poolId,
        int24 tickLower,
        int24 tickUpper,
        IUniswapV4RebalanceModule.PositionLimits limits
    );
    event PositionRemoved(uint256 indexed tokenId);
    event Paused(address indexed by);
    event Unpaused();
    event LiquidityPulled(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    event PriceReset(
        uint256 indexed tokenId,
        uint256 amount0In,
        uint256 amount1Out,
        uint160 sqrtPriceX96
    );
    event LiquidityAdded(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint256 amount0
    );
    event ReAddSkipped(
        uint256 indexed tokenId,
        IUniswapV4RebalanceModule.Reason reason
    );
    event Repositioned(
        uint256 indexed oldTokenId,
        uint256 indexed newTokenId,
        int24 tickLower,
        int24 tickUpper
    );

    /**
     * @param _safeContract    Gnosis Safe that owns the positions.
     * @param _operator        Address allowed to rebalance (Talos relayer).
     * @param _poolManager     Uniswap v4 PoolManager.
     * @param _positionManager Uniswap v4 PositionManager.
     * @param _permit2         Permit2, through which the PositionManager pulls
     *                         the Safe's tokens.
     */
    constructor(
        address _safeContract,
        address _operator,
        address _poolManager,
        address _positionManager,
        address _permit2
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        require(_poolManager.code.length > 0, "Invalid pool manager");
        require(_positionManager.code.length > 0, "Invalid position manager");
        require(_permit2.code.length > 0, "Invalid permit2");

        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        permit2 = IPermit2(_permit2);

        _grantRole(OPERATOR_ROLE, _operator);
    }

    ////////////////////////////////////////////////////
    ///               Operator actions               ///
    ////////////////////////////////////////////////////

    /**
     * @notice Pull any `currency1` out of the position to the Safe and put the
     *         position back to its target liquidity, `currency0` only.
     * @param _tokenId PositionManager tokenId of a configured position.
     * @return added True if liquidity was added back.
     */
    function rebalance(uint256 _tokenId)
        external
        onlyOperator
        returns (bool added)
    {
        IUniswapV4RebalanceModule.PositionConfig memory cfg = _config(_tokenId);
        uint160 sqrtPrice = _sqrtPrice(cfg.poolId);
        uint128 liquidity = positionManager.getPositionLiquidity(_tokenId);
        bool priceInRange = sqrtPrice > cfg.sqrtPriceLowerX96;

        require(
            priceInRange || liquidity < cfg.limits.targetLiquidity,
            "Nothing to rebalance"
        );

        if (priceInRange && liquidity > 0) {
            _pull(_tokenId, cfg, liquidity);
            liquidity = 0;
        }

        if (paused) {
            emit ReAddSkipped(
                _tokenId,
                IUniswapV4RebalanceModule.Reason.Paused
            );
            return false;
        }

        if (priceInRange) {
            if (cfg.limits.maxResetAmount0 > 0) {
                sqrtPrice = _resetPrice(_tokenId, cfg);
            }
            if (sqrtPrice > cfg.sqrtPriceLowerX96) {
                emit ReAddSkipped(
                    _tokenId,
                    IUniswapV4RebalanceModule.Reason.PriceInRange
                );
                return false;
            }
        }

        if (_atExposureCap(cfg)) {
            emit ReAddSkipped(
                _tokenId,
                IUniswapV4RebalanceModule.Reason.ExposureCap
            );
            return false;
        }

        // A failed add (e.g. the Safe is short of currency0) must not undo
        // the pull, so it is reported rather than reverted.
        added = _add(_tokenId, cfg, cfg.limits.targetLiquidity - liquidity);
        if (!added) {
            emit ReAddSkipped(
                _tokenId,
                IUniswapV4RebalanceModule.Reason.AddFailed
            );
        }
    }

    /**
     * @notice Move a position to a new range of the same width, at the target
     *         liquidity. The old position is burned to the Safe and a new one
     *         is minted, so the tokenId changes. Reverts entirely if the new
     *         position cannot be minted.
     * @param _tokenId      PositionManager tokenId of a configured position.
     * @param _newTickLower New lower tick, inside the Safe's bounds.
     * @return newTokenId   tokenId of the new position, now configured in
     *                      place of the old one.
     */
    function reposition(uint256 _tokenId, int24 _newTickLower)
        external
        onlyOperator
        returns (uint256 newTokenId)
    {
        IUniswapV4RebalanceModule.PositionConfig memory cfg = _config(_tokenId);
        require(!paused, "Paused");
        require(_newTickLower != cfg.tickLower, "Same range");
        require(
            _newTickLower >= cfg.limits.minTickLower &&
                _newTickLower <= cfg.limits.maxTickLower,
            "Tick out of bounds"
        );
        require(_newTickLower % cfg.key.tickSpacing == 0, "Tick not aligned");

        _burn(_tokenId, cfg);

        cfg.tickUpper = _newTickLower + (cfg.tickUpper - cfg.tickLower);
        cfg.tickLower = _newTickLower;
        cfg.sqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(cfg.tickLower);
        cfg.sqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(cfg.tickUpper);
        require(
            uint256(cfg.sqrtPriceUpperX96 - cfg.sqrtPriceLowerX96) <=
                type(uint128).max,
            "Range too wide"
        );

        uint160 sqrtPrice = _sqrtPrice(cfg.poolId);
        if (sqrtPrice > cfg.sqrtPriceLowerX96) {
            if (cfg.limits.maxResetAmount0 > 0) {
                sqrtPrice = _resetPrice(_tokenId, cfg);
            }
            require(sqrtPrice <= cfg.sqrtPriceLowerX96, "Price above range");
        }
        require(!_atExposureCap(cfg), "Exposure cap");

        newTokenId = _mint(cfg);

        positions[newTokenId] = cfg;
        delete positions[_tokenId];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == _tokenId) {
                tokenIds[i] = newTokenId;
                break;
            }
        }

        emit Repositioned(_tokenId, newTokenId, cfg.tickLower, cfg.tickUpper);
    }

    /**
     * @notice Remove all liquidity of a position to the Safe without adding it
     *         back. Works while paused.
     * @param _tokenId PositionManager tokenId of a configured position.
     */
    function pull(uint256 _tokenId) external onlyOperator {
        IUniswapV4RebalanceModule.PositionConfig memory cfg = _config(_tokenId);
        uint128 liquidity = positionManager.getPositionLiquidity(_tokenId);
        require(liquidity > 0, "No liquidity");
        _pull(_tokenId, cfg, liquidity);
    }

    /// @notice Stop adding liquidity. The Safe holds the operator role too.
    function pause() external onlyOperator {
        paused = true;
        emit Paused(msg.sender);
    }

    ////////////////////////////////////////////////////
    ///                  Safe admin                  ///
    ////////////////////////////////////////////////////

    function unpause() external onlySafe {
        paused = false;
        emit Unpaused();
    }

    /**
     * @notice Add or update a position this module may rebalance. The pool,
     *         the range and the owner are read from the PositionManager.
     * @param _tokenId PositionManager tokenId, owned by the Safe.
     * @param _limits  Liquidity, amount and tick limits for the position.
     */
    function configurePosition(
        uint256 _tokenId,
        IUniswapV4RebalanceModule.PositionLimits calldata _limits
    ) external onlySafe {
        require(_limits.targetLiquidity > 0, "Invalid target liquidity");
        require(_limits.maxAmount0 > 0, "Invalid max amount0");
        require(_limits.maxToken1InSafe > 0, "Invalid max token1");
        require(
            _limits.minTickLower <= _limits.maxTickLower,
            "Invalid tick bounds"
        );
        require(
            positionManager.ownerOf(_tokenId) == address(safeContract),
            "Position not owned by Safe"
        );

        (PoolKey memory key, uint256 info) = positionManager
            .getPoolAndPositionInfo(_tokenId);
        require(key.hooks == address(0), "Hooked pool");
        require(key.currency0 != address(0), "Native currency");

        int24 tickLower = int24(uint24(info >> 8));
        int24 tickUpper = int24(uint24(info >> 32));
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        // Keeps `liquidity * (sqrtUpper - sqrtLower)` within 256 bits.
        require(
            uint256(sqrtUpper - sqrtLower) <= type(uint128).max,
            "Range too wide"
        );

        bytes32 poolId = keccak256(abi.encode(key));

        if (positions[_tokenId].limits.targetLiquidity == 0) {
            tokenIds.push(_tokenId);
        }

        positions[_tokenId] = IUniswapV4RebalanceModule.PositionConfig({
            key: key,
            poolId: poolId,
            tickLower: tickLower,
            tickUpper: tickUpper,
            sqrtPriceLowerX96: sqrtLower,
            sqrtPriceUpperX96: sqrtUpper,
            limits: _limits
        });

        emit PositionConfigured(
            _tokenId,
            poolId,
            tickLower,
            tickUpper,
            _limits
        );
    }

    /// @notice Stop this module from touching a position.
    function removePosition(uint256 _tokenId) external onlySafe {
        require(
            positions[_tokenId].limits.targetLiquidity > 0,
            "Position not configured"
        );
        delete positions[_tokenId];

        uint256 last = tokenIds.length - 1;
        for (uint256 i = 0; i <= last; i++) {
            if (tokenIds[i] == _tokenId) {
                tokenIds[i] = tokenIds[last];
                tokenIds.pop();
                break;
            }
        }

        emit PositionRemoved(_tokenId);
    }

    ////////////////////////////////////////////////////
    ///              PoolManager callback            ///
    ////////////////////////////////////////////////////

    /**
     * @notice Runs the reset swap. The PoolManager only calls back the address
     *         that called `unlock`, so this only ever runs inside
     *         `_resetPrice`, with data the module encoded itself.
     * @dev    The Safe pays the pool directly and receives the output. The
     *         module itself never holds a token.
     */
    function unlockCallback(bytes calldata _data)
        external
        override
        returns (bytes memory)
    {
        require(
            msg.sender == address(poolManager),
            "Caller is not the pool manager"
        );

        (PoolKey memory key, uint128 maxAmount0, uint160 sqrtPriceLimit) = abi
            .decode(_data, (PoolKey, uint128, uint160));

        int256 delta = poolManager.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(uint256(maxAmount0)),
                sqrtPriceLimitX96: sqrtPriceLimit
            }),
            ""
        );

        // BalanceDelta: amount0 in the upper 128 bits, amount1 in the lower.
        // An exact-in zeroForOne swap only ever owes currency0 and receives
        // currency1.
        int128 delta0 = int128(delta >> 128);
        int128 delta1 = int128(delta);
        uint256 amount0In = delta0 < 0 ? uint256(uint128(-delta0)) : 0;
        uint256 amount1Out = delta1 > 0 ? uint256(uint128(delta1)) : 0;

        if (amount0In > 0) {
            poolManager.sync(key.currency0);
            _exec(
                key.currency0,
                abi.encodeWithSelector(
                    IERC20.transfer.selector,
                    address(poolManager),
                    amount0In
                ),
                "Reset payment failed"
            );
            poolManager.settle();
        }
        if (amount1Out > 0) {
            poolManager.take(key.currency1, address(safeContract), amount1Out);
        }

        return abi.encode(amount0In, amount1Out);
    }

    ////////////////////////////////////////////////////
    ///                     Views                    ///
    ////////////////////////////////////////////////////

    function getPosition(uint256 _tokenId)
        external
        view
        returns (IUniswapV4RebalanceModule.PositionConfig memory)
    {
        return positions[_tokenId];
    }

    function configuredTokenIds() external view returns (uint256[] memory) {
        return tokenIds;
    }

    /// @notice Current sqrt price of the position's pool.
    function sqrtPriceX96(uint256 _tokenId) external view returns (uint160) {
        return _sqrtPrice(_config(_tokenId).poolId);
    }

    /// @notice Amount of `currency1` the position currently holds.
    function pendingToken1(uint256 _tokenId) external view returns (uint256) {
        IUniswapV4RebalanceModule.PositionConfig memory cfg = _config(_tokenId);
        uint160 sqrtPrice = _sqrtPrice(cfg.poolId);
        uint128 liquidity = positionManager.getPositionLiquidity(_tokenId);
        if (sqrtPrice <= cfg.sqrtPriceLowerX96 || liquidity == 0) return 0;

        uint160 top = sqrtPrice < cfg.sqrtPriceUpperX96
            ? sqrtPrice
            : cfg.sqrtPriceUpperX96;
        return
            (uint256(liquidity) * uint256(top - cfg.sqrtPriceLowerX96)) / Q96;
    }

    /**
     * @notice Whether `rebalance` has work to do, mirroring its branches.
     * @return needed True if `rebalance` would pull or add.
     * @return reason Why. A re-add can still be skipped if the reset swap does
     *         not bring the price back to the bottom of the range, or if the
     *         add itself fails; simulate `rebalance` to know for sure.
     */
    function rebalanceStatus(uint256 _tokenId)
        external
        view
        returns (bool needed, IUniswapV4RebalanceModule.Reason reason)
    {
        IUniswapV4RebalanceModule.PositionConfig memory cfg = positions[
            _tokenId
        ];
        if (cfg.limits.targetLiquidity == 0) {
            return (false, IUniswapV4RebalanceModule.Reason.NotConfigured);
        }

        uint160 sqrtPrice = _sqrtPrice(cfg.poolId);
        uint128 liquidity = positionManager.getPositionLiquidity(_tokenId);
        bool priceInRange = sqrtPrice > cfg.sqrtPriceLowerX96;

        if (priceInRange && liquidity > 0) {
            return (true, IUniswapV4RebalanceModule.Reason.PullNeeded);
        }
        if (paused) {
            return (false, IUniswapV4RebalanceModule.Reason.Paused);
        }
        if (!priceInRange && liquidity >= cfg.limits.targetLiquidity) {
            return (false, IUniswapV4RebalanceModule.Reason.Balanced);
        }
        if (priceInRange && cfg.limits.maxResetAmount0 == 0) {
            return (false, IUniswapV4RebalanceModule.Reason.PriceInRange);
        }
        if (_atExposureCap(cfg)) {
            return (false, IUniswapV4RebalanceModule.Reason.ExposureCap);
        }
        return (true, IUniswapV4RebalanceModule.Reason.ReAddNeeded);
    }

    ////////////////////////////////////////////////////
    ///                   Internals                  ///
    ////////////////////////////////////////////////////

    function _config(uint256 _tokenId)
        internal
        view
        returns (IUniswapV4RebalanceModule.PositionConfig memory cfg)
    {
        cfg = positions[_tokenId];
        require(cfg.limits.targetLiquidity > 0, "Position not configured");
    }

    /// @dev `StateLibrary.getSlot0` without the v4-core dependency: the price
    ///      is the low 160 bits of the pool's first storage slot.
    function _sqrtPrice(bytes32 _poolId) internal view returns (uint160) {
        bytes32 slot0 = poolManager.extsload(
            keccak256(abi.encode(_poolId, POOLS_SLOT))
        );
        return uint160(uint256(slot0));
    }

    /// @dev True once the Safe holds as much currency1 as it is allowed to
    ///      wait on, e.g. while redemptions are pending.
    function _atExposureCap(
        IUniswapV4RebalanceModule.PositionConfig memory _cfg
    ) internal view returns (bool) {
        return
            IERC20(_cfg.key.currency1).balanceOf(address(safeContract)) >=
            _cfg.limits.maxToken1InSafe;
    }

    function _pull(
        uint256 _tokenId,
        IUniswapV4RebalanceModule.PositionConfig memory _cfg,
        uint128 _liquidity
    ) internal {
        (uint256 balance0, uint256 balance1) = _safeBalances(_cfg);

        // CLOSE_CURRENCY settles or takes the full delta of each currency
        // with the locker, which is the Safe.
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            _tokenId,
            uint256(_liquidity),
            uint128(0),
            uint128(0),
            bytes("")
        );
        params[1] = abi.encode(_cfg.key.currency0);
        params[2] = abi.encode(_cfg.key.currency1);
        _exec(
            address(positionManager),
            _modifyLiquiditiesCall(
                abi.encodePacked(
                    uint8(DECREASE_LIQUIDITY),
                    uint8(CLOSE_CURRENCY),
                    uint8(CLOSE_CURRENCY)
                ),
                params
            ),
            "Pull failed"
        );

        _emitPulled(_tokenId, _cfg, _liquidity, balance0, balance1);
    }

    /// @dev Remove all liquidity, any fees and the NFT itself, to the Safe.
    function _burn(
        uint256 _tokenId,
        IUniswapV4RebalanceModule.PositionConfig memory _cfg
    ) internal {
        uint128 liquidity = positionManager.getPositionLiquidity(_tokenId);
        (uint256 balance0, uint256 balance1) = _safeBalances(_cfg);

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(_tokenId, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(_cfg.key.currency0);
        params[2] = abi.encode(_cfg.key.currency1);
        _exec(
            address(positionManager),
            _modifyLiquiditiesCall(
                abi.encodePacked(
                    uint8(BURN_POSITION),
                    uint8(CLOSE_CURRENCY),
                    uint8(CLOSE_CURRENCY)
                ),
                params
            ),
            "Burn failed"
        );

        _emitPulled(_tokenId, _cfg, liquidity, balance0, balance1);
    }

    function _resetPrice(
        uint256 _tokenId,
        IUniswapV4RebalanceModule.PositionConfig memory _cfg
    ) internal returns (uint160 sqrtPriceAfter) {
        (uint256 amount0In, uint256 amount1Out) = abi.decode(
            poolManager.unlock(
                abi.encode(
                    _cfg.key,
                    _cfg.limits.maxResetAmount0,
                    _cfg.sqrtPriceLowerX96
                )
            ),
            (uint256, uint256)
        );
        sqrtPriceAfter = _sqrtPrice(_cfg.poolId);
        emit PriceReset(_tokenId, amount0In, amount1Out, sqrtPriceAfter);
    }

    function _add(
        uint256 _tokenId,
        IUniswapV4RebalanceModule.PositionConfig memory _cfg,
        uint128 _liquidity
    ) internal returns (bool) {
        address currency0 = _cfg.key.currency0;
        uint256 balance0 = IERC20(currency0).balanceOf(address(safeContract));
        _approveAmount0(_cfg);

        // amount1Max = 0: the add fails if it would need any currency1.
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            _tokenId,
            uint256(_liquidity),
            _cfg.limits.maxAmount0,
            uint128(0),
            bytes("")
        );
        params[1] = abi.encode(currency0);
        params[2] = abi.encode(_cfg.key.currency1);
        bool success = _tryExec(
            address(positionManager),
            _modifyLiquiditiesCall(
                abi.encodePacked(
                    uint8(INCREASE_LIQUIDITY),
                    uint8(CLOSE_CURRENCY),
                    uint8(CLOSE_CURRENCY)
                ),
                params
            )
        );
        if (!success) return false;

        emit LiquidityAdded(
            _tokenId,
            _liquidity,
            _gain(balance0, IERC20(currency0).balanceOf(address(safeContract)))
        );
        return true;
    }

    /// @dev Mint the configured range at the target liquidity, owned by the
    ///      Safe. `amount1Max = 0`: the mint fails if it would need currency1.
    function _mint(IUniswapV4RebalanceModule.PositionConfig memory _cfg)
        internal
        returns (uint256 tokenId)
    {
        address currency0 = _cfg.key.currency0;
        uint256 balance0 = IERC20(currency0).balanceOf(address(safeContract));
        _approveAmount0(_cfg);

        tokenId = positionManager.nextTokenId();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            _cfg.key,
            _cfg.tickLower,
            _cfg.tickUpper,
            uint256(_cfg.limits.targetLiquidity),
            _cfg.limits.maxAmount0,
            uint128(0),
            address(safeContract),
            bytes("")
        );
        params[1] = abi.encode(currency0);
        params[2] = abi.encode(_cfg.key.currency1);
        _exec(
            address(positionManager),
            _modifyLiquiditiesCall(
                abi.encodePacked(
                    uint8(MINT_POSITION),
                    uint8(CLOSE_CURRENCY),
                    uint8(CLOSE_CURRENCY)
                ),
                params
            ),
            "Mint failed"
        );
        require(
            positionManager.ownerOf(tokenId) == address(safeContract),
            "Mint failed"
        );

        emit LiquidityAdded(
            tokenId,
            _cfg.limits.targetLiquidity,
            _gain(balance0, IERC20(currency0).balanceOf(address(safeContract)))
        );
    }

    /// @dev Both allowances run down on every add (OUSD's own allowance too,
    ///      even at max), so they are set for exactly this add. A Permit2
    ///      expiration of 0 lasts until the end of this block.
    function _approveAmount0(
        IUniswapV4RebalanceModule.PositionConfig memory _cfg
    ) internal {
        address currency0 = _cfg.key.currency0;
        _exec(
            currency0,
            abi.encodeWithSelector(
                IERC20.approve.selector,
                address(permit2),
                uint256(_cfg.limits.maxAmount0)
            ),
            "Token approval failed"
        );
        _exec(
            address(permit2),
            abi.encodeWithSelector(
                IPermit2.approve.selector,
                currency0,
                address(positionManager),
                uint160(_cfg.limits.maxAmount0),
                uint48(0)
            ),
            "Permit2 approval failed"
        );
    }

    function _safeBalances(IUniswapV4RebalanceModule.PositionConfig memory _cfg)
        internal
        view
        returns (uint256 balance0, uint256 balance1)
    {
        address safe = address(safeContract);
        balance0 = IERC20(_cfg.key.currency0).balanceOf(safe);
        balance1 = IERC20(_cfg.key.currency1).balanceOf(safe);
    }

    function _emitPulled(
        uint256 _tokenId,
        IUniswapV4RebalanceModule.PositionConfig memory _cfg,
        uint128 _liquidity,
        uint256 _balance0Before,
        uint256 _balance1Before
    ) internal {
        (uint256 balance0, uint256 balance1) = _safeBalances(_cfg);
        emit LiquidityPulled(
            _tokenId,
            _liquidity,
            _gain(balance0, _balance0Before),
            _gain(balance1, _balance1Before)
        );
    }

    function _modifyLiquiditiesCall(
        bytes memory _actions,
        bytes[] memory _params
    ) internal view returns (bytes memory) {
        return
            abi.encodeWithSelector(
                IPositionManager.modifyLiquidities.selector,
                abi.encode(_actions, _params),
                block.timestamp
            );
    }

    function _exec(
        address _target,
        bytes memory _data,
        string memory _error
    ) internal {
        require(_tryExec(_target, _data), _error);
    }

    function _tryExec(address _target, bytes memory _data)
        internal
        returns (bool)
    {
        return
            safeContract.execTransactionFromModule(
                _target,
                0, // Value
                _data,
                0 // Call
            );
    }

    function _gain(uint256 _after, uint256 _before)
        internal
        pure
        returns (uint256)
    {
        return _after > _before ? _after - _before : 0;
    }
}
