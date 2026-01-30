// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { CompoundingStakingSSVStrategy, CompoundingValidatorManager } from "./CompoundingStakingSSVStrategy.sol";
import { ValidatorAccountant } from "./ValidatorAccountant.sol";
import { Cluster } from "../../interfaces/ISSVNetwork.sol";

/// @title Consolidation Controller
/// @notice
/// @author Origin Protocol Inc
contract ConsolidationController is Ownable {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant NativeStakingStrategy2 =
        0x4685dB8bF2Df743c861d71E6cFb5347222992076;
    address internal constant NativeStakingStrategy3 =
        0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63;
    /// @dev The new Compounding Staking Strategy Proxy
    CompoundingStakingSSVStrategy internal constant targetStrategy =
        CompoundingStakingSSVStrategy(
            payable(0xaF04828Ed923216c77dC22a2fc8E077FDaDAA87d)
        );

    /// @notice Address of the registrator
    address public validatorRegistrator;

    /// @notice Number of validators being consolidated
    uint64 public consolidationCount;
    uint64 public consolidationStartTimestamp;
    /// @notice The address of the source Native Staking Strategy being consolidated from
    address public sourceStrategy;
    /// @notice The public key hash of the target validator on the new Compounding Staking Strategy
    bytes32 public targetPubKeyHash;

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
        _;
    }

    /// @param _owner The owner who can request and confirm consolidations
    /// @param _validatorRegistrator The registrator who does operations on the old staking strategy
    constructor(address _owner, address _validatorRegistrator) {
        _transferOwnership(_owner);

        validatorRegistrator = _validatorRegistrator;
    }

    /**
     * @notice Request consolidation of validators from an old Native Staking Strategy
     * to the new Compounding Staking Strategy
     * @param _sourceStrategy The address of the old Native Staking Strategy
     * @param sourcePubKeys The public keys of the validators to be consolidated from the old Native Staking Strategy
     * @param targetPubKey The public key of the target validator on the new Compounding Staking Strategy
     */
    function requestConsolidation(
        address _sourceStrategy,
        bytes[] calldata sourcePubKeys,
        bytes calldata targetPubKey
    ) external payable onlyOwner {
        // Check no consolidations are already in progress
        require(consolidationCount == 0, "Consolidation in progress");
        // Check sourceStrategy is a valid old Native Staking Strategy
        _checkSourceStrategy(_sourceStrategy);

        // Check target validator is Active on the new Compounding Staking Strategy
        bytes32 targetPubKeyHashMem = _hashPubKey(targetPubKey);
        (CompoundingStakingSSVStrategy.ValidatorState state, ) = targetStrategy
            .validator(targetPubKeyHashMem);
        require(
            state == CompoundingValidatorManager.ValidatorState.ACTIVE,
            "Target validator not active"
        );
        // Check no pending deposits in the new target validator
        require(
            _hasPendingDeposit(targetPubKeyHashMem) == false,
            "Target has pending deposit"
        );

        // Store the state at the start of the consolidation process
        consolidationCount = SafeCast.toUint64(sourcePubKeys.length);
        consolidationStartTimestamp = uint64(block.timestamp);
        sourceStrategy = _sourceStrategy;
        targetPubKeyHash = targetPubKeyHashMem;

        // Call requestConsolidation on the old Native Staking Strategy
        // to initiate the consolidations
        ValidatorAccountant(_sourceStrategy).requestConsolidation{
            value: msg.value
        }(sourcePubKeys, targetPubKey);

        // Snap the balances for the last time on the new Compounding Staking Strategy
        // until the consolidations are confirmed
        targetStrategy.snapBalances();

        // No event emitted as ConsolidationRequested is emitted from the old Native Staking Strategy
    }

    /**
     * @notice A consolidation request can fail to be processed on the beacon chain
     * for various reasons. For example, the pending consolidation queue is full with 262,144 requests.
     * This restores the consolidation count so that failed consolidations can be retried.
     * @param sourcePubKeys The public keys of the source validators that failed to be consolidated.
     */
    function failConsolidation(bytes[] calldata sourcePubKeys)
        external
        onlyOwner
    {
        // Check consolidations are in progress
        require(consolidationCount > 0, "No consolidation in progress");
        require(
            sourcePubKeys.length <= consolidationCount,
            "Exceeds consolidation count"
        );

        // Read into memory in case it gets reset in storage before
        // the external call to the source strategy
        address sourceStrategyMem = sourceStrategy;

        // Store updated consolidation state
        consolidationCount -= SafeCast.toUint64(sourcePubKeys.length);
        if (consolidationCount == 0) {
            // Reset the rest of the consolidation state
            consolidationStartTimestamp = 0;
            sourceStrategy = address(0);
            targetPubKeyHash = bytes32(0);
        }

        ValidatorAccountant(sourceStrategyMem).failConsolidation(sourcePubKeys);

        // No event emitted as ConsolidationFailed is emitted from the old Native Staking Strategy
    }

    /**
     * @notice Confirm the consolidation of validators from an old Native Staking Strategy
     * to the new Compounding Staking Strategy has been completed.
     */
    function confirmConsolidation(
        CompoundingValidatorManager.BalanceProofs calldata balanceProofs,
        CompoundingValidatorManager.PendingDepositProofs
            calldata pendingDepositProofs
    ) external onlyOwner {
        // Check consolidations are in progress
        require(consolidationCount > 0, "No consolidation in progress");
        // TODO is there a min time before a consolidation can be processed on the beacon chain?
        require(
            uint64(block.timestamp) > consolidationStartTimestamp,
            "Consolidation expired"
        );

        // Load into memory as the storage is about to be reset.
        // These are used in the external contract calls
        address sourceStrategyMem = sourceStrategy;
        uint256 consolidationCountMem = consolidationCount;

        // Reset consolidation state before external calls
        consolidationCount = 0;
        consolidationStartTimestamp = 0;
        sourceStrategy = address(0);
        targetPubKeyHash = bytes32(0);

        // Verify balances on the new Compounding Staking Strategy and update the strategy's balance
        targetStrategy.verifyBalances(balanceProofs, pendingDepositProofs);

        // Reduce the balance of the old Native Staking Strategy
        ValidatorAccountant(sourceStrategyMem).confirmConsolidation(
            consolidationCountMem
        );

        // No event emitted as ConsolidationConfirmed is emitted from the old Native Staking Strategy
    }

    /**
     *
     *   Functions that forward to the old Native Staking Strategy
     *
     */

    /// @dev The registrator of the old Native Staking Strategy can call doAccounting
    function doAccounting(address _sourceStrategy)
        external
        onlyRegistrator
        returns (bool accountingValid)
    {
        // Check sourceStrategy is a valid old Native Staking Strategy
        _checkSourceStrategy(_sourceStrategy);

        return ValidatorAccountant(_sourceStrategy).doAccounting();
    }

    /**
     * @notice Exit of source validators are allowed during the consolidation process
     * as consolidated validators will be in EXITING state hence can not be consolidated after exit.
     * @param _sourceStrategy The address of the old Native Staking Strategy
     * @param publicKey The public key of the validator to exit which must have STAKED state.
     * @param operatorIds The operator IDs for the source SSV cluster
     */
    function exitSsvValidator(
        address _sourceStrategy,
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external onlyRegistrator {
        // Check sourceStrategy is a valid old Native Staking Strategy
        _checkSourceStrategy(_sourceStrategy);

        ValidatorAccountant(_sourceStrategy).exitSsvValidator(
            publicKey,
            operatorIds
        );
    }

    /**
     * @notice Removing source validators is not allowed during the consolidation process
     * as consolidated validators will be in EXITING state hence can not be consolidated after removal.
     * @param _sourceStrategy The address of the old Native Staking Strategy
     * @param publicKey The public key of the validator to remove which must have EXITING or REGISTERED state.
     * @param operatorIds The operator IDs for the source SSV cluster
     * @param cluster The SSV cluster information for the source validator
     */
    function removeSsvValidator(
        address _sourceStrategy,
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external onlyRegistrator {
        // Check sourceStrategy is a valid old Native Staking Strategy
        _checkSourceStrategy(_sourceStrategy);
        // Prevent removing a validator from the SSV cluster before the consolidation
        // process has been completed.
        // This prevents validators that have been exited rather than consolidated but that's ok.
        // The exited validator can be removed after the consolidation process is complete.
        require(consolidationCount == 0, "Consolidation in progress");

        ValidatorAccountant(_sourceStrategy).removeSsvValidator(
            publicKey,
            operatorIds,
            cluster
        );
    }

    /**
     *
     *   Functions that forward to the new Compounding Staking Strategy
     *
     */

    /**
     * @notice Anyone can verify balances on the new Compounding Staking Strategy
     * as long as there are no consolidations in progress.
     */
    function verifyBalances(
        CompoundingValidatorManager.BalanceProofs calldata balanceProofs,
        CompoundingValidatorManager.PendingDepositProofs
            calldata pendingDepositProofs
    ) external {
        (, uint64 snappedTimestamp, ) = targetStrategy.snappedBalance();
        // Can not verify balances while consolidations are in progress
        // but can if the snapped balance is the start of the consolidation process.
        // That is, snappedTimestamp == consolidationStartTimestamp
        if (
            consolidationCount > 0 &&
            snappedTimestamp != consolidationStartTimestamp
        ) {
            revert("Consolidation in progress");
        }

        targetStrategy.verifyBalances(balanceProofs, pendingDepositProofs);
    }

    /// @notice Partial withdrawals are allowed during consolidation from the new Compounding Staking Strategy.
    /// This includes partial withdrawals from the target validator.
    // Full validator exits from any Compounding Staking Strategy validator are
    // not allowed during the migration period.
    function validatorWithdrawal(bytes calldata publicKey, uint64 amountGwei)
        external
        payable
        onlyRegistrator
    {
        // Prevent full exits from any new compounding validators.
        // This includes when there is no consolidation in progress.
        // This reduces the risk of an exit request being processed before a consolidation request
        require(amountGwei > 0, "No exit during migration");
        targetStrategy.validatorWithdrawal{ value: msg.value }(
            publicKey,
            amountGwei
        );
    }

    /**
     * @notice Deposits to Compounding Staking Strategy validators that are
     * not the target of a consolidation are allowed.
     */
    function stakeEth(
        CompoundingValidatorManager.ValidatorStakeData
            calldata validatorStakeData,
        uint64 depositAmountGwei
    ) external onlyRegistrator {
        require(
            _hashPubKey(validatorStakeData.pubkey) != targetPubKeyHash,
            "Stake to consolidation target"
        );

        targetStrategy.stakeEth(validatorStakeData, depositAmountGwei);
    }

    /// removeSsvValidator from the new Compounding Staking Strategy is not allowed until after
    /// all the validators have been consolidated

    /**
     *
     *      Internal Functions
     *
     */

    /// @notice Check if there are any pending deposits for a validator with a given public key hash.
    /// Need to iterate over the target strategy’s `deposits`
    function _hasPendingDeposit(bytes32 _targetPubKeyHash)
        internal
        view
        returns (bool)
    {
        uint256 depositsCount = targetStrategy.depositListLength();
        for (uint256 i = 0; i < depositsCount; ++i) {
            (
                bytes32 depositPubKeyHash,
                ,
                ,
                ,
                CompoundingValidatorManager.DepositStatus status
            ) = targetStrategy.deposits(targetStrategy.depositList(i));
            if (
                depositPubKeyHash == _targetPubKeyHash &&
                status == CompoundingValidatorManager.DepositStatus.PENDING
            ) {
                return true;
            }
        }
        return false;
    }

    /// @notice Hash a validator public key using the Beacon Chain's format
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    /// @dev Check source strategy is a valid old Native Staking Strategy
    function _checkSourceStrategy(address _sourceStrategy) internal pure {
        require(
            _sourceStrategy == NativeStakingStrategy2 ||
                _sourceStrategy == NativeStakingStrategy3,
            "Invalid source strategy"
        );
    }
}
