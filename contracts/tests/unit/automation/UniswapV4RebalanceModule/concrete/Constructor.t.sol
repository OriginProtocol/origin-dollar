// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Constructor_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_setsImmutables() public view {
        assertEq(module.safeContract(), address(mockSafe));
        assertEq(module.poolManager(), address(poolManager));
        assertEq(module.positionManager(), address(positionManager));
        assertEq(module.poolId(), poolId);
        assertEq(module.minSqrtPriceX96(), SQRT_PRICE_PAR);
        assertEq(module.maxAmount0(), MAX_AMOUNT0);
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
        _deployModule(address(0), key);
    }

    function test_constructor_RevertWhen_hookedPool() public {
        PoolKey memory hooked = key;
        hooked.hooks = makeAddr("Hook");
        vm.expectRevert("Hooked pool");
        _deployModule(operator, hooked);
    }
}
