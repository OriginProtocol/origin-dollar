// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Rebalance_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    uint256 internal constant PULLED0 = 9_000e18;
    uint256 internal constant PULLED1 = 11_000e18;
    uint256 internal constant ADDED0 = 20_000e18;

    /// @dev A price inside [0, 5]: the position holds some token1.
    uint160 internal constant SQRT_PRICE_IN_RANGE = (SQRT_PRICE_PAR + SQRT_PRICE_TICK_5) / 2;

    function setUp() public override {
        super.setUp();
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_IN_RANGE);
        positionManager.setAmounts(PULLED0, PULLED1, ADDED0, 0);
        poolManager.setSwapResult(0, 0, SQRT_PRICE_PAR);
    }

    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_pullsResetsAndAdds() public {
        poolManager.setSwapResult(-500e18, 499e18, SQRT_PRICE_PAR);

        vm.expectCall(address(positionManager), _modifyCall(0x01, LIQUIDITY, 0));
        vm.expectCall(address(positionManager), _modifyCall(0x00, LIQUIDITY, MAX_AMOUNT0));
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.Rebalanced(TOKEN_ID, LIQUIDITY, RESET_AMOUNT0, LIQUIDITY);

        _rebalance(LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_PAR);

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), LIQUIDITY);
        assertEq(token1.balanceOf(address(mockSafe)), PULLED1 + 499e18);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + PULLED0 - 500e18 - ADDED0);
        assertEq(token0.balanceOf(address(module)), 0);
        assertEq(token1.balanceOf(address(module)), 0);
    }

    function test_rebalance_resetSwapIsExactInZeroForOneAtTheLimit() public {
        _rebalance(LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_PAR);

        (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) = poolManager.lastSwapParams();
        assertTrue(zeroForOne);
        assertEq(amountSpecified, -int256(uint256(RESET_AMOUNT0)));
        assertEq(sqrtPriceLimitX96, SQRT_PRICE_PAR);
    }

    function test_rebalance_pullOnly() public {
        _rebalance(0, 0, 0);

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
        assertEq(positionManager.modifyCount(), 1);
        assertEq(poolManager.swapCount(), 0);
        assertEq(token1.balanceOf(address(mockSafe)), PULLED1);
    }

    function test_rebalance_emptyPosition_addsWithoutPull() public {
        positionManager.setLiquidity(TOKEN_ID, 0);

        _rebalance(LIQUIDITY, 0, 0);

        assertEq(positionManager.modifyCount(), 1);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), LIQUIDITY);
    }

    function test_rebalance_safeCanCall() public {
        vm.prank(address(mockSafe));
        module.rebalance(TOKEN_ID, 0, 0, 0);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        module.rebalance(TOKEN_ID, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_notASafePosition() public {
        positionManager.setPosition(42, josh, key, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        vm.prank(operator);
        vm.expectRevert("Not a Safe position");
        module.rebalance(42, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_otherPool() public {
        PoolKey memory other = key;
        other.fee = 100;
        positionManager.setPosition(42, address(mockSafe), other, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        vm.prank(operator);
        vm.expectRevert("Wrong pool");
        module.rebalance(42, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_resetTooLarge() public {
        vm.prank(operator);
        vm.expectRevert("Reset too large");
        module.rebalance(TOKEN_ID, 0, MAX_AMOUNT0 + 1, SQRT_PRICE_PAR);
    }

    /// @dev The floor is what keeps the operator from selling OUSD below par.
    function test_rebalance_RevertWhen_priceLimitBelowFloor() public {
        vm.prank(operator);
        vm.expectRevert("Price limit below floor");
        module.rebalance(TOKEN_ID, 0, RESET_AMOUNT0, SQRT_PRICE_PAR - 1);
    }

    function test_rebalance_RevertWhen_safeCallFails() public {
        mockSafe.setShouldFail(true);
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(TOKEN_ID, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_resetPaymentFails() public {
        poolManager.setSwapResult(-500e18, 499e18, SQRT_PRICE_PAR);
        vm.mockCallRevert(
            address(token0), abi.encodeWithSelector(IERC20.transfer.selector, address(poolManager), 500e18), ""
        );
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(TOKEN_ID, 0, RESET_AMOUNT0, SQRT_PRICE_PAR);
    }

    /// @dev The add can never take token1: amount1Max is 0.
    function test_rebalance_RevertWhen_addNeedsToken1() public {
        positionManager.setAmounts(PULLED0, PULLED1, ADDED0, 1);
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(TOKEN_ID, LIQUIDITY, 0, 0);
    }

    function test_rebalance_RevertWhen_addAboveMaxAmount0() public {
        positionManager.setAmounts(PULLED0, PULLED1, uint256(MAX_AMOUNT0) + 1, 0);
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(TOKEN_ID, LIQUIDITY, 0, 0);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev The liquidity action followed by CLOSE_CURRENCY on both currencies.
    function _modifyCall(uint8 action, uint128 liquidity, uint128 amount0Limit) internal view returns (bytes memory) {
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(TOKEN_ID, uint256(liquidity), amount0Limit, uint128(0), bytes(""));
        params[1] = abi.encode(address(token0));
        params[2] = abi.encode(address(token1));
        return abi.encodeWithSelector(
            IPositionManager.modifyLiquidities.selector,
            abi.encode(abi.encodePacked(action, uint8(0x12), uint8(0x12)), params),
            block.timestamp
        );
    }
}
