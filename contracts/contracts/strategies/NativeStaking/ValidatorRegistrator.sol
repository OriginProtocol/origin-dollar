// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Governable } from "../../governance/Governable.sol";
import { IDepositContract } from "../../interfaces/IDepositContract.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

/**
 * @title Registrator of the validators
 * @notice This contract implements all the required functionality to register, exit and remove validators.
 * @author Origin Protocol Inc
 */
abstract contract ValidatorRegistrator is Governable, Pausable {
    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH_TOKEN_ADDRESS;
    /// @notice The address of the beacon chain deposit contract
    address public immutable BEACON_CHAIN_DEPOSIT_CONTRACT;
    /// @notice The address of the SSV Network contract used to interface with
    address public immutable SSV_NETWORK_ADDRESS;
    /// @notice Address of the OETH Vault proxy contract
    address public immutable VAULT_ADDRESS;

    /// @notice Address of the registrator - allowed to register, exit and remove validators
    address public validatorRegistrator;
    /// @notice The number of validators that have 32 (!) ETH actively deposited. When a new deposit
    /// to a validator happens this number increases, when a validator exit is detected this number
    /// decreases.
    uint256 public activeDepositedValidators;
    /// @notice State of the validators keccak256(pubKey) => state
    mapping(bytes32 => VALIDATOR_STATE) public validatorsStates;
    /// @notice The account that is allowed to modify stakeETHThreshold and reset stakeETHTally
    address public stakingMonitor;
    /// @notice Amount of ETH that can be staked before staking on the contract is suspended
    /// and the governor needs to approve further staking
    uint256 public stakeETHThreshold;
    /// @notice Amount of ETH that can has been staked since the last governor approval.
    uint256 public stakeETHTally;
    // For future use
    uint256[47] private __gap;

    enum VALIDATOR_STATE {
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        EXITING, // exit message has been posted and validator is in the process of exiting
        EXIT_COMPLETE // validator has funds withdrawn to the EigenPod and is removed from the SSV
    }

    event RegistratorChanged(address indexed newAddress);
    event StakingMonitorChanged(address indexed newAddress);
    event ETHStaked(bytes pubkey, uint256 amount, bytes withdrawal_credentials);
    event SSVValidatorRegistered(bytes pubkey, uint64[] operatorIds);
    event SSVValidatorExitInitiated(bytes pubkey, uint64[] operatorIds);
    event SSVValidatorExitCompleted(bytes pubkey, uint64[] operatorIds);
    event StakeETHThresholdChanged(uint256 amount);
    event StakeETHTallyReset();

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
        _;
    }

    /// @dev Throws if called by any account other than the Staking monitor
    modifier onlyStakingMonitor() {
        require(msg.sender == stakingMonitor, "Caller is not the Monitor");
        _;
    }

    /// @dev Throws if called by any account other than the Strategist
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(VAULT_ADDRESS).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _vaultAddress Address of the Vault
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _ssvNetwork Address of the SSV Network contract
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork
    ) {
        WETH_TOKEN_ADDRESS = _wethAddress;
        BEACON_CHAIN_DEPOSIT_CONTRACT = _beaconChainDepositContract;
        SSV_NETWORK_ADDRESS = _ssvNetwork;
        VAULT_ADDRESS = _vaultAddress;
    }

    /// @notice Set the address of the registrator which can register, exit and remove validators
    function setRegistrator(address _address) external onlyGovernor {
        emit RegistratorChanged(_address);
        validatorRegistrator = _address;
    }

    /// @notice Set the address of the staking monitor that is allowed to reset stakeETHTally
    function setStakingMonitor(address _address) external onlyGovernor {
        emit StakingMonitorChanged(_address);
        stakingMonitor = _address;
    }

    /// @notice Set the amount of ETH that can be staked before staking monitor
    // needs to a approve further staking by resetting the stake ETH tally
    function setStakeETHThreshold(uint256 _amount) external onlyGovernor {
        emit StakeETHThresholdChanged(_amount);
        stakeETHThreshold = _amount;
    }

    /// @notice Reset the stakeETHTally
    function resetStakeETHTally() external onlyStakingMonitor {
        emit StakeETHTallyReset();
        stakeETHTally = 0;
    }

    /// @notice Stakes WETH to the node validators
    /// @param validators A list of validator data needed to stake.
    /// The `ValidatorStakeData` struct contains the pubkey, signature and depositDataRoot.
    /// Only the registrator can call this function.
    // slither-disable-start reentrancy-eth
    function stakeEth(ValidatorStakeData[] calldata validators)
        external
        onlyRegistrator
        whenNotPaused
    {
        uint256 requiredETH = validators.length * 32 ether;

        // Check there is enough WETH from the deposits sitting in this strategy contract
        require(
            requiredETH <= IWETH9(WETH_TOKEN_ADDRESS).balanceOf(address(this)),
            "insufficient WETH"
        );

        require(
            stakeETHTally + requiredETH <= stakeETHThreshold,
            "Staking ETH over threshold"
        );
        stakeETHTally += requiredETH;

        // Convert required ETH from WETH
        IWETH9(WETH_TOKEN_ADDRESS).withdraw(requiredETH);
        _wethWithdrawnAndStaked(requiredETH);

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

        uint256 validatorsLength = validators.length;
        // For each validator
        for (uint256 i = 0; i < validatorsLength; ) {
            bytes32 pubkeyHash = keccak256(validators[i].pubkey);
            VALIDATOR_STATE currentState = validatorsStates[pubkeyHash];

            require(
                currentState == VALIDATOR_STATE.REGISTERED,
                "Validator not registered"
            );

            IDepositContract(BEACON_CHAIN_DEPOSIT_CONTRACT).deposit{
                value: 32 ether
            }(
                validators[i].pubkey,
                withdrawal_credentials,
                validators[i].signature,
                validators[i].depositDataRoot
            );

            emit ETHStaked(
                validators[i].pubkey,
                32 ether,
                withdrawal_credentials
            );

            validatorsStates[pubkeyHash] = VALIDATOR_STATE.STAKED;

            unchecked {
                ++i;
            }
        }
        // save gas by changing this storage variable only once rather each time in the loop.
        activeDepositedValidators += validatorsLength;
    }

    // slither-disable-end reentrancy-eth

    /// @notice Registers a new validator in the SSV Cluster.
    /// Only the registrator can call this function.
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

    /// @notice Exit a validator from the Beacon chain.
    /// The staked ETH will eventually swept to this native staking strategy.
    /// Only the registrator can call this function.
    // slither-disable-start reentrancy-no-eth
    function exitSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external onlyRegistrator whenNotPaused {
        VALIDATOR_STATE currentState = validatorsStates[keccak256(publicKey)];
        require(currentState == VALIDATOR_STATE.STAKED, "Validator not staked");

        ISSVNetwork(SSV_NETWORK_ADDRESS).exitValidator(publicKey, operatorIds);
        emit SSVValidatorExitInitiated(publicKey, operatorIds);

        validatorsStates[keccak256(publicKey)] = VALIDATOR_STATE.EXITING;
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Remove a validator from the SSV Cluster.
    /// Make sure `exitSsvValidator` is called before and the validate has exited the Beacon chain.
    /// If removed before the validator has exited the beacon chain will result in the validator being slashed.
    /// Only the registrator can call this function.
    // slither-disable-start reentrancy-no-eth
    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external onlyRegistrator whenNotPaused {
        VALIDATOR_STATE currentState = validatorsStates[keccak256(publicKey)];
        require(
            currentState == VALIDATOR_STATE.EXITING,
            "Validator not exiting"
        );

        ISSVNetwork(SSV_NETWORK_ADDRESS).removeValidator(
            publicKey,
            operatorIds,
            cluster
        );
        emit SSVValidatorExitCompleted(publicKey, operatorIds);

        validatorsStates[keccak256(publicKey)] = VALIDATOR_STATE.EXIT_COMPLETE;
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Deposits more SSV Tokens to the SSV Network contract which is used to pay the SSV Operators.
    /// @dev A SSV cluster is defined by the SSVOwnerAddress and the set of operatorIds.
    /// uses "onlyStrategist" modifier so continuous front-running can't DOS our maintenance service
    /// that tries to top up SSV tokens.
    /// @param cluster The SSV cluster details that must be derived from emitted events from the SSVNetwork contract.
    function depositSSV(
        uint64[] memory operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external onlyStrategist {
        ISSVNetwork(SSV_NETWORK_ADDRESS).deposit(
            address(this),
            operatorIds,
            amount,
            cluster
        );
    }

    /***************************************
                 Abstract
    ****************************************/

    /// @dev allows for NativeStakingSSVStrategy contract know how much WETH had been staked
    function _wethWithdrawnAndStaked(uint256 _amount) internal virtual;
}
