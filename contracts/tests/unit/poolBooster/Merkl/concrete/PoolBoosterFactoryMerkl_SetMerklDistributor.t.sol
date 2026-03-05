// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";
import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_SetMerklDistributor_Test is Unit_Merkl_Shared_Test {
    function test_setMerklDistributor() public {
        address newDistributor = makeAddr("NewMerklDistributor");

        vm.prank(governor);
        factoryMerkl.setMerklDistributor(newDistributor);

        assertEq(factoryMerkl.merklDistributor(), newDistributor);
    }

    function test_setMerklDistributor_event() public {
        address newDistributor = makeAddr("NewMerklDistributor");

        vm.expectEmit(true, true, true, true);
        emit PoolBoosterFactoryMerkl.MerklDistributorUpdated(newDistributor);

        vm.prank(governor);
        factoryMerkl.setMerklDistributor(newDistributor);
    }

    function test_setMerklDistributor_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMerkl.setMerklDistributor(makeAddr("NewMerklDistributor"));
    }

    function test_setMerklDistributor_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid merklDistributor address");
        factoryMerkl.setMerklDistributor(address(0));
    }
}
