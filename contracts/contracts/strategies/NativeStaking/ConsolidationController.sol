// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { CompoundingStakingSSVStrategy, CompoundingValidatorManager } from "./CompoundingStakingSSVStrategy.sol";
import { ValidatorAccountant } from "./ValidatorAccountant.sol";
import { Cluster } from "../../interfaces/ISSVNetwork.sol";

/// @title Consolidation Controller
/// @notice
/// @author Origin Protocol Inc
contract ConsolidationController {
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
    /// @notice When the consolidation process started
    uint64 public startTimestamp;
    uint128 public startBalance;
    address public sourceStrategy;

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
        _;
    }

    constructor(address _validatorRegistrator) {
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
    ) external {
        // Check no consolidations are already in progress. ie consolidationCount > 0
        require(consolidationCount == 0, "Consolidation in progress");
        // Check sourceStrategy is a valid old Native Staking Strategy
        _checkSourceStrategy(_sourceStrategy);

        // Check target validator is Active on the new Compounding Staking Strategy
        bytes32 targetPubKeyHash = _hashPubKey(targetPubKey);
        (CompoundingStakingSSVStrategy.ValidatorState state, ) = targetStrategy
            .validator(targetPubKeyHash);
        require(
            state == CompoundingValidatorManager.ValidatorState.ACTIVE,
            "Target validator not active"
        );
        // Check no pending deposits in the new target validator
        require(
            _hasPendingDeposit(targetPubKeyHash) == false,
            "Target has pending deposits"
        );

        // Store the state at the start of the consolidation process
        consolidationCount = SafeCast.toUint64(sourcePubKeys.length);
        startTimestamp = SafeCast.toUint64(block.timestamp);
        sourceStrategy = _sourceStrategy;

        // Snap the balances so the Compounding Staking Strategy balance at the
        // start of consolidation process can be calculated later
        targetStrategy.snapBalances();

        // Call requestConsolidation on the old Native Staking Strategy
        // to initiate the consolidations
        ValidatorAccountant(_sourceStrategy).requestConsolidation(
            sourcePubKeys,
            targetPubKey
        );

        // No event emitted as ConsolidationRequested is emitted from the old Native Staking Strategy
    }

    /**
     * @notice Confirm the consolidation of validators from an old Native Staking Strategy
     * to the new Compounding Staking Strategy has been completed
     * @param balanceProofs The balance proofs from the new Compounding Staking Strategy
     * @param pendingDepositProofs The pending deposit proofs from the new Compounding Staking Strategy
     */
    function confirmConsolidation(
        CompoundingStakingSSVStrategy.BalanceProofs calldata balanceProofs,
        CompoundingStakingSSVStrategy.PendingDepositProofs
            calldata pendingDepositProofs
    ) external onlyRegistrator {
        // Verify the consolidation has been completed
        // Now check if the consolidation is complete
        targetStrategy.verifyBalances(balanceProofs, pendingDepositProofs);
        uint128 currentBalance = SafeCast.toUint128(
            targetStrategy.checkBalance(WETH)
        );
        // 32 ETH is used which assumes the source validators have not been slashed before or after the consolidation request.
        require(
            currentBalance >= startBalance + (consolidationCount * 32 ether),
            "Consolidation not complete"
        );

        // Reset consolidation state
        consolidationCount = 0;
        startTimestamp = 0;
        startBalance = 0;
        sourceStrategy = address(0);

        ValidatorAccountant(sourceStrategy).confirmConsolidation(
            consolidationCount
        );

        // No event emitted as ConsolidationConfirmed is emitted from the old Native Staking Strategy
    }

    /**
     *
     *   Functions that forward to the old Native Staking Strategy
     *
     */

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

    /// @notice Can only call snapBalances on the new Compounding Staking Strategy
    /// if no there are consolidations in progress or the consolidation starting balance has already been stored
    function snapBalances() external {
        if (consolidationCount == 0 || startBalance > 0) {
            targetStrategy.snapBalances();
        }
    }

    function verifyBalances(
        CompoundingStakingSSVStrategy.BalanceProofs calldata balanceProofs,
        CompoundingStakingSSVStrategy.PendingDepositProofs
            calldata pendingDepositProofs
    ) external {
        // Consolidation is in progress and the starting balance has already been stored.
        if (consolidationCount > 0 && startBalance > 0) {
            // Can not update the strategy's balance until after the consolidation has been completed.
            // Call confirmConsolidation with the balance proofs if the consolidation is complete.
            revert("Consolidation in progress");
        }

        targetStrategy.verifyBalances(balanceProofs, pendingDepositProofs);

        // If no consolidation is in progress, there is nothing more to do
        if (consolidationCount == 0) return;

        // startBalance is zero so store the strategy balance at the start of consolidation
        startBalance = SafeCast.toUint128(targetStrategy.checkBalance(WETH));
    }

    // removeSsvValidator and validatorWithdrawal on the new Compounding Staking Strategy are prevented during migration
    // between staking strategies. If the OETH Vault needs WETH, it can exit from the old sweeping validators.
    // Once the migration has been completed, the old Registrator will be set on the Compounding Staking Strategy
    // which will allow full and partial withdrawals from the new compounding validators.
    // If there is a large withdrawal request at the end of the migration and there is not enough liquidity in the
    // old sweeping validators, the withdrawal will have to wait until the consolidation is complete and Registrator restored.
    // The danger of allowing partial withdrawals during migration is it will mess with the check that a consolidation as been completed.
    // Putting a restriction that there no consolidation in process helps a little, but there could be an exit just before a new consolidation
    // is initiated which would mess with the checks.

    /**
     *
     *      Internal Functions
     *
     */

    /// @notice Check if there are any pending deposits for a validator with a given public key hash.
    /// Need to iterate over the target strategy’s `deposits`
    function _hasPendingDeposit(bytes32 targetPubKeyHash)
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
                depositPubKeyHash == targetPubKeyHash &&
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
