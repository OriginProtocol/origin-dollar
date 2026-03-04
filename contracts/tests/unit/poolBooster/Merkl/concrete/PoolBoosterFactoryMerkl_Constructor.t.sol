// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";
import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_Constructor_Test is Unit_Merkl_Shared_Test {
    function test_constructor() public view {
        assertEq(factoryMerkl.oToken(), address(oeth));
        assertEq(factoryMerkl.governor(), governor);
        assertEq(address(factoryMerkl.centralRegistry()), address(centralRegistry));
        assertEq(factoryMerkl.version(), 1);
        assertEq(factoryMerkl.merklDistributor(), mockMerklDistributor);
    }

    function test_constructor_event() public {
        vm.expectEmit(true, true, true, true);
        emit PoolBoosterFactoryMerkl.MerklDistributorUpdated(mockMerklDistributor);

        new PoolBoosterFactoryMerkl(
            address(oeth),
            governor,
            address(centralRegistry),
            mockMerklDistributor
        );
    }

    function test_constructor_RevertWhen_zeroOToken() public {
        vm.expectRevert("Invalid oToken address");
        new PoolBoosterFactoryMerkl(address(0), governor, address(centralRegistry), mockMerklDistributor);
    }

    function test_constructor_RevertWhen_zeroGovernor() public {
        vm.expectRevert("Invalid governor address");
        new PoolBoosterFactoryMerkl(address(oeth), address(0), address(centralRegistry), mockMerklDistributor);
    }

    function test_constructor_RevertWhen_zeroCentralRegistry() public {
        vm.expectRevert("Invalid central registry address");
        new PoolBoosterFactoryMerkl(address(oeth), governor, address(0), mockMerklDistributor);
    }
}
