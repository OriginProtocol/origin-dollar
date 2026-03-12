// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyBalancesContainer_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroBlockRoot() public {
        bytes memory proof = _makeProof(288);
        vm.expectRevert("Invalid block root");
        beaconProofs.verifyBalancesContainer(bytes32(0), keccak256("balances"), proof);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(256); // Wrong: should be 288
        vm.expectRevert("Invalid balance container proof");
        beaconProofs.verifyBalancesContainer(keccak256("root"), keccak256("balances"), proof);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(288);
        vm.expectRevert("Invalid balance container proof");
        beaconProofs.verifyBalancesContainer(keccak256("root"), keccak256("balances"), proof);
    }
}
