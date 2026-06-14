// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_SwapXPoolBooster_Shared_Test} from "tests/fork/sonic/poolBooster/SwapXPoolBooster/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- Project imports
import {IPoolBoosterSwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxDouble.sol";

contract Fork_Concrete_SwapXPoolBooster_RemovePoolBooster_Test is Fork_SwapXPoolBooster_Shared_Test {
    event PoolBoosterRemoved(address poolBoosterAddress);

    function test_removePoolBooster() public {
        // Create first booster
        IPoolBoosterSwapxDouble booster1 = _createDoubleBooster(
            Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_extBribeUSDC, Sonic.SwapXOsUSDCe_pool, 0.7e18, 1
        );

        // Create second booster
        _createDoubleBooster(
            Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_extBribeUSDC, Sonic.SwapXOsGEMSx_pool, 0.5e18, 2
        );

        uint256 initialLength = factorySwapxDouble.poolBoosterLength();

        // Remove the first booster
        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit PoolBoosterRemoved(address(booster1));

        vm.prank(Sonic.timelock);
        factorySwapxDouble.removePoolBooster(address(booster1));

        // Length decreased by 1
        assertEq(factorySwapxDouble.poolBoosterLength(), initialLength - 1);

        // Removed booster's pool mapping should be cleared
        (address removedAddr,,) = factorySwapxDouble.poolBoosterFromPool(Sonic.SwapXOsUSDCe_pool);
        assertEq(removedAddr, address(0));

        // The second booster should still be accessible
        (address remainingAddr, address remainingPool,) =
            factorySwapxDouble.poolBoosterFromPool(Sonic.SwapXOsGEMSx_pool);
        assertTrue(remainingAddr != address(0));
        assertEq(remainingPool, Sonic.SwapXOsGEMSx_pool);
    }
}
