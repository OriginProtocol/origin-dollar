// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Governable } from "../../governance/Governable.sol";
import { IConsolidationStrategy, IConsolidationSource } from "../../interfaces/IConsolidation.sol";
import { IDepositContract } from "../../interfaces/IDepositContract.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { BeaconConsolidation } from "../../beacon/BeaconConsolidation.sol";

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
abstract contract ValidatorRegistrator is Governable, Pausable, IConsolidationSource {
    /// @notice The maximum amount of ETH that can be staked by a validator
    /// @dev this can change in the future with EIP-7251, Increase the MAX_EFFECTIVE_BALANCE
    uint256 public constant FULL_STAKE = 32 ether;

    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the beacon chain deposit contract
    address public immutable BEACON_CHAIN_DEPOSIT_CONTRACT;
    /// @notice The address of the SSV Network contract used to interface with
    address public immutable SSV_NETWORK;
    /// @notice Address of the OETH Vault proxy contract
    address public immutable VAULT_ADDRESS;
    /// @notice Maximum number of validators that can be registered in this strategy
    uint256 public immutable MAX_VALIDATORS;

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
    /// and the `stakingMonitor` needs to approve further staking by calling `resetStakeETHTally`
    uint256 public stakeETHThreshold;
    /// @notice Amount of ETH that has been staked since the `stakingMonitor` last called `resetStakeETHTally`.
    /// This can not go above `stakeETHThreshold`.
    uint256 public stakeETHTally;

    /// @notice Number of validators currently being consolidated
    uint256 public consolidationCount;
    address public intermediateConsolidationStrategy;

    // For future use
    uint256[44] private __gap;

    enum VALIDATOR_STATE {
        NON_REGISTERED, // validator is not registered on the SSV network
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        EXITING, // exit message has been posted and validator is in the process of exiting
        EXIT_COMPLETE // validator has funds withdrawn to the EigenPod and is removed from the SSV
    }

    event RegistratorChanged(address indexed newAddress);
    event StakingMonitorChanged(address indexed newAddress);
    event ETHStaked(bytes32 indexed pubKeyHash, bytes pubKey, uint256 amount);
    event SSVValidatorRegistered(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint64[] operatorIds
    );
    event SSVValidatorExitInitiated(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint64[] operatorIds
    );
    event SSVValidatorExitCompleted(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint64[] operatorIds
    );
    event ConsolidationRequested(
        bytes[] sourcePubKeys,
        bytes targetPubKey,
        address targetStakingStrategy,
        uint256 consolidationCount
    );
    event ConsolidationConfirmed(
        uint256 consolidationCount,
        uint256 activeDepositedValidators
    );
    event StakeETHThresholdChanged(uint256 amount);
    event StakeETHTallyReset();
    event TargetStrategyAdded(address indexed strategy);

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
    /// @param _maxValidators Maximum number of validators that can be registered in the strategy
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork,
        uint256 _maxValidators
    ) {
        WETH = _wethAddress;
        BEACON_CHAIN_DEPOSIT_CONTRACT = _beaconChainDepositContract;
        SSV_NETWORK = _ssvNetwork;
        VAULT_ADDRESS = _vaultAddress;
        MAX_VALIDATORS = _maxValidators;
    }

    /// @notice Set the address of the registrator which can register, exit and remove validators
    function setRegistrator(address _address) external onlyGovernor {
        validatorRegistrator = _address;
        emit RegistratorChanged(_address);
    }

    /// @notice Set the address of the staking monitor that is allowed to reset stakeETHTally
    function setStakingMonitor(address _address) external onlyGovernor {
        stakingMonitor = _address;
        emit StakingMonitorChanged(_address);
    }

    /// @notice Set the amount of ETH that can be staked before staking monitor
    // needs to a approve further staking by resetting the stake ETH tally
    function setStakeETHThreshold(uint256 _amount) external onlyGovernor {
        stakeETHThreshold = _amount;
        emit StakeETHThresholdChanged(_amount);
    }

    /// @notice Reset the stakeETHTally
    function resetStakeETHTally() external onlyStakingMonitor {
        stakeETHTally = 0;
        emit StakeETHTallyReset();
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
        nonReentrant
    {
        uint256 requiredETH = validators.length * FULL_STAKE;

        // Check there is enough WETH from the deposits sitting in this strategy contract
        require(
            requiredETH <= IWETH9(WETH).balanceOf(address(this)),
            "Insufficient WETH"
        );
        require(
            activeDepositedValidators + validators.length <= MAX_VALIDATORS,
            "Max validators reached"
        );

        require(
            stakeETHTally + requiredETH <= stakeETHThreshold,
            "Staking ETH over threshold"
        );
        stakeETHTally += requiredETH;

        // Convert required ETH from WETH
        IWETH9(WETH).withdraw(requiredETH);
        _wethWithdrawn(requiredETH);

        /* 0x01 to indicate that withdrawal credentials will contain an EOA address that the sweeping function
         * can sweep funds to.
         * bytes11(0) to fill up the required zeros
         * remaining bytes20 are for the address
         */
        bytes memory withdrawalCredentials = abi.encodePacked(
            bytes1(0x01),
            bytes11(0),
            address(this)
        );

        // For each validator
        for (uint256 i = 0; i < validators.length; ++i) {
            bytes32 pubKeyHash = keccak256(validators[i].pubkey);

            require(
                validatorsStates[pubKeyHash] == VALIDATOR_STATE.REGISTERED,
                "Validator not registered"
            );

            IDepositContract(BEACON_CHAIN_DEPOSIT_CONTRACT).deposit{
                value: FULL_STAKE
            }(
                validators[i].pubkey,
                withdrawalCredentials,
                validators[i].signature,
                validators[i].depositDataRoot
            );

            validatorsStates[pubKeyHash] = VALIDATOR_STATE.STAKED;

            emit ETHStaked(pubKeyHash, validators[i].pubkey, FULL_STAKE);
        }
        // save gas by changing this storage variable only once rather each time in the loop.
        activeDepositedValidators += validators.length;
    }

    // slither-disable-end reentrancy-eth

    /// @notice Registers a new validator in the SSV Cluster.
    /// Only the registrator can call this function.
    /// @param publicKeys The public keys of the validators
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param sharesData The shares data for each validator
    /// @param ssvAmount The amount of SSV tokens to be deposited to the SSV cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    // slither-disable-start reentrancy-no-eth
    function registerSsvValidators(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        bytes[] calldata sharesData,
        uint256 ssvAmount,
        Cluster calldata cluster
    ) external onlyRegistrator whenNotPaused {
        require(
            publicKeys.length == sharesData.length,
            "Pubkey sharesData mismatch"
        );
        // Check each public key has not already been used
        bytes32 pubKeyHash;
        VALIDATOR_STATE currentState;
        for (uint256 i = 0; i < publicKeys.length; ++i) {
            pubKeyHash = keccak256(publicKeys[i]);
            currentState = validatorsStates[pubKeyHash];
            require(
                currentState == VALIDATOR_STATE.NON_REGISTERED,
                "Validator already registered"
            );

            validatorsStates[pubKeyHash] = VALIDATOR_STATE.REGISTERED;

            emit SSVValidatorRegistered(pubKeyHash, publicKeys[i], operatorIds);
        }

        ISSVNetwork(SSV_NETWORK).bulkRegisterValidator(
            publicKeys,
            operatorIds,
            sharesData,
            ssvAmount,
            cluster
        );
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Exit a validator from the Beacon chain.
    /// The staked ETH will eventually swept to this native staking strategy.
    /// Only the registrator can call this function.
    /// @param publicKey The public key of the validator
    /// @param operatorIds The operator IDs of the SSV Cluster
    // slither-disable-start reentrancy-no-eth
    function exitSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external onlyRegistrator whenNotPaused {
        bytes32 pubKeyHash = keccak256(publicKey);
        VALIDATOR_STATE currentState = validatorsStates[pubKeyHash];
        require(currentState == VALIDATOR_STATE.STAKED, "Validator not staked");

        ISSVNetwork(SSV_NETWORK).exitValidator(publicKey, operatorIds);

        validatorsStates[pubKeyHash] = VALIDATOR_STATE.EXITING;

        emit SSVValidatorExitInitiated(pubKeyHash, publicKey, operatorIds);
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Remove a validator from the SSV Cluster.
    /// Make sure `exitSsvValidator` is called before and the validate has exited the Beacon chain.
    /// If removed before the validator has exited the beacon chain will result in the validator being slashed.
    /// Only the registrator can call this function.
    /// @param publicKey The public key of the validator
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    // slither-disable-start reentrancy-no-eth
    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external onlyRegistrator whenNotPaused {
        bytes32 pubKeyHash = keccak256(publicKey);
        VALIDATOR_STATE currentState = validatorsStates[pubKeyHash];
        // Can remove SSV validators that were incorrectly registered and can not be deposited to.
        require(
            currentState == VALIDATOR_STATE.EXITING ||
                currentState == VALIDATOR_STATE.REGISTERED,
            "Validator not regd or exiting"
        );

        ISSVNetwork(SSV_NETWORK).removeValidator(
            publicKey,
            operatorIds,
            cluster
        );

        validatorsStates[pubKeyHash] = VALIDATOR_STATE.EXIT_COMPLETE;

        emit SSVValidatorExitCompleted(pubKeyHash, publicKey, operatorIds);
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Deposits more SSV Tokens to the SSV Network contract which is used to pay the SSV Operators.
    /// @dev A SSV cluster is defined by the SSVOwnerAddress and the set of operatorIds.
    /// uses "onlyStrategist" modifier so continuous front-running can't DOS our maintenance service
    /// that tries to top up SSV tokens.
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param ssvAmount The amount of SSV tokens to be deposited to the SSV cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    function depositSSV(
        uint64[] memory operatorIds,
        uint256 ssvAmount,
        Cluster memory cluster
    ) external onlyStrategist {
        ISSVNetwork(SSV_NETWORK).deposit(
            address(this),
            operatorIds,
            ssvAmount,
            cluster
        );
    }

    /// @notice Withdraws excess SSV Tokens from the SSV Network contract which was used to pay the SSV Operators.
    /// @dev A SSV cluster is defined by the SSVOwnerAddress and the set of operatorIds.
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param ssvAmount The amount of SSV tokens to be deposited to the SSV cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    function withdrawSSV(
        uint64[] memory operatorIds,
        uint256 ssvAmount,
        Cluster memory cluster
    ) external onlyGovernor {
        ISSVNetwork(SSV_NETWORK).withdraw(operatorIds, ssvAmount, cluster);
    }

    /***************************************
                New Consolidation
    ****************************************/

    function requestConsolidation(
        bytes[] calldata _sourcePubKeys,
        bytes calldata _targetPubKey,
        address _intermediateConsolidationStrategy,
        address _targetConsolidationStrategy
    ) external nonReentrant whenNotPaused onlyGovernor {
        require(consolidationCount == 0, "Cons. already in progress");
        bytes32 _targetPubKeyHash = keccak256(_targetPubKey);
        bytes32 sourcePubKeyHash;
        for (uint256 i = 0; i < _sourcePubKeys.length; ++i) {
            // hash the source validator's public key using the Beacon Chain's format
            sourcePubKeyHash = keccak256(_sourcePubKeys[i]);
            // TODO: Why compare hashed amounts and not the non hashed pubkeys?
            require(sourcePubKeyHash != _targetPubKeyHash, "Self consolidation");
            require(
                validatorsStates[sourcePubKeyHash] == VALIDATOR_STATE.STAKED,
                "Source validator not staked"
            );

            // Request consolidation from source to target validator
            BeaconConsolidation.request(_sourcePubKeys[i], _targetPubKey);

            // Store the state of the source validator as exiting so it can be removed
            // after the consolidation is confirmed
            validatorsStates[sourcePubKeyHash] == VALIDATOR_STATE.EXITING;
        }

        // Call the new compounding staking strategy to validate the target validator
        IConsolidationStrategy(_intermediateConsolidationStrategy).requestConsolidation(
            _targetPubKey,
            _targetConsolidationStrategy
        );

        // Store the consolidation state
        consolidationCount = _sourcePubKeys.length;
        intermediateConsolidationStrategy = _intermediateConsolidationStrategy;

        // Pause the strategy to prevent further consolidations or validator exits
        _pause();

        emit ConsolidationRequested(
            _sourcePubKeys,
            _targetPubKey,
            _intermediateConsolidationStrategy,
            _sourcePubKeys.length
        );
    }

    function confirmConsolidation()
        external
        nonReentrant
        whenPaused
        returns (uint256 consolidationCount_)
    {
        // Check the caller is the target staking strategy
        require(
            msg.sender == intermediateConsolidationStrategy,
            "Not target strategy"
        );

        // Load the number of validators being consolidated into memory
        consolidationCount_ = consolidationCount;

        // Need to check this is from the new staking strategy
        require(consolidationCount_ > 0, "No consolidation in progress");

        // Store the reduced number of active deposited validators
        // managed by this strategy
        activeDepositedValidators -= consolidationCount_;

        // Reset the consolidation count
        consolidationCount = 0;
        intermediateConsolidationStrategy = address(0);

        // Unpause the strategy to allow further operations
        _unpause();

        emit ConsolidationConfirmed(
            consolidationCount_,
            activeDepositedValidators
        );
    }

    /// @notice Hash a validator public key using the Beacon Chain's format
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    /***************************************
                 Abstract
    ****************************************/

    /// @dev Called when WETH is withdrawn from the strategy or staked to a validator so
    /// the strategy knows how much WETH it has on deposit.
    /// This is so it can emit the correct amount in the Deposit event in depositAll().
    function _wethWithdrawn(uint256 _amount) internal virtual;
}
