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
    uint256 private deprecated_stakeETHThreshold;
    /// @notice Amount of ETH that has been staked since the `stakingMonitor` last called `resetStakeETHTally`.
    /// This can not go above `stakeETHThreshold`.
    uint256 private deprecated_stakeETHTally;

    /// Deposit data for new compounding validators.
    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param amountWei Amount of ETH in wei that has been deposited to the beacon chain deposit contract
    /// @param blockNumber Block number when the deposit was made
    /// @param slot The slot that is on or after when the deposit was made. This needs to be assigned
    /// by the `assignSlotToDeposit` function.
    /// @param rootsIndex The index of the deposit in the list of active deposits
    /// @param status The status of the deposit, either PENDING or PROVEN
    struct DepositData {
        bytes32 pubKeyHash;
        uint256 amountWei;
        uint64 blockNumber;
        uint64 slot;
        uint64 rootsIndex;
        DepositStatus status;
    }
    /// @notice Mapping of the root of a deposit (depositDataRoot) to its data
    mapping(bytes32 => DepositData) public deposits;
    /// @notice List of deposit roots that are still to be proven as processed on the beacon chain
    bytes32[] public depositsRoots;
    /// @notice Total amount in wei of deposits waiting to be processed on the beacon chain
    uint256 public totalDeposits;

    // Validator data
    /// @notice List of validators that have been proven to exist on the beacon chain.
    /// These have had a deposit processed and the validator's balance increased.
    /// Validators will be removed from this list when its proven they have a zero balance.
    uint256[] public provedValidators;
    /// @notice State of the new compounding validators with a 0x02 withdrawal credential prefix.
    /// Uses the Beacon chain hashing for BLSPubkey which is
    /// sha256(abi.encodePacked(validator.pubkey, bytes16(0)))
    mapping(bytes32 => VALIDATOR_STATE) public compoundingValidatorState;

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
        UNKNOWN, // default value
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

    /// @notice Stakes WETH to a compounding validator
    /// @param validator validator data needed to stake.
    /// The `ValidatorStakeData` struct contains the pubkey, signature and depositDataRoot.
    /// Only the registrator can call this function.
    /// @param depositAmount The amount of WETH to stake to the validator in wei.
    // slither-disable-start reentrancy-eth
    function stakeEth(
        ValidatorStakeData calldata validator,
        uint256 depositAmount
    ) external onlyRegistrator whenNotPaused nonReentrant {
        // Check there is enough WETH from the deposits sitting in this strategy contract
        require(
            depositAmount <= IWETH9(WETH).balanceOf(address(this)),
            "Insufficient WETH"
        );

        // Convert required ETH from WETH
        IWETH9(WETH).withdraw(depositAmount);
        _wethWithdrawn(depositAmount);

        /* 0x02 to indicate that withdrawal credentials are for a compounding validator
         * that was introduced with the Pectra upgrade.
         * bytes11(0) to fill up the required zeros
         * remaining bytes20 are for the address
         */
        bytes memory withdrawalCredentials = abi.encodePacked(
            bytes1(0x02),
            bytes11(0),
            address(this)
        );

        VALIDATOR_STATE sweepingState = validatorsStates[
            keccak256(validator.pubkey)
        ];
        // Hash the public key using the Beacon Chain's hashing for BLSPubkey
        bytes32 pubKeyHash = sha256(
            abi.encodePacked(validator.pubkey, bytes16(0))
        );
        VALIDATOR_STATE compoundingState = compoundingValidatorState[
            pubKeyHash
        ];
        require(
            sweepingState == VALIDATOR_STATE.NON_REGISTERED &&
                (compoundingState == VALIDATOR_STATE.REGISTERED ||
                    // Post Pectra there can be multiple deposits to the same validator
                    compoundingState == VALIDATOR_STATE.STAKED),
            "Validator not registered"
        );

        // Deposit to the Beacon Chain deposit contract.
        // This will create a deposit in the beacon chain's pending deposit queue.
        IDepositContract(BEACON_CHAIN_DEPOSIT_CONTRACT).deposit{
            value: depositAmount
        }(
            validator.pubkey,
            withdrawalCredentials,
            validator.signature,
            validator.depositDataRoot
        );

        //// Update contract storage
        // Store the validator state if needed
        if (compoundingState == VALIDATOR_STATE.REGISTERED) {
            validatorsStates[pubKeyHash] = VALIDATOR_STATE.STAKED;
        }
        // Store the deposit data for proveDeposit and proveBalances
        // Hash using Beacon Chains SSZ BLSPubkey format
        deposits[validator.depositDataRoot] = DepositData({
            pubKeyHash: pubKeyHash,
            amountWei: depositAmount,
            blockNumber: SafeCast.toUint64(block.number),
            slot: type(uint64).max, // Set to max until proven
            rootsIndex: SafeCast.toUint32(depositsRoots.length),
            status: DepositStatus.PENDING
        });
        depositsRoots.push(validator.depositDataRoot);
        totalDeposits += depositAmount;

        emit ETHStaked(pubKeyHash, validator.pubkey, depositAmount);
    }

    // slither-disable-end reentrancy-eth

    /// @notice Registers multiple validators in the SSV Cluster.
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
        for (uint256 i = 0; i < publicKeys.length; ++i) {
            // Check the old sweeping validators
            pubKeyHash = keccak256(publicKeys[i]);
            require(
                validatorsStates[pubKeyHash] == VALIDATOR_STATE.NON_REGISTERED,
                "Validator already registered"
            );

            // Check the new compounding validators
            // Hash the public key using the Beacon Chain's format
            pubKeyHash = sha256(abi.encodePacked(publicKeys[i], bytes16(0)));
            require(
                compoundingValidatorState[pubKeyHash] ==
                    VALIDATOR_STATE.NON_REGISTERED,
                "Validator already registered"
            );

            // We can only deposit to a new compounding validator
            compoundingValidatorState[pubKeyHash] = VALIDATOR_STATE.REGISTERED;

            // Emits using the Beacon chain hashing for BLSPubkey
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

    /// @notice Exit an old sweeping validator from the Beacon chain.
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

    /// @notice Remove a sweeping validator from the SSV Cluster.
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

    /// @notice Maps a deposit to a beacon chain slot that is on or after the deposit was made.
    /// This uses the Beacon Oracle that uses merkle proofs to map blocks to slots.
    /// Ideally, the mapped block number is close to the deposit block number as this can delay when
    /// the deposit can be proven. It will also delay when the balances can be successfully proven.
    /// @param depositDataRoot The root of the previous deposit data
    /// @param mappedBlockNumber The block number that has been mapped in the Beacon Oracle.
    /// The mapped block number must be on or after the block the deposit was made in.
    function assignSlotToDeposit(
        bytes32 depositDataRoot,
        uint64 mappedBlockNumber
    ) external nonReentrant {
        require(
            deposits[depositDataRoot].status == DepositStatus.PENDING,
            "Deposit not pending"
        );
        // The deposit needs to be before or at the time as the mapped block number.
        // The deposit can not be after the block number mapped to a slot.
        require(
            deposits[depositDataRoot].blockNumber <= mappedBlockNumber,
            "block not on or after deposit"
        );
        //
        // require(block.number - provenBlockNumber < 6000, "Block too old");

        // Store the slot that is on or after the deposit was made
        deposits[depositDataRoot].slot = IBeaconOracle(BEACON_ORACLE)
            .slotToBlock(mappedBlockNumber);
    }

    /// @notice Proves a previous deposit has been processed by the beacon chain
    /// which means the validator exists and has an increased balance.
    function proveDeposit(
        bytes32 depositDataRoot,
        uint256 validatorIndex,
        uint64 firstPendingDepositSlot,
        uint64 parentBlockTimestamp,
        // BeaconBlock.state.validators[validatorIndex].pubkey
        bytes calldata validatorPubKeyProof,
        // BeaconBlock.BeaconBlockBody.deposits[0].slot
        bytes calldata firstPendingDepositSlotProof
    ) external nonReentrant {
        // Load into memory the previously saved deposit data
        DepositData memory deposit = deposits[depositDataRoot];
        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");
        require(
            deposit.slot < firstPendingDepositSlot,
            "Deposit not processed"
        );

        bytes32 blockRoot = BeaconRoots.parentBlockRoot(parentBlockTimestamp);
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

        // After verifying the proof, update the contract storage
        deposits[depositDataRoot].status = DepositStatus.PROVEN;
        // Move the last deposit to the index of the proven deposit
        depositsRoots[deposit.rootsIndex] = depositsRoots[
            depositsRoots.length - 1
        ];
        // Delete the last deposit from the list
        depositsRoots.pop();
        // Reduce the total pending deposits in wei
        totalDeposits -= deposit.amountWei;

        // TODO need to check the state transitions for existing validators
        if (
            compoundingValidatorState[deposit.pubKeyHash] !=
            VALIDATOR_STATE.PROVEN
        ) {
            // Store the validator state as PROVEN
            compoundingValidatorState[deposit.pubKeyHash] = VALIDATOR_STATE
                .PROVEN;

            // Add the new validator to the list of proved validators
            provedValidators.push(validatorIndex);
        }
    }

    function snapBalances() public nonReentrant {
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

    /***************************************
                 Abstract
    ****************************************/

    /// @dev Called when WETH is withdrawn from the strategy or staked to a validator so
    /// the strategy knows how much WETH it has on deposit.
    /// This is so it can emit the correct amount in the Deposit event in depositAll().
    function _wethWithdrawn(uint256 _amount) internal virtual;
}
