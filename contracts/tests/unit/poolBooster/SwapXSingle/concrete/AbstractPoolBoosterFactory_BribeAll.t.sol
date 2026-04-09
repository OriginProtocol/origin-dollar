// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Project imports
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

contract Unit_Concrete_AbstractPoolBoosterFactory_BribeAll_Test is Unit_SwapXSingle_Shared_Test {
    function test_bribeAll() public {
        // Create 2 boosters
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);
        address booster2 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool2, 2);

        // Mock bribe() on each deployed booster
        vm.mockCall(booster1, abi.encodeWithSelector(IPoolBooster.bribe.selector), abi.encode());
        vm.mockCall(booster2, abi.encodeWithSelector(IPoolBooster.bribe.selector), abi.encode());

        // Call bribeAll with empty exclusion list
        address[] memory exclusionList = new address[](0);
        factorySwapxSingle.bribeAll(exclusionList);
    }

    function test_bribeAll_withExclusion() public {
        // Create 2 boosters
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);
        address booster2 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool2, 2);

        // Mock bribe() only on booster2 (booster1 is excluded)
        vm.mockCall(booster2, abi.encodeWithSelector(IPoolBooster.bribe.selector), abi.encode());

        // Exclude booster1
        address[] memory exclusionList = new address[](1);
        exclusionList[0] = booster1;
        factorySwapxSingle.bribeAll(exclusionList);
    }

    function test_bribeAll_emptyList() public {
        // No boosters created, should succeed with empty exclusion
        address[] memory exclusionList = new address[](0);
        factorySwapxSingle.bribeAll(exclusionList);
    }

    function test_bribeAll_allExcluded() public {
        // Create 2 boosters
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);
        address booster2 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool2, 2);

        // Exclude all boosters - no bribe() calls should be made
        address[] memory exclusionList = new address[](2);
        exclusionList[0] = booster1;
        exclusionList[1] = booster2;
        factorySwapxSingle.bribeAll(exclusionList);
    }

    function test_bribeAll_anyoneCanCall() public {
        // Create a booster
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        // Mock bribe() on the deployed booster
        vm.mockCall(booster1, abi.encodeWithSelector(IPoolBooster.bribe.selector), abi.encode());

        // Alice (non-governor) can call bribeAll
        address[] memory exclusionList = new address[](0);
        vm.prank(alice);
        factorySwapxSingle.bribeAll(exclusionList);
    }
}
