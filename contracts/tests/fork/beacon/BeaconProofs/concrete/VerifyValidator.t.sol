// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_BeaconProofs_Shared_Test} from "../shared/Shared.t.sol";

contract Fork_Concrete_BeaconProofs_VerifyValidator_Test is Fork_BeaconProofs_Shared_Test {
    function test_verifyValidator() public view {
        assertEq(_hashPubKey(validatorPubKeyVector.pubKey), validatorPubKeyVector.pubKeyHash, "pubkey hash mismatch");
        assertEq(validatorPubKeyVector.withdrawalCredential, EXITED_WITHDRAWAL_CREDENTIAL, "wrong withdrawal cred");

        beaconProofs.verifyValidator(
            beaconBlockRoot,
            validatorPubKeyVector.pubKeyHash,
            validatorPubKeyVector.proof,
            validatorPubKeyVector.validatorIndex,
            validatorPubKeyVector.withdrawalCredential
        );
    }

    function test_verifyValidator_RevertWhen_corruptedProof() public {
        bytes memory corruptedProof = _corruptProof(validatorPubKeyVector.proof, 64);

        vm.expectRevert("Invalid validator proof");
        beaconProofs.verifyValidator(
            beaconBlockRoot,
            validatorPubKeyVector.pubKeyHash,
            corruptedProof,
            validatorPubKeyVector.validatorIndex,
            validatorPubKeyVector.withdrawalCredential
        );
    }
}
