// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4LiquidityModule_Shared_Test
} from "tests/unit/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

contract Unit_Concrete_UniswapV4LiquidityModule_Constructor_Test is Unit_UniswapV4LiquidityModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_setsAddressesAndRoles() public view {
        assertEq(module.safeContract(), address(mockSafe));
        assertEq(module.poolManager(), address(poolManager));
        assertEq(module.positionManager(), address(positionManager));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(mockSafe)));
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
        assertFalse(module.paused());
    }

    function test_constructor_startsWithNoPoolAndNoCaps() public {
        module = _deployModule(operator);
        assertFalse(module.isPoolAllowed(poolId));
        assertEq(module.maxPerCall(address(token0)), 0);
        assertEq(module.maxPerDay(address(token0)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_RevertWhen_operatorIsZero() public {
        vm.expectRevert("Invalid operator");
        vm.deployCode(
            Automation.UNISWAP_V4_LIQUIDITY_MODULE,
            abi.encode(address(mockSafe), address(0), address(poolManager), address(positionManager))
        );
    }

    function test_constructor_RevertWhen_poolManagerIsZero() public {
        vm.expectRevert("Invalid pool manager");
        vm.deployCode(
            Automation.UNISWAP_V4_LIQUIDITY_MODULE,
            abi.encode(address(mockSafe), operator, address(0), address(positionManager))
        );
    }

    function test_constructor_RevertWhen_positionManagerIsZero() public {
        vm.expectRevert("Invalid position manager");
        vm.deployCode(
            Automation.UNISWAP_V4_LIQUIDITY_MODULE,
            abi.encode(address(mockSafe), operator, address(poolManager), address(0))
        );
    }
}
