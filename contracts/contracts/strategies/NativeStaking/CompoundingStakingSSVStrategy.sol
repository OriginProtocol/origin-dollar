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

    error CannotRemoveSsvValidator(); // 0x2c45bd75
    error AlreadyRegistered(); // 0x3a81d6fc
    error NotRegisteredOrVerified(); // 0x99088a6b

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

    // slither-disable-start reentrancy-no-eth
    /// @notice Registers a single validator in a SSV Cluster.
    /// Only the Registrator can call this function.
    /// @param publicKey The public key of the validator
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param sharesData The shares data for the validator
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    function registerSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        Cluster calldata cluster
    ) external payable onlyRegistrator whenNotPaused {
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);

        if (validator[pubKeyHash].state != ValidatorState.NON_REGISTERED) {
            revert AlreadyRegistered();
        }

        // Store the validator state as registered
        validator[pubKeyHash].state = ValidatorState.REGISTERED;

        ISSVNetwork(SSV_NETWORK).registerValidator{ value: msg.value }(
            publicKey,
            operatorIds,
            sharesData,
            cluster
        );
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
        if (
            currentState != ValidatorState.REGISTERED &&
            currentState != ValidatorState.EXITED &&
            currentState != ValidatorState.INVALID
        ) {
            revert CannotRemoveSsvValidator();
        }

        validator[pubKeyHash].state = ValidatorState.REMOVED;

        ISSVNetwork(SSV_NETWORK).removeValidator(
            publicKey,
            operatorIds,
            cluster
        );

        emit SSVValidatorRemoved(pubKeyHash, operatorIds);
    }

    /// @notice Withdraw ETH funding from this strategy's SSV cluster.
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param amount The amount of ETH to withdraw from the SSV cluster
    /// @param cluster The SSV cluster details including the validator count and ETH balance
    function withdrawSsvClusterEth(
        uint64[] calldata operatorIds,
        uint256 amount,
        Cluster calldata cluster
    ) external onlyGovernor {
        ISSVNetwork(SSV_NETWORK).withdraw(operatorIds, amount, cluster);

        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            _withdraw(vaultAddress, ethBalance, ethBalance);
        }
    }

    // slither-disable-end reentrancy-no-eth

    function _admitStake(bytes32 pubKeyHash, uint256 depositAmountWei)
        internal
        override
    {
        ValidatorState currentState = validator[pubKeyHash].state;
        if (
            currentState != ValidatorState.REGISTERED &&
            currentState != ValidatorState.VERIFIED &&
            currentState != ValidatorState.ACTIVE
        ) {
            revert NotRegisteredOrVerified();
        }

        if (currentState == ValidatorState.REGISTERED) {
            _recordFirstDeposit(pubKeyHash, depositAmountWei);
        }
    }
}
