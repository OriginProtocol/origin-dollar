// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Constructor_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_setsImmutables() public view {
        assertEq(module.safeContract(), address(mockSafe));
        assertEq(module.poolManager(), address(poolManager));
        assertEq(module.positionManager(), address(positionManager));
        assertEq(module.permit2(), address(permit2));
        assertFalse(module.paused());
    }

    function test_constructor_grantsRoles() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(mockSafe)));
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_RevertWhen_operatorIsZero() public {
        vm.expectRevert("Invalid operator");
        _deploy(address(0), address(poolManager), address(positionManager), address(permit2));
    }

    function test_constructor_RevertWhen_poolManagerHasNoCode() public {
        vm.expectRevert("Invalid pool manager");
        _deploy(operator, makeAddr("EOA"), address(positionManager), address(permit2));
    }

    function test_constructor_RevertWhen_positionManagerHasNoCode() public {
        vm.expectRevert("Invalid position manager");
        _deploy(operator, address(poolManager), makeAddr("EOA"), address(permit2));
    }

    function test_constructor_RevertWhen_permit2HasNoCode() public {
        vm.expectRevert("Invalid permit2");
        _deploy(operator, address(poolManager), address(positionManager), makeAddr("EOA"));
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _deploy(address _operator, address _poolManager, address _positionManager, address _permit2) internal {
        vm.deployCode(
            Automation.UNISWAP_V4_REBALANCE_MODULE,
            abi.encode(address(mockSafe), _operator, _poolManager, _positionManager, _permit2)
        );
    }
}
