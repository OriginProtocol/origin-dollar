// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

// --- Project imports
import {Endian} from "contracts/beacon/Endian.sol";

contract Unit_Concrete_BeaconProofsLib_GloasProofVerification_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_verifyValidator_acceptsGloasProgressivePath() public view {
        uint40 validatorIndex = 100;
        bytes32 pubKeyHash = keccak256("pubkey");
        bytes32 withdrawalCredentials = keccak256("withdrawalCredentials");
        uint256 gindex = beaconProofs.gloasValidatorFieldGindex(validatorIndex, 0);
        bytes memory proof = _makeProofForIndex(gindex, withdrawalCredentials);
        bytes32 beaconRoot = _rootFromProof(proof, pubKeyHash, gindex);

        gloasBeaconProofs.verifyValidator(beaconRoot, pubKeyHash, proof, validatorIndex, withdrawalCredentials);
    }

    function test_verifyValidatorWithdrawable_acceptsGloasProgressivePath() public view {
        uint40 validatorIndex = 1_000;
        uint64 withdrawableEpoch = 123456;
        uint256 gindex = beaconProofs.gloasValidatorFieldGindex(validatorIndex, 7);
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 beaconRoot = _rootFromProof(proof, Endian.toLittleEndianUint64(withdrawableEpoch), gindex);

        gloasBeaconProofs.verifyValidatorWithdrawable(beaconRoot, validatorIndex, withdrawableEpoch, proof);
    }

    function test_verifyBalancesContainer_acceptsGloasProgressivePath() public view {
        bytes32 balancesRoot = keccak256("balancesRoot");
        uint256 gindex = beaconProofs.gloasBalancesContainerGindex();
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 beaconRoot = _rootFromProof(proof, balancesRoot, gindex);

        gloasBeaconProofs.verifyBalancesContainer(beaconRoot, balancesRoot, proof);
    }

    function test_verifyValidatorBalance_acceptsGloasProgressivePath() public view {
        uint40 validatorIndex = 401;
        uint64 balance = 42_000_000_000;
        bytes32 balanceLeaf = bytes32(uint256(_reverseBytes64(balance)) << 128);
        uint256 gindex = beaconProofs.gloasProgressiveListElementGindex(validatorIndex / 4);
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 balancesRoot = _rootFromProof(proof, balanceLeaf, gindex);

        uint256 balanceGwei = gloasBeaconProofs.verifyValidatorBalance(balancesRoot, balanceLeaf, proof, validatorIndex);

        assertEq(balanceGwei, balance);
    }

    function test_verifyPendingDepositsContainer_acceptsGloasProgressivePath() public view {
        bytes32 pendingDepositsRoot = keccak256("pendingDepositsRoot");
        uint256 gindex = beaconProofs.gloasPendingDepositsContainerGindex();
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 beaconRoot = _rootFromProof(proof, pendingDepositsRoot, gindex);

        gloasBeaconProofs.verifyPendingDepositsContainer(beaconRoot, pendingDepositsRoot, proof);
    }

    function test_verifyPendingDeposit_acceptsGloasProgressivePath() public view {
        uint32 pendingDepositIndex = 100;
        bytes32 pendingDepositRoot = keccak256("pendingDepositRoot");
        uint256 gindex = beaconProofs.gloasProgressiveListElementGindex(pendingDepositIndex);
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 pendingDepositsRoot = _rootFromProof(proof, pendingDepositRoot, gindex);

        gloasBeaconProofs.verifyPendingDeposit(pendingDepositsRoot, pendingDepositRoot, proof, pendingDepositIndex);
    }

    function test_verifyFirstPendingDeposit_acceptsGloasSlotPath() public view {
        uint64 slot = 987654;
        uint256 gindex = beaconProofs.gloasPendingDepositGindex(0);
        gindex = beaconProofs.concatGenIndices(gindex, 3, 4);
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 beaconRoot = _rootFromProof(proof, Endian.toLittleEndianUint64(slot), gindex);

        bool isEmpty = gloasBeaconProofs.verifyFirstPendingDeposit(beaconRoot, slot, proof);

        assertFalse(isEmpty);
    }

    function test_verifyFirstPendingDeposit_acceptsGloasEmptyQueuePath() public view {
        uint256 gindex = beaconProofs.gloasPendingDepositGindex(0);
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 beaconRoot = _rootFromProof(proof, bytes32(0), gindex);

        bool isEmpty = gloasBeaconProofs.verifyFirstPendingDeposit(beaconRoot, 0, proof);

        assertTrue(isEmpty);
    }

    function test_verifyValidator_RevertWhen_invalidGloasProof() public {
        uint40 validatorIndex = 100;
        bytes32 pubKeyHash = keccak256("pubkey");
        bytes32 withdrawalCredentials = keccak256("withdrawalCredentials");
        uint256 gindex = beaconProofs.gloasValidatorFieldGindex(validatorIndex, 0);
        bytes memory proof = _makeProofForIndex(gindex, withdrawalCredentials);

        vm.expectRevert("Invalid validator proof");
        gloasBeaconProofs.verifyValidator(
            keccak256("wrongRoot"), pubKeyHash, proof, validatorIndex, withdrawalCredentials
        );
    }

    function _reverseBytes64(uint64 v) internal pure returns (uint64) {
        return (v >> 56) | ((0x00FF000000000000 & v) >> 40) | ((0x0000FF0000000000 & v) >> 24)
            | ((0x000000FF00000000 & v) >> 8) | ((0x00000000FF000000 & v) << 8) | ((0x0000000000FF0000 & v) << 24)
            | ((0x000000000000FF00 & v) << 40) | ((0x00000000000000FF & v) << 56);
    }
}
