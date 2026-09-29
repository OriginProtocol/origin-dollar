// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

// --- Project imports
import {BeaconProofs} from "contracts/beacon/BeaconProofs.sol";
import {BeaconProofsForkRouter} from "contracts/beacon/BeaconProofsForkRouter.sol";
import {IBeaconProofs} from "contracts/interfaces/IBeaconProofs.sol";

contract Unit_Concrete_BeaconProofsLib_ForkRouter_Test is Unit_BeaconProofsLib_Shared_Test {
    BeaconProofsForkRouter internal router;

    function setUp() public override {
        super.setUp();

        BeaconProofs legacyBeaconProofs = new BeaconProofs();
        router = new BeaconProofsForkRouter(address(legacyBeaconProofs), address(gloasBeaconProofs), 1_000);
    }

    function test_verifyValidator_usesLegacyBeforeActivation() public view {
        uint40 validatorIndex = 100;
        bytes32 pubKeyHash = keccak256("pubkey");
        bytes32 withdrawalCredentials = keccak256("withdrawalCredentials");
        uint256 gindex = _legacyValidatorFieldGindex(validatorIndex, 0);
        bytes memory proof = _makeProofForIndex(gindex, withdrawalCredentials);
        bytes32 beaconRoot = _rootFromProof(proof, pubKeyHash, gindex);

        IBeaconProofs(address(router))
            .verifyValidator(beaconRoot, pubKeyHash, proof, validatorIndex, withdrawalCredentials);
    }

    function test_verifyValidator_fallsBackToGloasBeforeActivation() public {
        vm.warp(999);

        uint40 validatorIndex = 100;
        bytes32 pubKeyHash = keccak256("pubkey");
        bytes32 withdrawalCredentials = keccak256("withdrawalCredentials");
        uint256 gindex = beaconProofs.gloasValidatorFieldGindex(validatorIndex, 0);
        bytes memory proof = _makeProofForIndex(gindex, withdrawalCredentials);
        bytes32 beaconRoot = _rootFromProof(proof, pubKeyHash, gindex);

        IBeaconProofs(address(router))
            .verifyValidator(beaconRoot, pubKeyHash, proof, validatorIndex, withdrawalCredentials);
    }

    function test_verifyValidator_usesGloasAfterActivation() public {
        vm.warp(1_000);

        uint40 validatorIndex = 100;
        bytes32 pubKeyHash = keccak256("pubkey");
        bytes32 withdrawalCredentials = keccak256("withdrawalCredentials");
        uint256 gindex = beaconProofs.gloasValidatorFieldGindex(validatorIndex, 0);
        bytes memory proof = _makeProofForIndex(gindex, withdrawalCredentials);
        bytes32 beaconRoot = _rootFromProof(proof, pubKeyHash, gindex);

        IBeaconProofs(address(router))
            .verifyValidator(beaconRoot, pubKeyHash, proof, validatorIndex, withdrawalCredentials);
    }

    function test_verifyValidator_fallsBackToLegacyAfterActivation() public {
        vm.warp(1_000);

        uint40 validatorIndex = 100;
        bytes32 pubKeyHash = keccak256("pubkey");
        bytes32 withdrawalCredentials = keccak256("withdrawalCredentials");
        uint256 gindex = _legacyValidatorFieldGindex(validatorIndex, 0);
        bytes memory proof = _makeProofForIndex(gindex, withdrawalCredentials);
        bytes32 beaconRoot = _rootFromProof(proof, pubKeyHash, gindex);

        IBeaconProofs(address(router))
            .verifyValidator(beaconRoot, pubKeyHash, proof, validatorIndex, withdrawalCredentials);
    }

    function test_verifyValidatorBalance_returnsFallbackResult() public {
        vm.warp(1_000);

        uint40 validatorIndex = 401;
        uint64 balance = 42_000_000_000;
        bytes32 balanceLeaf = bytes32(uint256(_reverseBytes64(balance)) << 128);
        uint256 gindex = beaconProofs.gloasProgressiveListElementGindex(validatorIndex / 4);
        bytes memory proof = _makeProofForIndex(gindex, keccak256("firstWitness"));
        bytes32 balancesRoot = _rootFromProof(proof, balanceLeaf, gindex);

        uint256 balanceGwei =
            IBeaconProofs(address(router)).verifyValidatorBalance(balancesRoot, balanceLeaf, proof, validatorIndex);

        assertEq(balanceGwei, balance);
    }

    function test_verifyValidator_revertsWhenBothVerifiersReject() public {
        bytes memory proof = _makeProof(1696);
        bytes32 withdrawalCredentials;
        assembly {
            withdrawalCredentials := mload(add(proof, 32))
        }

        vm.expectRevert("Invalid validator proof");
        IBeaconProofs(address(router))
            .verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, withdrawalCredentials);
    }

    function _legacyValidatorFieldGindex(uint40 validatorIndex, uint256 fieldIndex) internal view returns (uint256) {
        uint256 validatorGindex = beaconProofs.concatGenIndices(715, 41, validatorIndex);
        return beaconProofs.concatGenIndices(validatorGindex, 3, fieldIndex);
    }

    function _reverseBytes64(uint64 v) internal pure returns (uint64) {
        return (v >> 56) | ((0x00FF000000000000 & v) >> 40) | ((0x0000FF0000000000 & v) >> 24)
            | ((0x000000FF00000000 & v) >> 8) | ((0x00000000FF000000 & v) << 8) | ((0x0000000000FF0000 & v) << 24)
            | ((0x000000000000FF00 & v) << 40) | ((0x00000000000000FF & v) << 56);
    }
}
