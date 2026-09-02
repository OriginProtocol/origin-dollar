// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {
    CompoundingBalanceProofs as BalanceProofs,
    CompoundingFirstPendingDepositSlotProofData as FirstPendingDepositSlotProofData,
    CompoundingPendingDepositProofs as PendingDepositProofs,
    CompoundingStrategyValidatorProofData as StrategyValidatorProofData,
    CompoundingValidatorStakeData as ValidatorStakeData
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";
import {EnhancedBeaconProofs} from "contracts/mocks/beacon/EnhancedBeaconProofs.sol";
import {CompoundingStakingStrategyView} from "contracts/strategies/NativeStaking/CompoundingStakingView.sol";
import {Unit_CompoundingStakingStrategy_Shared_Test} from "./Shared.t.sol";

abstract contract Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test is
    Unit_CompoundingStakingStrategy_Shared_Test
{
    using stdJson for string;

    address internal constant HISTORICAL_STRATEGY_ADDRESS = 0x840081c97256d553A8F234D469D797B9535a3B49;
    uint256 internal constant DEPOSITS_MAPPING_SLOT = 52;
    uint256 internal constant DEPOSIT_LIST_DATA_SLOT =
        0xcfa4bec1d3298408bb5afcfcd9c430549c5b31f8aa5c5848151c0a55f473c34d;
    uint256 internal constant VALIDATOR_COUNT = 21;

    EnhancedBeaconProofs internal enhancedBeaconProofs;
    string internal validatorsJson;
    bytes32[] internal historicalPendingDepositRoots;

    struct HistoricalSnapshot {
        bytes32 blockRoot;
        BalanceProofs balanceProofs;
        string[] validatorBalances;
        bytes32 pendingDepositContainerRoot;
        bytes pendingDepositContainerProof;
        uint32[] pendingDepositIndexes;
        bytes[] pendingDepositProofs;
    }

    struct BalanceTotals {
        uint256 totalDepositsWei;
        uint256 totalValidatorBalance;
        uint256 ethBalance;
        uint256 wethBalance;
        uint256 totalBalance;
    }

    function setUp() public virtual override {
        super.setUp();
        validatorsJson = vm.readFile(VALIDATORS_JSON_PATH);
        vm.label(address(enhancedBeaconProofs), "EnhancedBeaconProofs");
        _prepareTwentyOneValidators();
        historicalPendingDepositRoots =
            validatorsJson.readBytes32Array(".testBalancesProofs[5].pendingDepositProofsData.pendingDepositRoots");
    }

    function _deployBeaconProofs() internal override returns (address beaconProofsAddress) {
        enhancedBeaconProofs = new EnhancedBeaconProofs();
        beaconProofsAddress = address(enhancedBeaconProofs);
    }

    function _deployStrategy(address beaconProofsAddress) internal override returns (address strategyAddress) {
        deployCodeTo(
            Strategies.COMPOUNDING_STAKING_STRATEGY,
            abi.encode(
                address(0),
                address(oethVault),
                address(mockWeth),
                address(mockDepositContract),
                beaconProofsAddress,
                BEACON_GENESIS_TIMESTAMP
            ),
            HISTORICAL_STRATEGY_ADDRESS
        );
        strategyAddress = HISTORICAL_STRATEGY_ADDRESS;
    }

    function _prepareTwentyOneValidators() internal virtual {
        for (uint256 i = 0; i < VALIDATOR_COUNT; ++i) {
            this.processHistoricalValidator(i);
        }

        assertEq(compoundingStakingStrategy.verifiedValidatorsLength(), VALIDATOR_COUNT);
        assertEq(compoundingStakingStrategy.depositListLength(), 0);
    }

    function processHistoricalValidator(uint256 i) external {
        require(msg.sender == address(this), "only self");
        assertEq(_hashPubKey(testValidators[i].publicKey), testValidators[i].publicKeyHash, "public key hash");
        bytes32 pendingDepositRoot = _stakeNewValidator(i);
        _verifyHistoricalValidator(i);
        _verifyHistoricalDeposit(i, pendingDepositRoot);
        uint64 historicalAmountGwei = _historicalDepositAmountGwei(i);
        _topUpValidator(i, historicalAmountGwei - uint64(INITIAL_DEPOSIT_AMOUNT / 1 gwei), true);
    }

    function _verifyHistoricalValidator(uint256 validatorPosition) internal {
        _verifyHistoricalValidatorProof(
            validatorPosition, bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), HISTORICAL_STRATEGY_ADDRESS))
        );
    }

    function _verifyHistoricalValidatorProof(uint256 validatorPosition, bytes32 withdrawalCredentials) internal {
        (uint64 nextBlockTimestamp, bytes32 beaconBlockRoot, bytes memory proof) =
            _loadHistoricalValidatorProof(validatorPosition);

        mockBeaconRootsContract.setBeaconRoot(nextBlockTimestamp, beaconBlockRoot);
        compoundingStakingStrategy.verifyValidator(
            nextBlockTimestamp,
            uint40(testValidators[validatorPosition].index),
            testValidators[validatorPosition].publicKeyHash,
            withdrawalCredentials,
            proof
        );
    }

    function _loadHistoricalValidatorProof(uint256 validatorPosition)
        internal
        view
        returns (uint64 nextBlockTimestamp, bytes32 beaconBlockRoot, bytes memory proof)
    {
        string memory base = string.concat(".testValidators[", vm.toString(validatorPosition), "].validatorProof");
        nextBlockTimestamp = uint64(validatorsJson.readUint(string.concat(base, ".nextBlockTimestamp")));
        beaconBlockRoot = validatorsJson.readBytes32(string.concat(base, ".root"));
        proof = validatorsJson.readBytes(string.concat(base, ".bytes"));
    }

    function _verifyHistoricalDeposit(uint256 validatorPosition, bytes32 pendingDepositRoot) internal {
        string memory base = string.concat(".testValidators[", vm.toString(validatorPosition), "].depositProof");
        uint64 processedSlot = uint64(validatorsJson.readUint(string.concat(base, ".depositProcessedSlot")));
        bytes32 processedBlockRoot = validatorsJson.readBytes32(string.concat(base, ".processedBeaconBlockRoot"));

        FirstPendingDepositSlotProofData memory firstPending = FirstPendingDepositSlotProofData({
            slot: uint64(validatorsJson.readUint(string.concat(base, ".firstPendingDeposit.slot"))),
            proof: validatorsJson.readBytes(string.concat(base, ".firstPendingDeposit.proof"))
        });
        StrategyValidatorProofData memory strategyValidator = StrategyValidatorProofData({
            withdrawableEpoch: uint64(
                validatorsJson.readUint(string.concat(base, ".strategyValidator.withdrawableEpoch"))
            ),
            withdrawableEpochProof: validatorsJson.readBytes(
                string.concat(base, ".strategyValidator.withdrawableEpochProof")
            )
        });

        mockBeaconRootsContract.setBeaconRoot(_calcNextBlockTimestamp(processedSlot), processedBlockRoot);
        compoundingStakingStrategy.verifyDeposit(pendingDepositRoot, processedSlot, firstPending, strategyValidator);
    }

    function _topUpValidator(uint256 validatorPosition, uint64 amountGwei, bool verifyDeposit)
        internal
        returns (bytes32 pendingDepositRoot)
    {
        // The legacy test mined each top-up in a new block. Keep the Beacon deposit slot
        // distinct so equal amounts to the same validator produce distinct roots.
        vm.warp(block.timestamp + SLOT_DURATION);
        TestValidator storage validatorData = testValidators[validatorPosition];
        _depositToStrategy(uint256(amountGwei) * 1 gwei);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: validatorData.publicKey,
            signature: validatorData.signature,
            depositDataRoot: validatorData.depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingStrategy.stakeEth(stakeData, amountGwei);
        pendingDepositRoot = compoundingStakingStrategy.depositList(compoundingStakingStrategy.depositListLength() - 1);

        if (verifyDeposit) {
            _verifyHistoricalDeposit(validatorPosition, pendingDepositRoot);
        }
    }

    function topUpHistoricalValidator(uint256 validatorPosition, uint64 amountGwei) external {
        require(msg.sender == address(this), "only self");
        _topUpValidator(validatorPosition, amountGwei, false);
    }

    function _loadHistoricalSnapshot(uint256 snapshotIndex) internal view returns (HistoricalSnapshot memory snapshot) {
        string memory base = string.concat(".testBalancesProofs[", vm.toString(snapshotIndex), "]");
        string memory balancesBase = string.concat(base, ".balanceProofs");
        string memory depositsBase = string.concat(base, ".pendingDepositProofsData");

        snapshot.blockRoot = validatorsJson.readBytes32(string.concat(base, ".blockRoot"));
        snapshot.balanceProofs = BalanceProofs({
            balancesContainerRoot: validatorsJson.readBytes32(string.concat(balancesBase, ".balancesContainerRoot")),
            balancesContainerProof: validatorsJson.readBytes(string.concat(balancesBase, ".balancesContainerProof")),
            validatorBalanceLeaves: validatorsJson.readBytes32Array(
                string.concat(balancesBase, ".validatorBalanceLeaves")
            ),
            validatorBalanceProofs: validatorsJson.readBytesArray(
                string.concat(balancesBase, ".validatorBalanceProofs")
            )
        });
        snapshot.validatorBalances = validatorsJson.readStringArray(string.concat(base, ".validatorBalances"));
        snapshot.pendingDepositContainerRoot =
            validatorsJson.readBytes32(string.concat(depositsBase, ".pendingDepositContainerRoot"));
        snapshot.pendingDepositContainerProof =
            validatorsJson.readBytes(string.concat(depositsBase, ".pendingDepositContainerProof"));
        snapshot.pendingDepositIndexes =
            abi.decode(validatorsJson.parseRaw(string.concat(depositsBase, ".pendingDepositIndexes")), (uint32[]));
        snapshot.pendingDepositProofs =
            validatorsJson.readBytesArray(string.concat(depositsBase, ".pendingDepositProofs"));
    }

    function _assertHistoricalBalances(uint256 snapshotIndex, uint256 expectedPendingDepositsWei)
        internal
        returns (BalanceTotals memory totals)
    {
        uint256 depositCount = compoundingStakingStrategy.depositListLength();
        if (expectedPendingDepositsWei == 0) assertEq(depositCount, 0);
        assertLe(depositCount, 8);

        for (uint256 i = 0; i < depositCount; ++i) {
            this.replaceHistoricalPendingDepositRoot(i);
        }

        HistoricalSnapshot memory snapshot = _loadHistoricalSnapshot(snapshotIndex);
        PendingDepositProofs memory pendingDepositProofs = _pendingDepositProofs(snapshot, depositCount);
        totals = _expectedTotals(snapshot.validatorBalances, expectedPendingDepositsWei);

        mockWeth.mintTo(address(compoundingStakingStrategy), totals.wethBalance);
        vm.deal(address(compoundingStakingStrategy), totals.ethBalance);
        mockBeaconRootsContract.setBeaconRoot(block.timestamp, snapshot.blockRoot);

        vm.prank(governor);
        compoundingStakingStrategy.snapBalances();
        uint64 snapTimestamp = uint64(block.timestamp);

        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit ICompoundingStakingStrategy.BalancesVerified(
            snapTimestamp, totals.totalDepositsWei, totals.totalValidatorBalance, totals.ethBalance
        );
        vm.prank(governor);
        compoundingStakingStrategy.verifyBalances(snapshot.balanceProofs, pendingDepositProofs);

        assertEq(
            compoundingStakingStrategy.lastVerifiedEthBalance(),
            totals.totalDepositsWei + totals.totalValidatorBalance + totals.ethBalance
        );
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), totals.totalBalance);
    }

    function _applyHistoricalSnapshot(
        uint256 snapshotIndex,
        uint256[] memory validatorPositions,
        uint256 expectedPendingDepositsWei,
        uint256 ethBalance
    ) internal returns (uint256 verifiedBalance) {
        HistoricalSnapshot memory snapshot = _loadHistoricalSnapshot(snapshotIndex);
        uint256 validatorCount = validatorPositions.length;
        bytes32[] memory leaves = new bytes32[](validatorCount);
        bytes[] memory balanceProofs = new bytes[](validatorCount);
        string[] memory balances = new string[](validatorCount);
        for (uint256 i = 0; i < validatorCount; ++i) {
            uint256 position = validatorPositions[i];
            leaves[i] = snapshot.balanceProofs.validatorBalanceLeaves[position];
            balanceProofs[i] = snapshot.balanceProofs.validatorBalanceProofs[position];
            balances[i] = snapshot.validatorBalances[position];
        }
        snapshot.balanceProofs.validatorBalanceLeaves = leaves;
        snapshot.balanceProofs.validatorBalanceProofs = balanceProofs;

        uint256 depositCount = compoundingStakingStrategy.depositListLength();
        historicalPendingDepositRoots = validatorsJson.readBytes32Array(
            string.concat(
                ".testBalancesProofs[", vm.toString(snapshotIndex), "].pendingDepositProofsData.pendingDepositRoots"
            )
        );
        for (uint256 i = 0; i < depositCount; ++i) {
            this.replaceHistoricalPendingDepositRoot(i);
        }

        BalanceTotals memory totals = _expectedTotals(balances, expectedPendingDepositsWei);
        assertEq(totals.ethBalance, 0.345 ether);
        totals.ethBalance = ethBalance;
        vm.deal(address(compoundingStakingStrategy), ethBalance);
        mockBeaconRootsContract.setBeaconRoot(block.timestamp, snapshot.blockRoot);

        vm.prank(governor);
        compoundingStakingStrategy.snapBalances();
        vm.prank(governor);
        compoundingStakingStrategy.verifyBalances(snapshot.balanceProofs, _pendingDepositProofs(snapshot, depositCount));

        verifiedBalance = expectedPendingDepositsWei + totals.totalValidatorBalance + ethBalance;
        assertEq(compoundingStakingStrategy.lastVerifiedEthBalance(), verifiedBalance);
    }

    function _pendingDepositProofs(HistoricalSnapshot memory snapshot, uint256 depositCount)
        internal
        pure
        returns (PendingDepositProofs memory proofs)
    {
        uint32[] memory indexes = new uint32[](depositCount);
        bytes[] memory depositProofs = new bytes[](depositCount);
        for (uint256 i = 0; i < depositCount; ++i) {
            indexes[i] = snapshot.pendingDepositIndexes[i];
            depositProofs[i] = snapshot.pendingDepositProofs[i];
        }

        proofs = PendingDepositProofs({
            pendingDepositContainerRoot: snapshot.pendingDepositContainerRoot,
            pendingDepositContainerProof: snapshot.pendingDepositContainerProof,
            pendingDepositIndexes: indexes,
            pendingDepositProofs: depositProofs
        });
    }

    function _expectedTotals(string[] memory validatorBalances, uint256 pendingDepositsWei)
        internal
        pure
        returns (BalanceTotals memory totals)
    {
        for (uint256 i = 0; i < validatorBalances.length; ++i) {
            totals.totalValidatorBalance += _parseDecimal(validatorBalances[i], 18);
        }
        totals.totalDepositsWei = pendingDepositsWei;
        totals.ethBalance = 0.345 ether;
        totals.wethBalance = 123.456 ether;
        totals.totalBalance =
            totals.totalDepositsWei + totals.totalValidatorBalance + totals.ethBalance + totals.wethBalance;
    }

    function _replacePendingDepositRoot(uint256 depositIndex, bytes32 newPendingDepositRoot) internal {
        bytes32 oldPendingDepositRoot = compoundingStakingStrategy.depositList(depositIndex);
        bytes32 oldMappingSlot = _depositMappingSlot(oldPendingDepositRoot);
        bytes32 oldDepositSlot0 = vm.load(address(compoundingStakingStrategy), oldMappingSlot);
        bytes32 oldDepositSlot1 = vm.load(address(compoundingStakingStrategy), bytes32(uint256(oldMappingSlot) + 1));

        bytes32 depositListElementSlot = bytes32(DEPOSIT_LIST_DATA_SLOT + depositIndex);
        vm.store(address(compoundingStakingStrategy), depositListElementSlot, newPendingDepositRoot);
        assertEq(compoundingStakingStrategy.depositList(depositIndex), newPendingDepositRoot);

        bytes32 newMappingSlot = _depositMappingSlot(newPendingDepositRoot);
        vm.store(address(compoundingStakingStrategy), newMappingSlot, oldDepositSlot0);
        vm.store(address(compoundingStakingStrategy), bytes32(uint256(newMappingSlot) + 1), oldDepositSlot1);

        assertEq(vm.load(address(compoundingStakingStrategy), newMappingSlot), oldDepositSlot0);
        assertEq(vm.load(address(compoundingStakingStrategy), bytes32(uint256(newMappingSlot) + 1)), oldDepositSlot1);
    }

    function replaceHistoricalPendingDepositRoot(uint256 depositIndex) external {
        require(msg.sender == address(this), "only self");
        _replacePendingDepositRoot(depositIndex, historicalPendingDepositRoots[depositIndex]);
    }

    function _depositMappingSlot(bytes32 pendingDepositRoot) internal pure returns (bytes32 mappingSlot) {
        assembly {
            mstore(0x00, pendingDepositRoot)
            mstore(0x20, DEPOSITS_MAPPING_SLOT)
            mappingSlot := keccak256(0x00, 0x40)
        }
    }

    function _historicalDepositAmountGwei(uint256 validatorPosition) internal view returns (uint64) {
        string memory amountString = validatorsJson.readString(
            string.concat(".testValidators[", vm.toString(validatorPosition), "].depositProof.depositAmount")
        );
        bytes memory jsonBytes = bytes(amountString);
        uint256 markerPosition;
        while (jsonBytes[markerPosition] == 0x20) ++markerPosition;
        uint256 amount;
        uint256 decimalDigits;
        bool afterDecimalPoint;
        for (uint256 i = markerPosition; i < jsonBytes.length; ++i) {
            bytes1 char = jsonBytes[i];
            if (char == 0x2e) {
                afterDecimalPoint = true;
                continue;
            }
            if (char < 0x30 || char > 0x39) break;
            amount = amount * 10 + uint8(char) - 48;
            if (afterDecimalPoint) ++decimalDigits;
        }
        require(decimalDigits <= 9, "deposit precision");
        amount *= 10 ** (9 - decimalDigits);
        return uint64(amount);
    }

    function _parseDecimal(string memory value, uint256 decimals) internal pure returns (uint256 parsed) {
        bytes memory chars = bytes(value);
        uint256 decimalDigits;
        bool afterDecimalPoint;
        for (uint256 i = 0; i < chars.length; ++i) {
            bytes1 char = chars[i];
            if (char == 0x2e) {
                require(!afterDecimalPoint, "multiple decimal points");
                afterDecimalPoint = true;
                continue;
            }
            require(char >= 0x30 && char <= 0x39, "invalid decimal");
            parsed = parsed * 10 + uint8(char) - 48;
            if (afterDecimalPoint) ++decimalDigits;
        }
        require(decimalDigits <= decimals, "too many decimals");
        parsed *= 10 ** (decimals - decimalDigits);
    }

    function _containsVerifiedValidator(bytes32 pubKeyHash) internal view returns (bool) {
        CompoundingStakingStrategyView.ValidatorView[] memory validators =
            compoundingStakingView.getVerifiedValidators();
        for (uint256 i = 0; i < validators.length; ++i) {
            if (validators[i].pubKeyHash == pubKeyHash) return true;
        }
        return false;
    }
}
