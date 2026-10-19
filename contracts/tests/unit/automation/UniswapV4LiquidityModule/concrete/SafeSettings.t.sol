// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4LiquidityModule_Shared_Test
} from "tests/unit/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

contract Unit_Concrete_UniswapV4LiquidityModule_SafeSettings_Test is Unit_UniswapV4LiquidityModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_allowPool_allowsAndEmits() public {
        PoolKey memory other = key;
        other.fee = 100;
        bytes32 otherId = keccak256(abi.encode(other));

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4LiquidityModule.PoolAllowed(otherId, other);
        vm.prank(address(mockSafe));
        module.allowPool(other);

        assertTrue(module.isPoolAllowed(otherId));
    }

    function test_revokePool_revokesAndEmits() public {
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4LiquidityModule.PoolRevoked(poolId);
        vm.prank(address(mockSafe));
        module.revokePool(poolId);

        assertFalse(module.isPoolAllowed(poolId));
    }

    function test_setMaxPerCall_setsAndEmits() public {
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4LiquidityModule.MaxPerCallSet(address(token1), 5e18);
        vm.prank(address(mockSafe));
        module.setMaxPerCall(address(token1), 5e18);

        assertEq(module.maxPerCall(address(token1)), 5e18);
    }

    function test_setMaxPerDay_setsAndEmits() public {
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4LiquidityModule.MaxPerDaySet(address(token1), 7e18);
        vm.prank(address(mockSafe));
        module.setMaxPerDay(address(token1), 7e18);

        assertEq(module.maxPerDay(address(token1)), 7e18);
        assertEq(module.remainingToday(address(token1)), 7e18);
    }

    function test_setPaused_pausesAndUnpauses() public {
        vm.expectEmit(false, false, false, true, address(module));
        emit IUniswapV4LiquidityModule.PausedSet(true);
        vm.prank(address(mockSafe));
        module.setPaused(true);
        assertTrue(module.paused());

        vm.prank(address(mockSafe));
        module.setPaused(false);
        assertFalse(module.paused());
    }

    function test_poolSqrtPriceX96_readsSlot0() public view {
        assertEq(module.poolSqrtPriceX96(poolId), SQRT_PRICE_PAR);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_allowPool_RevertWhen_hooked() public {
        PoolKey memory hooked = key;
        hooked.hooks = alice;
        vm.prank(address(mockSafe));
        vm.expectRevert("Hooked pool");
        module.allowPool(hooked);
    }

    function test_allowPool_RevertWhen_nativeCurrency() public {
        PoolKey memory native = key;
        native.currency0 = address(0);
        vm.prank(address(mockSafe));
        vm.expectRevert("Native currency");
        module.allowPool(native);
    }

    function test_settings_RevertWhen_callerIsNotSafe() public {
        vm.startPrank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.allowPool(key);
        vm.expectRevert("Caller is not the safe contract");
        module.revokePool(poolId);
        vm.expectRevert("Caller is not the safe contract");
        module.setMaxPerCall(address(token0), 1);
        vm.expectRevert("Caller is not the safe contract");
        module.setMaxPerDay(address(token0), 1);
        vm.expectRevert("Caller is not the safe contract");
        module.setPaused(true);
        vm.stopPrank();
    }
}
