// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { CompoundingValidatorManager } from "./CompoundingValidatorManager.sol";

/**
 * @title Viewing contract for the Compounding Staking Strategy.
 * @notice This contract implements all the required functionality to
 * register, deposit, withdraw, exit and remove validators.
 * @author Origin Protocol Inc
 */
abstract contract CompoundingStakingStrategyView {
    /// @notice The address of the Compounding Staking Strategy contract
    CompoundingValidatorManager public immutable stakingStrategy;

    constructor(address _stakingStrategy) {
        stakingStrategy = CompoundingValidatorManager(_stakingStrategy);
    }

    struct ValidatorView {
        bytes32 pubKeyHash;
        uint64 index;
        CompoundingValidatorManager.VALIDATOR_STATE state;
    }

    struct DepositView {
        uint256 depositID;
        bytes32 pubKeyHash;
        uint64 amountGwei;
        uint64 slot;
        uint256 withdrawableEpoch;
    }

    /// @notice Returns the strategy's active validators.
    /// These are the ones that have been verified and have a non-zero balance.
    /// @return validators An array of `ValidatorView` containing the public key hash, validator index and state.
    function getVerifiedValidators()
        external
        view
        returns (ValidatorView[] memory validators)
    {
        uint256 validatorCount = stakingStrategy.verifiedValidatorsLength();
        validators = new ValidatorView[](validatorCount);
        for (uint256 i = 0; i < validatorCount; ++i) {
            bytes32 pubKeyHash = stakingStrategy.verifiedValidators(i);
            (
                CompoundingValidatorManager.VALIDATOR_STATE state,
                uint64 index
            ) = stakingStrategy.validator(pubKeyHash);
            validators[i] = ValidatorView({
                pubKeyHash: pubKeyHash,
                index: index,
                state: state
            });
        }
    }

    /// @notice Returns the deposits that are still to be verified.
    /// These may or may not have been processed by the beacon chain.
    /// @return pendingDeposits An array of `DepositView` containing the deposit ID, public key hash,
    /// amount in Gwei and the slot of the deposit.
    function getPendingDeposits()
        external
        view
        returns (DepositView[] memory pendingDeposits)
    {
        uint256 depositsCount = stakingStrategy.depositListLength();
        pendingDeposits = new DepositView[](depositsCount);
        for (uint256 i = 0; i < depositsCount; ++i) {
            (
                bytes32 pubKeyHash,
                uint64 amountGwei,
                uint64 slot,
                ,
                ,
                uint256 withdrawableEpoch
            ) = stakingStrategy.deposits(stakingStrategy.depositList(i));
            pendingDeposits[i] = DepositView({
                depositID: stakingStrategy.depositList(i),
                pubKeyHash: pubKeyHash,
                amountGwei: amountGwei,
                slot: slot,
                withdrawableEpoch: withdrawableEpoch
            });
        }
    }
}
