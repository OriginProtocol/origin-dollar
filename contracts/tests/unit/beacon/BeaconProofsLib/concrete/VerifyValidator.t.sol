// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyValidator_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroBlockRoot() public {
        bytes memory proof = _makeProof(1696);
        // Set first 32 bytes to withdrawal creds we'll pass
        bytes32 withdrawalCreds = keccak256("creds");
        assembly {
            mstore(add(proof, 32), withdrawalCreds)
        }

        vm.expectRevert("Invalid block root");
        beaconProofs.verifyValidator(bytes32(0), keccak256("pubkey"), proof, 0, withdrawalCreds);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(1600); // Wrong: should be 1696
        // Must match first 32 bytes of proof (withdrawal creds) to pass that check first
        bytes32 withdrawalCreds;
        assembly {
            withdrawalCreds := mload(add(proof, 32))
        }
        vm.expectRevert("Invalid validator proof");
        beaconProofs.verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, withdrawalCreds);
    }

    function test_RevertWhen_wrongWithdrawalCredentials() public {
        bytes memory proof = _makeProof(1696);
        // Read first 32 bytes of proof via assembly
        bytes32 proofCreds;
        assembly {
            proofCreds := mload(add(proof, 32))
        }
        bytes32 wrongCreds = ~proofCreds; // Different creds

        vm.expectRevert("Invalid withdrawal cred");
        beaconProofs.verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, wrongCreds);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(1696);
        bytes32 withdrawalCreds;
        assembly {
            withdrawalCreds := mload(add(proof, 32))
        }

        // Proof is random data, so verification will fail
        vm.expectRevert("Invalid validator proof");
        beaconProofs.verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, withdrawalCreds);
    }
}
