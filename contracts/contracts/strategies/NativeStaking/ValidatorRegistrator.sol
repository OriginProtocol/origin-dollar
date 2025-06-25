// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Governable } from "../../governance/Governable.sol";
import { IDepositContract } from "../../interfaces/IDepositContract.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { BeaconRoots } from "../../beacon/BeaconRoots.sol";
import { BeaconProofs } from "../../beacon/BeaconProofs.sol";
import { IBeaconOracle } from "../../interfaces/IBeaconOracle.sol";

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
    address public immutable BEACON_ORACLE;

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

    // Deposit data
    struct PendingDeposit {
        bytes32 pubKeyHash;
        uint128 amount; // in wei
        uint64 blockNumber;
        DepositStatus status;
        uint256 rootsIndex;
    }
    /// @notice Mapping of the root of a deposit (depositDataRoot) to its data
    mapping(bytes32 => PendingDeposit) public deposits;
    /// @notice List of deposit roots that are still to be proven as processed on the beacon chain
    bytes32[] public depositsRoots;
    /// @notice Total amount in wei of deposits waiting to be processed on the beacon chain
    uint256 public totalDeposits;

    // Validator data
    /// @notice List of validators that have been proven to exist on the beacon chain.
    /// These have had a deposit processed and the validator's balance increased.
    /// Validators will be removed from this list when its proven they have a zero balance.
    uint256[] public provedValidators;

    struct Balances {
        uint64 blockNumber;
        uint64 timestamp; // timestamp of the snap
        // TODO squash into a single slot
        uint256 wethBalance;
        uint256 ethBalance;
    }
    // TODO is it more efficient to use the block root rather than hashing it?
    /// @notice Mapping of the block root to the balances at that slot
    mapping(bytes32 => Balances) public snappedBalances;
    // TODO squash these into a single slot
    uint256 public lastSnapTimestamp;
    uint256 public lastProvenBalance;

    // For future use
    uint256[40] private __gap;

    enum VALIDATOR_STATE {
        NON_REGISTERED, // validator is not registered on the SSV network
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        EXITING, // exit message has been posted and validator is in the process of exiting
        EXIT_COMPLETE, // validator has funds withdrawn to the EigenPod and is removed from the SSV
        PROVEN // validator has been proven to exist on the beacon chain
    }
    enum DepositStatus {
        UNKNOWN,
        PENDING, // deposit is pending and waiting to be proven
        PROVEN // deposit has been proven and is ready to be staked
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
    /// @param _maxValidators Maximum number of validators that can be registered in the strategy
    /// @param _beaconOracle Address of the Beacon Oracle contract that maps block numbers to slots
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork,
        uint256 _maxValidators,
        address _beaconOracle
    ) {
        WETH = _wethAddress;
        BEACON_CHAIN_DEPOSIT_CONTRACT = _beaconChainDepositContract;
        SSV_NETWORK = _ssvNetwork;
        VAULT_ADDRESS = _vaultAddress;
        MAX_VALIDATORS = _maxValidators;
        BEACON_ORACLE = _beaconOracle;
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

            // Post Pectra there can be multiple deposits to the same validator
            require(
                validatorsStates[pubKeyHash] == VALIDATOR_STATE.REGISTERED ||
                    validatorsStates[pubKeyHash] == VALIDATOR_STATE.STAKED,
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

            // Hash using Beacon Chains SSZ BLSPubkey format
            bytes32 pubKeyBeaconHash = sha256(
                abi.encodePacked(validators[i].pubkey, bytes16(0))
            );
            deposits[validators[i].depositDataRoot] = PendingDeposit({
                pubKeyHash: pubKeyBeaconHash,
                amount: SafeCast.toUint128(FULL_STAKE),
                blockNumber: SafeCast.toUint64(block.number),
                status: DepositStatus.PENDING,
                rootsIndex: depositsRoots.length
            });
            depositsRoots.push(validators[i].depositDataRoot);
            totalDeposits += FULL_STAKE;

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
        require(
            currentState == VALIDATOR_STATE.STAKED ||
                currentState == VALIDATOR_STATE.PROVEN,
            "Validator not staked"
        );

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

    /***************************************
                SSV Management
    ****************************************/

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
                Beacon Chain Proofs
    ****************************************/

    /// @notice Proves a previous deposit has been processed by the beacon chain
    /// which means the validator exists and has an increased balance.
    function proveDeposit(
        bytes32 depositDataRoot,
        uint256 validatorIndex,
        bytes calldata validatorPubicKey,
        uint64 firstPendingDepositSlot,
        uint64 timestamp,
        // BeaconBlock.state.validators[validatorIndex].pubkey
        bytes calldata validatorPubKeyProof,
        // BeaconBlock.BeaconBlockBody.deposits[0].slot
        bytes calldata firstPendingDepositSlotProof
    ) external {
        bytes32 blockRoot = BeaconRoots.parentBlockRoot(timestamp);

        // Load into memory the previously saved deposit data
        PendingDeposit memory deposit = deposits[depositDataRoot];
        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");
        // Convert the block number at the time the deposit was made to a slot
        // and verify it before the next deposit to be processed by the beacon chain.
        // If the slot of the deposit is the same as the next deposit to be processed by the beacon chain,
        // then we can't be certain if the deposit was processed or not. Revert in this case.
        require(
            IBeaconOracle(BEACON_ORACLE).blockToSlot(deposit.blockNumber) <
                firstPendingDepositSlot,
            "Deposit not processed"
        );
        {
            // Check the validator public key matches the hashed deposit public key
            // Hash using Beacon Chains SSZ BLSPubkey format
            bytes32 pubKeyBeaconHash = sha256(
                abi.encodePacked(validatorPubicKey, bytes16(0))
            );
            require(deposit.pubKeyHash == pubKeyBeaconHash, "Pubkey mismatch");
        }

        // Verify the validator index has the same public key as the deposit
        BeaconProofs.verifyValidatorPubkey(
            blockRoot,
            deposit.pubKeyHash,
            validatorPubKeyProof,
            validatorIndex
        );

        // Verify the first pending deposit slot matches the beacon chain
        BeaconProofs.verifyFirstPendingDepositSlot(
            blockRoot,
            firstPendingDepositSlot,
            firstPendingDepositSlotProof
        );

        // After verifying the proof
        deposits[depositDataRoot].status = DepositStatus.PROVEN;
        // Move the last deposit to the index of the proven deposit
        depositsRoots[deposit.rootsIndex] = depositsRoots[
            depositsRoots.length - 1
        ];
        // Delete the last deposit from the list
        depositsRoots.pop();
        // Reduce the total pending deposits in wei
        totalDeposits -= deposit.amount;

        // TODO need to check the state transitions for existing validators
        bytes32 pubKeyHash = keccak256(validatorPubicKey);
        if (validatorsStates[pubKeyHash] != VALIDATOR_STATE.PROVEN) {
            // Store the validator state as PROVEN
            validatorsStates[pubKeyHash] = VALIDATOR_STATE.PROVEN;

            // Add the new validator to the list of proved validators
            provedValidators.push(validatorIndex);
        }
    }

    function snapBalances() public {
        bytes32 blockRoot = BeaconRoots.parentBlockRoot(
            SafeCast.toUint64(block.timestamp)
        );
        // Get the current WETH balance
        uint256 wethBalance = IWETH9(WETH).balanceOf(address(this));
        // Get the current ETH balance
        uint256 ethBalance = address(this).balance;

        // Store the balances in the mapping
        snappedBalances[blockRoot] = Balances({
            blockNumber: SafeCast.toUint64(block.number),
            timestamp: SafeCast.toUint64(block.timestamp),
            wethBalance: wethBalance,
            ethBalance: ethBalance
        });

        // Store the snapped timestamp
        lastSnapTimestamp = block.timestamp;
    }

    function proveBalances(
        bytes32 blockRoot,
        uint64 firstPendingDepositSlot,
        // BeaconBlock.BeaconBlockBody.deposits[0].slot
        bytes calldata firstPendingDepositSlotProof,
        bytes32 balancesContainerRoot,
        // BeaconBlock.state.validators
        bytes calldata validatorContainerProof,
        bytes32[] calldata validatorBalanceRoots,
        // BeaconBlock.state.validators[validatorIndex].balance
        bytes[] calldata validatorBalanceProofs
    ) external {
        // Load the last snapped balances into memory
        Balances memory balancesMem = snappedBalances[blockRoot];
        require(balancesMem.blockNumber > 0, "No snapped balances");
        require(balancesMem.timestamp == lastSnapTimestamp, "Stale snap");

        // Break up the into blocks to avoid stack too deep
        {
            // convert the slot of the first pending deposit to a block number
            uint64 firstPendingDepositBlockNumber = IBeaconOracle(BEACON_ORACLE)
                .slotToBlock(firstPendingDepositSlot);

            // Prove the first pending deposit slot to the beacon block root
            BeaconProofs.verifyFirstPendingDepositSlot(
                blockRoot,
                firstPendingDepositSlot,
                firstPendingDepositSlotProof
            );

            // For each native staking contract's deposits
            uint256 depositsCount = depositsRoots.length;
            for (uint256 i = 0; i < depositsCount; ++i) {
                bytes32 depositDataRoot = depositsRoots[i];

                // Check the stored deposit is still waiting to be processed on the beacon chain
                // If it has it will need to be proven with `proveDeposit`
                require(
                    deposits[depositDataRoot].blockNumber >
                        firstPendingDepositBlockNumber,
                    "Deposit processed"
                );
            }
        }

        // prove beaconBlock.state.balances root to beacon block root
        BeaconProofs.verifyBalancesContainer(
            blockRoot,
            balancesContainerRoot,
            validatorContainerProof
        );

        uint256 totalValidatorBalance = 0;
        uint256 provenValidatorsCount = provedValidators.length;
        // for each validator
        for (uint256 i = 0; i < provenValidatorsCount; ++i) {
            // Load the validator index from storage
            uint256 validatorIndex = provedValidators[i];

            // prove validator's balance in beaconBlock.state.balances to the
            // beaconBlock.state.balances container root

            // Prove the validator's balance to the beacon block root
            uint256 validatorBalance = BeaconProofs.verifyValidatorBalance(
                balancesContainerRoot,
                validatorBalanceRoots[i],
                validatorBalanceProofs[i],
                validatorIndex
            );

            // total validator balances
            totalValidatorBalance += validatorBalance;

            // If the validator balance is zero
            if (validatorBalance == 0) {
                // remove it from the list of proved validators
                // Move the last validator to the current index
                provedValidators[i] = provedValidators[
                    provenValidatorsCount - 1
                ];
                // Delete the last validator from the list
                provedValidators.pop();
            }
        }

        // store the proved balance in storage
        lastProvenBalance =
            totalDeposits +
            totalValidatorBalance +
            balancesMem.wethBalance +
            balancesMem.ethBalance;
    }

    /***************************************
                 Abstract
    ****************************************/

    /// @dev Called when WETH is withdrawn from the strategy or staked to a validator so
    /// the strategy knows how much WETH it has on deposit.
    /// This is so it can emit the correct amount in the Deposit event in depositAll().
    function _wethWithdrawn(uint256 _amount) internal virtual;
}
