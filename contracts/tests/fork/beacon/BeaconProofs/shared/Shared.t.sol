// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {EnhancedBeaconProofs} from "contracts/mocks/beacon/EnhancedBeaconProofs.sol";

abstract contract Fork_BeaconProofs_Shared_Test is BaseFork {
    using stdJson for string;

    // Test-only DTOs for the JSON payload returned by test/scripts/beaconProofsFixture.js.
    // Each struct mirrors one proof vector shape consumed by BeaconProofs.sol.
    struct ValidatorPubKeyVector {
        uint40 validatorIndex;
        bytes32 pubKeyHash;
        bytes proof;
        bytes pubKey;
        bytes32 withdrawalCredential;
    }

    // Shared shape for verifyValidatorWithdrawable() proof vectors.
    struct ValidatorWithdrawableVector {
        uint40 validatorIndex;
        uint64 withdrawableEpoch;
        bytes proof;
    }

    // Shared shape for container proofs such as balances and pending deposits.
    struct ContainerVector {
        bytes32 leaf;
        bytes proof;
    }

    // Full input plus expected output for verifyValidatorBalance().
    struct BalanceVector {
        uint40 validatorIndex;
        bytes32 root;
        bytes32 leaf;
        bytes proof;
        uint256 balance;
    }

    // Full input for verifyPendingDeposit().
    struct PendingDepositVector {
        uint32 depositIndex;
        bytes32 root;
        bytes32 leaf;
        bytes proof;
    }

    // Full input for verifyFirstPendingDeposit(), plus fixture metadata for sanity checks.
    struct FirstPendingDepositVector {
        uint64 slot;
        bytes32 root;
        bytes32 leaf;
        bytes proof;
        bool isEmpty;
    }

    uint256 internal constant DEFAULT_SLOT = 12_235_962;
    bytes32 internal constant EXITED_WITHDRAWAL_CREDENTIAL =
        0x020000000000000000000000f80432285c9d2055449330bbd7686a5ecf2a7247;

    EnhancedBeaconProofs internal beaconProofs;

    uint256 internal proofSlot;
    bytes32 internal beaconBlockRoot;
    ValidatorPubKeyVector internal validatorPubKeyVector;
    ValidatorWithdrawableVector internal nonExitingWithdrawableVector;
    ValidatorWithdrawableVector internal exitedWithdrawableVector;
    ContainerVector internal balancesContainerVector;
    BalanceVector internal validatorBalanceVector;
    ContainerVector internal pendingDepositsContainerVector;
    PendingDepositVector internal pendingDepositVector;
    FirstPendingDepositVector internal firstPendingDepositVector;

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();

        beaconProofs = new EnhancedBeaconProofs();

        _loadProofFixture();
        _labelContracts();
    }

    function _labelContracts() internal {
        vm.label(address(beaconProofs), "EnhancedBeaconProofs");
    }

    function _loadProofFixture() internal {
        uint256 slot = vm.envExists("BEACON_PROOFS_SLOT") ? vm.envUint("BEACON_PROOFS_SLOT") : DEFAULT_SLOT;

        string[] memory cmd = new string[](3);
        cmd[0] = "node";
        cmd[1] = string.concat(vm.projectRoot(), "/test/scripts/beaconProofsFixture.js");
        cmd[2] = vm.toString(slot);

        string memory json = string(vm.ffi(cmd));

        proofSlot = vm.parseUint(json.readString(".slot"));
        beaconBlockRoot = json.readBytes32(".beaconBlockRoot");

        validatorPubKeyVector = ValidatorPubKeyVector({
            validatorIndex: uint40(vm.parseUint(json.readString(".validatorPubKey.validatorIndex"))),
            pubKeyHash: json.readBytes32(".validatorPubKey.pubKeyHash"),
            proof: json.readBytes(".validatorPubKey.proof"),
            pubKey: json.readBytes(".validatorPubKey.pubKey"),
            withdrawalCredential: json.readBytes32(".validatorPubKey.withdrawalCredential")
        });

        nonExitingWithdrawableVector = ValidatorWithdrawableVector({
            validatorIndex: uint40(vm.parseUint(json.readString(".validatorWithdrawableNonExiting.validatorIndex"))),
            withdrawableEpoch: uint64(
                vm.parseUint(json.readString(".validatorWithdrawableNonExiting.withdrawableEpoch"))
            ),
            proof: json.readBytes(".validatorWithdrawableNonExiting.proof")
        });

        exitedWithdrawableVector = ValidatorWithdrawableVector({
            validatorIndex: uint40(vm.parseUint(json.readString(".validatorWithdrawableExited.validatorIndex"))),
            withdrawableEpoch: uint64(vm.parseUint(json.readString(".validatorWithdrawableExited.withdrawableEpoch"))),
            proof: json.readBytes(".validatorWithdrawableExited.proof")
        });

        balancesContainerVector = ContainerVector({
            leaf: json.readBytes32(".balancesContainer.leaf"), proof: json.readBytes(".balancesContainer.proof")
        });

        validatorBalanceVector = BalanceVector({
            validatorIndex: uint40(vm.parseUint(json.readString(".validatorBalance.validatorIndex"))),
            root: json.readBytes32(".validatorBalance.root"),
            leaf: json.readBytes32(".validatorBalance.leaf"),
            proof: json.readBytes(".validatorBalance.proof"),
            balance: vm.parseUint(json.readString(".validatorBalance.balance"))
        });

        pendingDepositsContainerVector = ContainerVector({
            leaf: json.readBytes32(".pendingDepositsContainer.leaf"),
            proof: json.readBytes(".pendingDepositsContainer.proof")
        });

        pendingDepositVector = PendingDepositVector({
            depositIndex: uint32(vm.parseUint(json.readString(".pendingDeposit.depositIndex"))),
            root: json.readBytes32(".pendingDeposit.root"),
            leaf: json.readBytes32(".pendingDeposit.leaf"),
            proof: json.readBytes(".pendingDeposit.proof")
        });

        firstPendingDepositVector = FirstPendingDepositVector({
            slot: uint64(vm.parseUint(json.readString(".firstPendingDeposit.slot"))),
            root: json.readBytes32(".firstPendingDeposit.root"),
            leaf: json.readBytes32(".firstPendingDeposit.leaf"),
            proof: json.readBytes(".firstPendingDeposit.proof"),
            isEmpty: json.readBool(".firstPendingDeposit.isEmpty")
        });
    }

    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    function _corruptProof(bytes memory proof, uint256 byteIndex) internal pure returns (bytes memory) {
        bytes memory corrupted = proof;
        corrupted[byteIndex] = bytes1(uint8(corrupted[byteIndex]) ^ 0x01);
        return corrupted;
    }
}
