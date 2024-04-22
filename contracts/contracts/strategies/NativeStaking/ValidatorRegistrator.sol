// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Governable } from "../../governance/Governable.sol";
import { IDepositContract } from "../../interfaces/IDepositContract.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

/**
 * @title Registrator of the validators
 * @notice This contract implements all the required functionality to register validators
 * @author Origin Protocol Inc
 */
abstract contract ValidatorRegistrator is Governable, Pausable {
    /// @notice The Wrapped ETH (WETH) contract address
    address public immutable WETH_TOKEN_ADDRESS;
    /// @notice Address of the beacon chain deposit contract
    address public immutable BEACON_CHAIN_DEPOSIT_CONTRACT;
    /// @notice SSV Network contract used to interface with
    address public immutable SSV_NETWORK_ADDRESS;

    /// @notice Address of the registrator - allowed to register, exit and remove validators
    address public validatorRegistrator;
    /// @notice The number of validators that have 32 (!) ETH actively deposited. When a new deposit
    /// to a validator happens this number increases, when a validator exit is detected this number
    /// decreases.
    uint256 activeDepositedValidators;
    /// @notice State of the validators keccak256(pubKey) => state
    mapping(bytes32 => VALIDATOR_STATE) public validatorsStates;

    // For future use
    uint256[50] private __gap;

    enum VALIDATOR_STATE {
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        EXITING, // exit message has been posted and validator is in the process of exiting
        EXIT_COMPLETE // validator has funds withdrawn to the EigenPod and is removed from the SSV
    }

    event RegistratorAddressChanged(address oldAddress, address newAddress);
    event ETHStaked(bytes pubkey, uint256 amount, bytes withdrawal_credentials);
    event SSVValidatorRegistered(bytes pubkey, uint64[] operatorIds);
    event SSVValidatorExitInitiated(bytes pubkey, uint64[] operatorIds);
    event SSVValidatorExitCompleted(bytes pubkey, uint64[] operatorIds);

    error InsufficientWETH(uint256 wethBalance, uint256 requiredWethBalance);
    error ValidatorInUnexpectedState(bytes pubkey, VALIDATOR_STATE state);

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
        _;
    }

    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _ssvNetwork Address of the SSV Network contract
    constructor(
        address _wethAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork
    ) {
        WETH_TOKEN_ADDRESS = _wethAddress;
        BEACON_CHAIN_DEPOSIT_CONTRACT = _beaconChainDepositContract;
        SSV_NETWORK_ADDRESS = _ssvNetwork;
    }

    /// @notice Set the address of the registrator
    function setRegistratorAddress(address _address) external onlyGovernor {
        emit RegistratorAddressChanged(validatorRegistrator, _address);
        validatorRegistrator = _address;
    }

    /// @notice return the WETH balance on the contract that can be used to for beacon chain
    /// staking - staking on the validators
    function getWETHBalanceEligibleForStaking()
        public
        view
        virtual
        returns (uint256 _amount);

    /// @notice Stakes WETH to the node validators
    /// @param validators A list of validator data needed to stake.
    /// The ValidatorStakeData struct contains the pubkey, signature and depositDataRoot.
    /// @dev Only accounts with the Operator role can call this function.
    function stakeEth(ValidatorStakeData[] calldata validators)
        external
        onlyRegistrator
        whenNotPaused
    {
        uint256 requiredWETH = validators.length * 32 ether;
        uint256 wethBalance = getWETHBalanceEligibleForStaking();
        if (wethBalance < requiredWETH) {
            revert InsufficientWETH(wethBalance, requiredWETH);
        }

        // Convert WETH asset to native ETH
        IWETH9(WETH_TOKEN_ADDRESS).withdraw(wethBalance);

        // For each validator
        for (uint256 i = 0; i < validators.length; ) {
            bytes32 pubkeyHash = keccak256(validators[i].pubkey);
            VALIDATOR_STATE currentState = validatorsStates[pubkeyHash];

            if (currentState != VALIDATOR_STATE.REGISTERED) {
                revert ValidatorInUnexpectedState(
                    validators[i].pubkey,
                    currentState
                );
            }

            _stakeEth(
                validators[i].pubkey,
                validators[i].signature,
                validators[i].depositDataRoot
            );
            validatorsStates[pubkeyHash] = VALIDATOR_STATE.STAKED;

            unchecked {
                ++i;
            }
        }
    }

    /// @dev Deposit WETH to the beacon chain deposit contract
    /// @dev The public functions that call this internal function are responsible for access control.
    function _stakeEth(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) internal {
        /* 0x01 to indicate that withdrawal credentials will contain an EOA address that the sweeping function
         * can sweep funds to.
         * bytes11(0) to fill up the required zeros
         * remaining bytes20 are for the address
         */
        bytes memory withdrawal_credentials = abi.encodePacked(
            bytes1(0x01),
            bytes11(0),
            address(this)
        );
        IDepositContract(BEACON_CHAIN_DEPOSIT_CONTRACT).deposit(
            pubkey,
            withdrawal_credentials,
            signature,
            depositDataRoot
        );

        activeDepositedValidators += 1;
        emit ETHStaked(pubkey, 32 ether, withdrawal_credentials);
    }

    /// @dev Registers a new validator in the SSV Cluster
    function registerSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        uint256 amount,
        Cluster calldata cluster
    ) external onlyRegistrator whenNotPaused {
        ISSVNetwork(SSV_NETWORK_ADDRESS).registerValidator(
            publicKey,
            operatorIds,
            sharesData,
            amount,
            cluster
        );
        validatorsStates[keccak256(publicKey)] = VALIDATOR_STATE.REGISTERED;
        emit SSVValidatorRegistered(publicKey, operatorIds);
    }

    /// @dev Exit a validator from the Beacon chain.
    /// The staked ETH will be sent to the EigenPod.
    function exitSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external onlyRegistrator whenNotPaused {
        VALIDATOR_STATE currentState = validatorsStates[keccak256(publicKey)];
        if (currentState != VALIDATOR_STATE.STAKED) {
            revert ValidatorInUnexpectedState(publicKey, currentState);
        }

        ISSVNetwork(SSV_NETWORK_ADDRESS).exitValidator(publicKey, operatorIds);
        emit SSVValidatorExitInitiated(publicKey, operatorIds);

        validatorsStates[keccak256(publicKey)] = VALIDATOR_STATE.EXITING;
    }

    /// @dev Remove a validator from the SSV Cluster.
    /// Make sure `exitSsvValidator` is called before and the validate has exited the Beacon chain.
    /// If removed before the validator has exited the beacon chain will result in the validator being slashed.
    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external onlyRegistrator whenNotPaused {
        VALIDATOR_STATE currentState = validatorsStates[keccak256(publicKey)];
        if (currentState != VALIDATOR_STATE.EXITING) {
            revert ValidatorInUnexpectedState(publicKey, currentState);
        }

        ISSVNetwork(SSV_NETWORK_ADDRESS).removeValidator(
            publicKey,
            operatorIds,
            cluster
        );
        emit SSVValidatorExitCompleted(publicKey, operatorIds);

        validatorsStates[keccak256(publicKey)] = VALIDATOR_STATE.EXIT_COMPLETE;
    }
}
