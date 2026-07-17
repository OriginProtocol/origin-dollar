// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {Automation} from "tests/utils/artifacts/Automation.sol";

import {IMerklPoolBoosterBribesModule} from "contracts/interfaces/automation/IMerklPoolBoosterBribesModule.sol";

contract MockPoolBoosterFactory {
    uint256 public callCount;
    address[] internal lastExclusionList;

    function bribeAll(address[] calldata exclusionList) external {
        callCount++;
        delete lastExclusionList;
        for (uint256 i; i < exclusionList.length; i++) {
            lastExclusionList.push(exclusionList[i]);
        }
    }

    function getLastExclusionList() external view returns (address[] memory) {
        return lastExclusionList;
    }
}

abstract contract Unit_MerklPoolBoosterBribesModule_Shared_Test is Base {
    MockSafeContract internal mockSafe;
    MockPoolBoosterFactory internal mockFactory;
    IMerklPoolBoosterBribesModule internal module;

    function setUp() public virtual override {
        super.setUp();

        mockSafe = new MockSafeContract();
        mockFactory = new MockPoolBoosterFactory();
        module = IMerklPoolBoosterBribesModule(
            vm.deployCode(
                Automation.MERKL_POOL_BOOSTER_BRIBES_MODULE,
                abi.encode(address(mockSafe), operator, address(mockFactory))
            )
        );

        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(mockFactory), "MockPoolBoosterFactory");
        vm.label(address(module), "MerklPoolBoosterBribesModule");
    }
}
