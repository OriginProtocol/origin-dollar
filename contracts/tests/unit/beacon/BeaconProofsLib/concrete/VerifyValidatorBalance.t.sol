// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyValidatorBalance_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroContainerRoot() public {
        bytes memory proof = _makeProof(1248);
        vm.expectRevert("Invalid container root");
        beaconProofs.verifyValidatorBalance(bytes32(0), keccak256("leaf"), proof, 0);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(1200); // Wrong: should be 1248
        vm.expectRevert("Invalid balance proof");
        beaconProofs.verifyValidatorBalance(keccak256("root"), keccak256("leaf"), proof, 0);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(1248);
        vm.expectRevert("Invalid balance proof");
        beaconProofs.verifyValidatorBalance(keccak256("root"), keccak256("leaf"), proof, 0);
    }
}
