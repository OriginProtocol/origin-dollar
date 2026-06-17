// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Project imports
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_AbstractPoolBoosterFactory_RemovePoolBooster_Test is Unit_SwapXSingle_Shared_Test {
    function test_removePoolBooster() public {
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        vm.prank(governor);
        factorySwapxSingle.removePoolBooster(booster1);

        assertEq(factorySwapxSingle.poolBoosterLength(), 0);
    }

    function test_removePoolBooster_swapAndPop() public {
        // Create 3 boosters
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);
        address booster2 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool2, 2);
        address pool3 = makeAddr("MockAmmPool3");
        address booster3 = _createSwapxSingleBooster(mockBribeContract, pool3, 3);

        assertEq(factorySwapxSingle.poolBoosterLength(), 3);

        // Remove the middle booster (booster2)
        vm.prank(governor);
        factorySwapxSingle.removePoolBooster(booster2);

        assertEq(factorySwapxSingle.poolBoosterLength(), 2);

        // First entry should still be booster1
        (address addr0,,) = factorySwapxSingle.poolBoosters(0);
        assertEq(addr0, booster1);

        // Second entry should now be booster3 (swapped from last position)
        (address addr1,,) = factorySwapxSingle.poolBoosters(1);
        assertEq(addr1, booster3);
    }

    function test_removePoolBooster_clearsMapping() public {
        _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        (address mappedAddr,,) = factorySwapxSingle.poolBoosterFromPool(mockAmmPool);
        assertTrue(mappedAddr != address(0));

        vm.prank(governor);
        factorySwapxSingle.removePoolBooster(mappedAddr);

        (address clearedAddr,,) = factorySwapxSingle.poolBoosterFromPool(mockAmmPool);
        assertEq(clearedAddr, address(0));
    }

    function test_removePoolBooster_emitsOnRegistry() public {
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterRemoved(booster1);

        vm.prank(governor);
        factorySwapxSingle.removePoolBooster(booster1);
    }

    function test_removePoolBooster_nonExistent() public {
        // Removing a non-existent address should silently do nothing
        address nonExistent = makeAddr("NonExistentBooster");

        vm.prank(governor);
        factorySwapxSingle.removePoolBooster(nonExistent);

        // No revert, length is still 0
        assertEq(factorySwapxSingle.poolBoosterLength(), 0);
    }

    function test_removePoolBooster_RevertWhen_notGovernor() public {
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factorySwapxSingle.removePoolBooster(booster1);
    }
}
