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

    /// @notice Address of the new Compounding Staking Strategy
    CompoundingStakingSSVStrategy public immutable targetStrategy;

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

    constructor(address _validatorRegistrator, address _targetStrategy) {
        validatorRegistrator = _validatorRegistrator;
        targetStrategy = CompoundingStakingSSVStrategy(
            payable(_targetStrategy)
        );
    }

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

        // Snap the balances so the strategy balance at the start of consolidation can be calculated later
        targetStrategy.snapBalances();

        // Store the number of validators being consolidated
        consolidationCount = SafeCast.toUint64(sourcePubKeys.length);
        startTimestamp = SafeCast.toUint64(block.timestamp);
        sourceStrategy = _sourceStrategy;

        // Call requestConsolidation on the old Native Staking Strategy
        ValidatorAccountant(_sourceStrategy).requestConsolidation(
            sourcePubKeys,
            targetPubKey
        );
    }

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
        require(
            currentBalance >= startBalance + (consolidationCount * 31 ether),
            "Consolidation not complete"
        );
        // TODO do we also need to check the balance of the last source validator is zero?

        ValidatorAccountant(sourceStrategy).confirmConsolidation(
            consolidationCount
        );

        // Reset consolidation state
        consolidationCount = 0;
        startTimestamp = 0;
        startBalance = 0;
        sourceStrategy = address(0);
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

    function removeSsvValidator(
        address _sourceStrategy,
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external onlyRegistrator {
        // Check sourceStrategy is a valid old Native Staking Strategy
        _checkSourceStrategy(_sourceStrategy);

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
        targetStrategy.verifyBalances(balanceProofs, pendingDepositProofs);

        // Exit if no consolidation is in progress as there is nothing more to do
        if (consolidationCount == 0) return;

        // If the Compounding Staking Strategy's balance at the start of consolidation hasn't been stored yet
        if (startBalance == 0) {
            // Store the strategy balance at the start of consolidation
            startBalance = SafeCast.toUint128(
                targetStrategy.checkBalance(WETH)
            );

            return;
        }

        // Consolidation is in progress and the starting balance has been stored
        // Can not update the strategy's balance until after the consolidation is confirmed
        revert("Consolidation in progress");
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
