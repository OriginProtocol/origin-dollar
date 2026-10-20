// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4LiquidityModule_Shared_Test
} from "tests/unit/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

contract Unit_Concrete_UniswapV4LiquidityModule_Rebalance_Test is Unit_UniswapV4LiquidityModule_Shared_Test {
    uint256 internal constant BURNED0 = 15_000e18;
    uint256 internal constant BURNED1 = 5_000e18;
    uint256 internal constant MINTED0 = 50_000e18;

    int24 internal constant NEW_LOWER = 4;
    int24 internal constant NEW_UPPER = 5;

    function setUp() public override {
        super.setUp();
        positionManager.setAmounts(BURNED0, BURNED1, MINTED0, 0);
        poolManager.setSwapResult(0, 0, SQRT_PRICE_PAR);
    }

    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_burnsResetsAndMints() public {
        poolManager.setSwapResult(-500e18, 499e18, SQRT_PRICE_PAR);
        uint256 expectedId = positionManager.nextTokenId();

        vm.expectCall(address(positionManager), _modifyCall(0x03, abi.encode(TOKEN_ID, uint128(0), uint128(0), "")));
        vm.expectCall(
            address(positionManager),
            _modifyCall(
                0x02,
                abi.encode(
                    key, NEW_LOWER, NEW_UPPER, uint256(LIQUIDITY), AMOUNT0_MAX, uint128(0), address(mockSafe), ""
                )
            )
        );
        vm.expectEmit(true, true, true, true, address(module));
        emit IUniswapV4LiquidityModule.Rebalanced(
            poolId, TOKEN_ID, expectedId, NEW_LOWER, NEW_UPPER, LIQUIDITY, true, RESET_AMOUNT
        );

        uint256 newTokenId = _rebalance(_params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, RESET_AMOUNT));

        assertEq(newTokenId, expectedId);
        assertEq(positionManager.ownerOf(newTokenId), address(mockSafe));
        assertEq(positionManager.getPositionLiquidity(newTokenId), LIQUIDITY);
        vm.expectRevert("NOT_MINTED");
        positionManager.ownerOf(TOKEN_ID);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + BURNED0 - 500e18 - MINTED0);
        assertEq(token1.balanceOf(address(mockSafe)), SAFE_TOKEN1 + BURNED1 + 499e18);
        assertEq(token0.balanceOf(address(module)), 0);
        assertEq(token1.balanceOf(address(module)), 0);
        // Net token0 outflow of the call: reset + mint - burn.
        assertEq(_spentToday(address(token0)), 500e18 + MINTED0 - BURNED0);
        assertEq(_spentToday(address(token1)), 0);
    }

    function test_rebalance_resetZeroForOneIsExactInAtTheLimit() public {
        _rebalance(_params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, RESET_AMOUNT));

        (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) = poolManager.lastSwapParams();
        assertTrue(zeroForOne);
        assertEq(amountSpecified, -int256(uint256(RESET_AMOUNT)));
        assertEq(sqrtPriceLimitX96, SQRT_PRICE_PAR);
    }

    /// @dev The other direction sells token1; it needs a token1 cap from the Safe.
    function test_rebalance_resetOneForZero() public {
        vm.prank(address(mockSafe));
        module.setMaxPerDay(address(token1), RESET_AMOUNT);
        poolManager.setSwapResult(400e18, -400e18, SQRT_PRICE_PAR + 1);

        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(0, 0, 0, 0, RESET_AMOUNT);
        p.tokenId = 0;
        p.resetZeroForOne = false;
        p.sqrtPriceLimitX96 = SQRT_PRICE_PAR + 1;
        _rebalance(p);

        (bool zeroForOne,,) = poolManager.lastSwapParams();
        assertFalse(zeroForOne);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + 400e18);
        assertEq(token1.balanceOf(address(mockSafe)), SAFE_TOKEN1 - 400e18);
        assertEq(_spentToday(address(token1)), 400e18);
    }

    /// @dev No price rule in the module: a range priced above par and a reset limit below par
    ///      are the operator's call.
    function test_rebalance_noPriceFloor() public {
        poolManager.setSwapResult(-500e18, 499e18, SQRT_PRICE_PAR / 2);
        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(-50, -49, LIQUIDITY, AMOUNT0_MAX, RESET_AMOUNT);
        p.sqrtPriceLimitX96 = SQRT_PRICE_PAR / 2;
        _rebalance(p);
    }

    function test_rebalance_burnOnly_netInflowLeavesNothingSpent() public {
        uint256 newTokenId = _rebalance(_params(0, 0, 0, 0, 0));

        assertEq(newTokenId, 0);
        assertEq(positionManager.modifyCount(), 1);
        assertEq(poolManager.swapCount(), 0);
        assertEq(token1.balanceOf(address(mockSafe)), SAFE_TOKEN1 + BURNED1);
        assertEq(_spentToday(address(token0)), 0);
    }

    function test_rebalance_mintOnly_noTokenId() public {
        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, 0);
        p.tokenId = 0;
        uint256 newTokenId = _rebalance(p);

        assertEq(positionManager.modifyCount(), 1);
        assertEq(positionManager.getPositionLiquidity(newTokenId), LIQUIDITY);
        assertEq(positionManager.ownerOf(TOKEN_ID), address(mockSafe));
        assertEq(_spentToday(address(token0)), MINTED0);
    }

    /// @dev A later call that brings token0 back does not lower today's total.
    function test_rebalance_netInflowDoesNotCredit() public {
        IUniswapV4LiquidityModule.RebalanceParams memory mintOnly =
            _params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, 0);
        mintOnly.tokenId = 0;
        uint256 minted = _rebalance(mintOnly);
        assertEq(_spentToday(address(token0)), MINTED0);

        IUniswapV4LiquidityModule.RebalanceParams memory burnOnly = _params(0, 0, 0, 0, 0);
        burnOnly.tokenId = minted;
        _rebalance(burnOnly);
        assertEq(_spentToday(address(token0)), MINTED0);
    }

    function test_rebalance_dailyCapResetsNextDay() public {
        IUniswapV4LiquidityModule.RebalanceParams memory mintOnly =
            _params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, 0);
        mintOnly.tokenId = 0;
        _rebalance(mintOnly);
        _rebalance(mintOnly);
        _rebalance(mintOnly);
        _rebalance(mintOnly);
        assertEq(_spentToday(address(token0)), MAX_PER_DAY);

        vm.expectRevert("Above max per day");
        _rebalance(mintOnly);

        vm.warp(block.timestamp + 1 days);
        assertEq(_spentToday(address(token0)), 0);
        _rebalance(mintOnly);
        assertEq(_spentToday(address(token0)), MINTED0);
    }

    function test_rebalance_safeCanCall() public {
        vm.prank(address(mockSafe));
        module.rebalance(_params(0, 0, 0, 0, 0));
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_callerIsNotOperator() public {
        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(0, 0, 0, 0, 0);
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.rebalance(p);
    }

    function test_rebalance_RevertWhen_positionNotOwnedBySafe() public {
        positionManager.setPosition(TOKEN_ID, alice, key, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        vm.expectRevert("Not a Safe position");
        _rebalance(_params(0, 0, 0, 0, 0));
    }

    function test_rebalance_RevertWhen_positionInAnotherPool() public {
        PoolKey memory other = key;
        other.fee = 100;
        positionManager.setPosition(TOKEN_ID, address(mockSafe), other, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        vm.expectRevert("Wrong pool");
        _rebalance(_params(0, 0, 0, 0, 0));
    }

    /// @dev token1 has no daily cap: the module may not sell any of it.
    function test_rebalance_RevertWhen_resetSellsUncappedToken() public {
        poolManager.setSwapResult(1e18, -1e18, SQRT_PRICE_PAR + 1);
        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(0, 0, 0, 0, 1e18);
        p.tokenId = 0;
        p.resetZeroForOne = false;
        p.sqrtPriceLimitX96 = SQRT_PRICE_PAR + 1;
        vm.expectRevert("Above max per day");
        _rebalance(p);
    }

    function test_rebalance_RevertWhen_hookedPool() public {
        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(0, 0, 0, 0, 0);
        p.key.hooks = alice;
        vm.expectRevert("Hooked pool");
        _rebalance(p);
    }

    /// @dev The PositionManager refuses a mint that needs more than amount0Max.
    function test_rebalance_RevertWhen_mintNeedsMoreThanAmount0Max() public {
        positionManager.setAmounts(BURNED0, BURNED1, MINTED0, 0);
        vm.expectRevert("Safe call failed");
        _rebalance(_params(NEW_LOWER, NEW_UPPER, LIQUIDITY, uint128(MINTED0 - 1), 0));
    }

    /// @dev amount1Max = 0: a mint that needs token1 fails in the PositionManager.
    function test_rebalance_RevertWhen_mintNeedsToken1() public {
        positionManager.setAmounts(BURNED0, BURNED1, MINTED0, 1);
        vm.expectRevert("Safe call failed");
        _rebalance(_params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, 0));
    }

    function test_rebalance_RevertWhen_aboveMaxPerDay() public {
        vm.prank(address(mockSafe));
        module.setMaxPerDay(address(token0), MINTED0 - BURNED0 - 1);
        vm.expectRevert("Above max per day");
        _rebalance(_params(NEW_LOWER, NEW_UPPER, LIQUIDITY, AMOUNT0_MAX, 0));
    }

    function test_unlockCallback_RevertWhen_callerIsNotPoolManager() public {
        vm.prank(operator);
        vm.expectRevert("Not the pool manager");
        module.unlockCallback(abi.encode(key, true, RESET_AMOUNT, SQRT_PRICE_PAR));
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _modifyCall(uint8 action, bytes memory params) internal view returns (bytes memory) {
        bytes[] memory all = new bytes[](3);
        all[0] = params;
        all[1] = abi.encode(key.currency0);
        all[2] = abi.encode(key.currency1);
        return abi.encodeWithSignature(
            "modifyLiquidities(bytes,uint256)",
            abi.encode(abi.encodePacked(action, uint8(0x12), uint8(0x12)), all),
            block.timestamp
        );
    }
}
