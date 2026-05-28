// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { CompoundingStakingStrategy } from "./CompoundingStakingStrategy.sol";

/// @title Compounding Staking SSV Strategy
/// @notice Strategy to deploy funds into DVT validators powered by the SSV Network
/// @author Origin Protocol Inc
contract CompoundingStakingSSVStrategy is CompoundingStakingStrategy {
    /// @notice The address of the SSV Network contract used to interface with
    address internal immutable SSV_NETWORK;

    // For future use
    uint256[50] private __gap;

    event SSVValidatorRegistered(
        bytes32 indexed pubKeyHash,
        uint64[] operatorIds
    );
    event SSVValidatorRemoved(bytes32 indexed pubKeyHash, uint64[] operatorIds);

    /// @param _baseConfig Base strategy config with
    ///   `platformAddress` not used so empty address
    ///   `vaultAddress` the address of the OETH Vault contract
    /// @param _wethAddress Address of the WETH Token contract
    /// @param _ssvNetwork Address of the SSV Network contract
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _beaconProofs Address of the Beacon Proofs contract that verifies beacon chain data
    /// @param _beaconGenesisTimestamp The timestamp of the Beacon chain's genesis.
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wethAddress,
        address _ssvNetwork,
        address _beaconChainDepositContract,
        address _beaconProofs,
        uint64 _beaconGenesisTimestamp
    )
        CompoundingStakingStrategy(
            _baseConfig,
            _wethAddress,
            _beaconChainDepositContract,
            _beaconProofs,
            _beaconGenesisTimestamp
        )
    {
        SSV_NETWORK = _ssvNetwork;
    }

    /**
     *
     *             Validator Management
     *
     */

    /// @notice Registers a single validator in a SSV Cluster.
    /// Only the Registrator can call this function.
    /// @param publicKey The public key of the validator
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param sharesData The shares data for the validator
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    // slither-disable-start reentrancy-no-eth
    function registerSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        Cluster calldata cluster
    ) external payable onlyRegistrator whenNotPaused {
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);
        // Check each public key has not already been used
        require(
            validator[pubKeyHash].state == ValidatorState.NON_REGISTERED,
            "Validator already registered"
        );

        // Store the validator state as registered
        validator[pubKeyHash].state = ValidatorState.REGISTERED;

        ISSVNetwork(SSV_NETWORK).registerValidator{ value: msg.value }(
            publicKey,
            operatorIds,
            sharesData,
            cluster
        );

        emit SSVValidatorRegistered(pubKeyHash, operatorIds);
    }

    /// @notice Remove the validator from the SSV Cluster after:
    /// - the validator has been exited from `validatorWithdrawal` or slashed
    /// - the validator has incorrectly registered and can not be staked to
    /// - the initial deposit was front-run and the withdrawal address is not this strategy's address.
    /// Make sure `validatorWithdrawal` is called with a zero amount and the validator has exited the Beacon chain.
    /// If removed before the validator has exited the beacon chain will result in the validator being slashed.
    /// Only the registrator can call this function.
    /// @param publicKey The public key of the validator
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external onlyRegistrator {
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);
        ValidatorState currentState = validator[pubKeyHash].state;
        // Can remove SSV validators that were incorrectly registered and can not be deposited to.
        require(
            currentState == ValidatorState.REGISTERED ||
                currentState == ValidatorState.EXITED ||
                currentState == ValidatorState.INVALID,
            "Validator not regd or exited"
        );

        validator[pubKeyHash].state = ValidatorState.REMOVED;

        ISSVNetwork(SSV_NETWORK).removeValidator(
            publicKey,
            operatorIds,
            cluster
        );

        emit SSVValidatorRemoved(pubKeyHash, operatorIds);
    }

    // slither-disable-end reentrancy-no-eth

    function _admitStake(bytes32 pubKeyHash, uint256 depositAmountWei)
        internal
        override
    {
        ValidatorState currentState = validator[pubKeyHash].state;
        require(
            currentState == ValidatorState.REGISTERED ||
                currentState == ValidatorState.VERIFIED ||
                currentState == ValidatorState.ACTIVE,
            "Not registered or verified"
        );

        if (currentState == ValidatorState.REGISTERED) {
            _recordFirstDeposit(pubKeyHash, depositAmountWei);
        }
    }
}
