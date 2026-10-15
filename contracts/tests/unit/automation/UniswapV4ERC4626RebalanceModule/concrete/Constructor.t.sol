// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4ERC4626RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4ERC4626RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

contract Unit_Concrete_UniswapV4ERC4626RebalanceModule_Constructor_Test is
    Unit_UniswapV4ERC4626RebalanceModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_setsImmutables() public view {
        assertEq(module.safeContract(), address(mockSafe));
        assertEq(module.poolManager(), address(poolManager));
        assertEq(module.positionManager(), address(positionManager));
        assertEq(module.currency0(), address(token0));
        assertEq(module.currency1(), address(token1));
        assertEq(module.poolId(), poolId);
        assertEq(keccak256(abi.encode(module.poolKey())), poolId);
        assertEq(module.maxAmount0(), MAX_AMOUNT0);
        assertEq(module.navToleranceBps(), NAV_TOLERANCE_BPS);
    }

    function test_constructor_grantsRoles() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(mockSafe)));
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_navPriceX192() public {
        assertEq(module.navPriceX192(), (SHARES_PER_ASSET << 192) / 1e18);
        token1.setSharesPerAsset(0.79e18);
        assertEq(module.navPriceX192(), (uint256(0.79e18) << 192) / 1e18);
    }

    function test_navFloorX192() public view {
        uint256 nav = module.navPriceX192();
        assertEq(module.navFloorX192(), (nav * 9_999) / 10_000);
        assertGe(uint256(SQRT_PRICE_FLOOR) ** 2, module.navFloorX192());
        assertLt(uint256(SQRT_PRICE_FLOOR - 1) ** 2, module.navFloorX192());
    }

    function test_navFloorX192_zeroTolerance() public {
        assertEq(_deployModule(operator, key, 0).navFloorX192(), module.navPriceX192());
    }

    function test_poolSqrtPriceX96() public {
        assertEq(module.poolSqrtPriceX96(), SQRT_PRICE_NAV);
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_NAV + 1);
        assertEq(module.poolSqrtPriceX96(), SQRT_PRICE_NAV + 1);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_RevertWhen_operatorIsZero() public {
        vm.expectRevert("Invalid operator");
        _deployModule(address(0), key, NAV_TOLERANCE_BPS);
    }

    function test_constructor_RevertWhen_hookedPool() public {
        PoolKey memory hooked = key;
        hooked.hooks = makeAddr("Hook");
        vm.expectRevert("Hooked pool");
        _deployModule(operator, hooked, NAV_TOLERANCE_BPS);
    }

    function test_constructor_RevertWhen_toleranceTooHigh() public {
        vm.expectRevert("Tolerance too high");
        _deployModule(operator, key, 11);
    }
}
