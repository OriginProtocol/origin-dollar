// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Governable } from "../../governance/Governable.sol";
import { IConsolidationSource } from "../../interfaces/IConsolidation.sol";
import { IDepositContract } from "../../interfaces/IDepositContract.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { BeaconRoots } from "../../beacon/BeaconRoots.sol";
import { IBeaconProofs } from "../../interfaces/IBeaconProofs.sol";
import { IBeaconOracle } from "../../interfaces/IBeaconOracle.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

/**
 * @title Validator lifecycle management contract
 * @notice This contract implements all the required functionality to register, deposit, exit and remove validators.
 * @author Origin Protocol Inc
 */
abstract contract CompoundingValidatorManager is Governable, Pausable {
    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the beacon chain deposit contract
    address public immutable BEACON_CHAIN_DEPOSIT_CONTRACT;
    /// @notice The address of the SSV Network contract used to interface with
    address public immutable SSV_NETWORK;
    /// @notice Address of the OETH Vault proxy contract
    address public immutable VAULT_ADDRESS;
    address public immutable BEACON_ORACLE;
    address public immutable BEACON_PROOFS;

    /// @notice Address of the registrator - allowed to register, exit and remove validators
    address public validatorRegistrator;

    /// Deposit data for new compounding validators.

    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param amountWei Amount of ETH in wei that has been deposited to the beacon chain deposit contract
    /// @param blockNumber Block number when the deposit was made
    /// @param depositIndex The index of the deposit in the list of active deposits
    /// @param status The status of the deposit, either PENDING or PROVEN
    struct DepositData {
        bytes32 pubKeyHash;
        uint64 amountGwei;
        uint64 blockNumber;
        uint32 depositIndex;
        DepositStatus status;
    }
    /// @notice Mapping of the root of a deposit (depositDataRoot) to its data
    mapping(bytes32 => DepositData) public deposits;
    /// @notice List of deposit roots that are still to be verified as processed on the beacon chain
    bytes32[] public depositsRoots;

    // Validator data

    /// @notice List of validator indexes that have been verified to exist on the beacon chain.
    /// These have had a deposit processed and the validator's balance increased.
    /// Validators will be removed from this list when its verified they have a zero balance.
    uint64[] public verifiedValidators;
    /// @notice State of the new compounding validators with a 0x02 withdrawal credential prefix.
    /// Uses the Beacon chain hashing for BLSPubkey which is
    /// sha256(abi.encodePacked(validator.pubkey, bytes16(0)))
    mapping(bytes32 => VALIDATOR_STATE) public validatorState;

    /// @param timestamp Timestamp of the snapshot
    /// @param wethBalance The balance of WETH in the strategy contract at the snapshot
    /// @param ethBalance The balance of ETH in the strategy contract at the snapshot
    struct Balances {
        uint64 timestamp;
        uint128 wethBalance;
        uint128 ethBalance;
    }
    // TODO is it more efficient to use the block root rather than hashing it?
    /// @notice Mapping of the block root to the balances at that slot
    mapping(bytes32 => Balances) public snappedBalances;
    uint64 public lastSnapTimestamp;
    uint128 public lastVerifiedBalance;

    bytes32 public consolidationLastPubKeyHash;
    address public consolidationSourceStrategy;
    mapping(address => bool) public consolidationSourceStrategies;

    // For future use
    uint256[40] private __gap;

    enum VALIDATOR_STATE {
        NON_REGISTERED, // validator is not registered on the SSV network
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        VERIFIED, // validator has been verified to exist on the beacon chain
        EXITING, // exit message has been posted and validator is in the process of exiting
        EXIT_COMPLETE // validator has funds withdrawn to the EigenPod and is removed from the SSV
    }
    enum DepositStatus {
        UNKNOWN, // default value
        PENDING, // deposit is pending and waiting to be  verified
        VERIFIED // deposit has been verified and is ready to be staked
    }

    event RegistratorChanged(address indexed newAddress);
    event SourceStrategyAdded(address indexed strategy);
    event StakingMonitorChanged(address indexed newAddress);
    event ETHStaked(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint256 amountWei
    );
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
        bytes32 indexed lastSourcePubKeyHash,
        bytes32 indexed targetPubKeyHash,
        address indexed sourceStrategy
    );
    event SnappedBalances(
        bytes32 indexed blockRoot,
        uint256 indexed blockNumber,
        uint256 indexed timestamp,
        uint256 wethBalance,
        uint256 ethBalance
    );

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
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
    /// @param _beaconOracle Address of the Beacon Oracle contract that maps block numbers to slots
    /// @param _beaconProofs Address of the Beacon Proofs contract that verifies beacon chain data
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork,
        address _beaconOracle,
        address _beaconProofs
    ) {
        WETH = _wethAddress;
        BEACON_CHAIN_DEPOSIT_CONTRACT = _beaconChainDepositContract;
        SSV_NETWORK = _ssvNetwork;
        VAULT_ADDRESS = _vaultAddress;
        BEACON_ORACLE = _beaconOracle;
        BEACON_PROOFS = _beaconProofs;
    }

    /***************************************
                Admin Functions
    ****************************************/

    /// @notice Set the address of the registrator which can register, exit and remove validators
    function setRegistrator(address _address) external onlyGovernor {
        validatorRegistrator = _address;
        emit RegistratorChanged(_address);
    }

    /// @notice Adds support for a legacy staking strategy that can be used for consolidation.
    function addSourceStrategy(address _strategy) external onlyGovernor {
        consolidationSourceStrategies[_strategy] = true;

        emit SourceStrategyAdded(_strategy);
    }

    /***************************************`
                Validator Management
    ****************************************/

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
            // Check the new compounding validators
            // Hash the public key using the Beacon Chain's format
            pubKeyHash = _hashPubKey(publicKeys[i]);
            require(
                validatorState[pubKeyHash] == VALIDATOR_STATE.NON_REGISTERED,
                "Validator already registered"
            );

            // Store the validator state as registered
            validatorState[pubKeyHash] = VALIDATOR_STATE.REGISTERED;

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

    /// @notice Stakes WETH to a compounding validator
    /// @param validator validator data needed to stake.
    /// The `ValidatorStakeData` struct contains the pubkey, signature and depositDataRoot.
    /// Only the registrator can call this function.
    /// @param depositAmountGwei The amount of WETH to stake to the validator in Gwei.
    // slither-disable-start reentrancy-eth
    function stakeEth(
        ValidatorStakeData calldata validator,
        uint64 depositAmountGwei
    ) external onlyRegistrator whenNotPaused nonReentrant {
        uint256 depositAmountWei = depositAmountGwei * 1 gwei;
        // Check there is enough WETH from the deposits sitting in this strategy contract
        // There could be ETH from withdrawals but we'll ignore that. If it's really needed
        // the ETH can be withdrawn and then deposited back to the strategy.
        require(
            depositAmountWei <= IWETH9(WETH).balanceOf(address(this)),
            "Insufficient WETH"
        );

        // Convert required ETH from WETH
        IWETH9(WETH).withdraw(depositAmountWei);
        _wethWithdrawn(depositAmountWei);

        // Hash the public key using the Beacon Chain's hashing for BLSPubkey
        bytes32 pubKeyHash = _hashPubKey(validator.pubkey);
        VALIDATOR_STATE currentState = validatorState[pubKeyHash];
        // Can only stake to a validator has have been registered or verified.
        // Can not stake to a validator that has been staked but not yet verified.
        require(
            (currentState == VALIDATOR_STATE.REGISTERED ||
                currentState == VALIDATOR_STATE.VERIFIED),
            "Not registered or verified"
        );

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

        // Deposit to the Beacon Chain deposit contract.
        // This will create a deposit in the beacon chain's pending deposit queue.
        IDepositContract(BEACON_CHAIN_DEPOSIT_CONTRACT).deposit{
            value: depositAmountWei
        }(
            validator.pubkey,
            withdrawalCredentials,
            validator.signature,
            validator.depositDataRoot
        );

        //// Update contract storage
        // Store the validator state if needed
        if (currentState == VALIDATOR_STATE.REGISTERED) {
            validatorState[pubKeyHash] = VALIDATOR_STATE.STAKED;
        }
        // Store the deposit data for verifyDeposit and verifyBalances
        deposits[validator.depositDataRoot] = DepositData({
            pubKeyHash: pubKeyHash,
            amountGwei: depositAmountGwei,
            blockNumber: SafeCast.toUint64(block.number),
            depositIndex: SafeCast.toUint32(depositsRoots.length),
            status: DepositStatus.PENDING
        });
        depositsRoots.push(validator.depositDataRoot);

        // Take a new snap of the balances so the new deposits have to be included in the balances verification
        _snapBalances();

        emit ETHStaked(pubKeyHash, validator.pubkey, depositAmountWei);
    }

    // slither-disable-end reentrancy-eth

    /// @notice Exit a validator from the Beacon chain.
    /// The staked ETH will eventually be withdrawn to this staking strategy.
    /// Only the registrator can call this function.
    /// @param publicKey The public key of the validator
    /// @param operatorIds The operator IDs of the SSV Cluster
    // slither-disable-start reentrancy-no-eth
    function exitSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external onlyRegistrator whenNotPaused {
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);
        VALIDATOR_STATE currentState = validatorState[pubKeyHash];
        require(
            currentState == VALIDATOR_STATE.VERIFIED,
            "Validator not verified"
        );

        ISSVNetwork(SSV_NETWORK).exitValidator(publicKey, operatorIds);

        validatorState[pubKeyHash] = VALIDATOR_STATE.EXITING;

        // Do not remove from the list of verified validators.
        // This is done in the verifyBalances function once the validator's balance has been verified to be zero.

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
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);
        VALIDATOR_STATE currentState = validatorState[pubKeyHash];
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

        validatorState[pubKeyHash] = VALIDATOR_STATE.EXIT_COMPLETE;

        emit SSVValidatorExitCompleted(pubKeyHash, publicKey, operatorIds);
    }

    function requestConsolidation(
        bytes32 lastSourcePubKeyHash,
        bytes32 targetPubKeyHash
    ) external nonReentrant whenNotPaused {
        require(
            consolidationSourceStrategies[msg.sender],
            "Not a source strategy"
        );

        // The target validator must be a compounding validator that has been verified
        require(
            validatorState[targetPubKeyHash] == VALIDATOR_STATE.VERIFIED,
            "Target validator not verified"
        );

        // Ensure balances can not be verified until after the consolidation has been verified.
        lastSnapTimestamp = 0;

        // Store consolidation state
        consolidationLastPubKeyHash = lastSourcePubKeyHash;
        consolidationSourceStrategy = msg.sender;

        // Pause the strategy while the consolidation is in progress
        _pause();

        emit ConsolidationRequested(
            lastSourcePubKeyHash,
            targetPubKeyHash,
            msg.sender
        );
    }

    /***************************************
                SSV Management
    ****************************************/

    // slither-disable-end reentrancy-no-eth

    /// `depositSSV` has been removed as `deposit` on the SSVNetwork contract can be called directly
    /// by the Strategist which is already holding SSV tokens.

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

    // Putting params into a struct to avoid stack too deep errors
    struct DepositProofData {
        uint64 parentBlockTimestamp;
        uint64 mappedBlockNumber;
        uint64 validatorIndex;
        uint64 firstPendingDepositSlot;
        // BeaconBlock.state.validators[validatorIndex].pubkey
        bytes validatorPubKeyProof;
        // BeaconBlock.BeaconBlockBody.deposits[0].slot
        bytes firstPendingDepositSlotProof;
    }

    /// @notice Verifies a previous deposit has been processed by the beacon chain
    /// which means the validator exists and has an increased balance.
    function verifyDeposit(
        bytes32 depositDataRoot,
        DepositProofData calldata proofData
    ) external nonReentrant {
        // Load into memory the previously saved deposit data
        DepositData memory deposit = deposits[depositDataRoot];
        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");

        // The deposit needs to be before or at the time as the mapped block number.
        // The deposit can not be after the block number mapped to a slot.
        require(
            deposit.blockNumber <= proofData.mappedBlockNumber,
            "block not on or after deposit"
        );

        // Get the slot that is on or after the deposit was made
        uint64 mappedSlot = IBeaconOracle(BEACON_ORACLE).slotToBlock(
            proofData.mappedBlockNumber
        );

        // Check the mapped slot is before the first pending deposit slot
        require(
            mappedSlot < proofData.firstPendingDepositSlot,
            "Deposit not processed"
        );

        bytes32 blockRoot = BeaconRoots.parentBlockRoot(
            proofData.parentBlockTimestamp
        );
        // Verify the validator index has the same public key as the deposit
        IBeaconProofs(BEACON_PROOFS).verifyValidatorPubkey(
            blockRoot,
            deposit.pubKeyHash,
            proofData.validatorPubKeyProof,
            proofData.validatorIndex
        );

        // Verify the first pending deposit slot matches the beacon chain
        IBeaconProofs(BEACON_PROOFS).verifyFirstPendingDepositSlot(
            blockRoot,
            proofData.firstPendingDepositSlot,
            proofData.firstPendingDepositSlotProof
        );

        // After verifying the proof, update the contract storage
        deposits[depositDataRoot].status = DepositStatus.VERIFIED;
        // Move the last deposit to the index of the verified deposit
        depositsRoots[deposit.depositIndex] = depositsRoots[
            depositsRoots.length - 1
        ];
        // Delete the last deposit from the list
        depositsRoots.pop();

        // TODO need to check the state transitions for existing validators
        if (validatorState[deposit.pubKeyHash] != VALIDATOR_STATE.VERIFIED) {
            // Store the validator state as verified
            validatorState[deposit.pubKeyHash] = VALIDATOR_STATE.VERIFIED;

            // Add the new validator to the list of verified validators
            verifiedValidators.push(proofData.validatorIndex);
        }

        // Take a snap of the balances so the new validator balances can be verified
        _snapBalances();

        // TODO emit an event
    }

    // TODO what if the last validator was exited rather than consolidated?
    function verifyConsolidation(
        uint64 parentBlockTimestamp,
        uint64 lastValidatorIndex,
        bytes calldata validatorPubKeyProof,
        bytes32 balancesLeaf,
        bytes calldata validatorBalanceProof
    ) external onlyRegistrator {
        require(consolidationLastPubKeyHash != bytes32(0), "No consolidations");

        bytes32 blockRoot = BeaconRoots.parentBlockRoot(parentBlockTimestamp);
        // Verify the validator index has the same public key as the last source validator
        IBeaconProofs(BEACON_PROOFS).verifyValidatorPubkey(
            blockRoot,
            consolidationLastPubKeyHash,
            validatorPubKeyProof,
            lastValidatorIndex
        );

        // Verify the balance of the last validator in the consolidation batch
        // is zero. If its not then the consolidation has not been completed.
        // This proof is to the beacon block root, not the balances container root.
        uint256 validatorBalance = IBeaconProofs(BEACON_PROOFS)
            .verifyValidatorBalance(
                blockRoot,
                balancesLeaf,
                validatorBalanceProof,
                lastValidatorIndex,
                IBeaconProofs.BalanceProofLevel.BeaconBlock
            );
        require(validatorBalance == 0, "Last validator balance not zero");

        // Reset the consolidation batch
        consolidationLastPubKeyHash = bytes32(0);

        // Take a snap of the balances so the new validator balances can be verified
        _snapBalances();

        // Do not unpause until after the new validator balances have been verified

        // TODO emit an event
    }

    function snapBalances() public nonReentrant {
        _snapBalances();
    }

    function _snapBalances() internal {
        // Check no consolidation is waiting to be verified
        require(
            consolidationLastPubKeyHash == bytes32(0),
            "Consolidation in progress"
        );

        bytes32 blockRoot = BeaconRoots.parentBlockRoot(
            SafeCast.toUint64(block.timestamp)
        );
        // Get the current WETH balance
        uint256 wethBalance = IWETH9(WETH).balanceOf(address(this));
        // Get the current ETH balance
        uint256 ethBalance = address(this).balance;

        // Store the balances in the mapping
        snappedBalances[blockRoot] = Balances({
            timestamp: SafeCast.toUint64(block.timestamp),
            wethBalance: SafeCast.toUint128(wethBalance),
            ethBalance: SafeCast.toUint128(ethBalance)
        });

        // Store the snapped timestamp
        lastSnapTimestamp = SafeCast.toUint64(block.timestamp);

        emit SnappedBalances(
            blockRoot,
            block.number,
            block.timestamp,
            wethBalance,
            ethBalance
        );
    }

    struct VerifyBalancesParams {
        bytes32 blockRoot;
        uint64 firstPendingDepositSlot;
        // BeaconBlock.BeaconBlockBody.deposits[0].slot
        bytes firstPendingDepositSlotProof;
        bytes32 balancesContainerRoot;
        // BeaconBlock.state.validators
        bytes validatorContainerProof;
        bytes32[] validatorBalanceLeaves;
        // BeaconBlock.state.validators[validatorIndex].balance
        bytes[] validatorBalanceProofs;
    }

    function verifyBalances(VerifyBalancesParams calldata params)
        external
        nonReentrant
    {
        // Load previously snapped balances for the given block root
        Balances memory balancesMem = snappedBalances[params.blockRoot];
        // Check the balances are the latest
        require(lastSnapTimestamp > 0, "No snapped balances");
        require(balancesMem.timestamp == lastSnapTimestamp, "Stale snap");

        // Verify the first pending deposit slot to the beacon block root
        IBeaconProofs(BEACON_PROOFS).verifyFirstPendingDepositSlot(
            params.blockRoot,
            params.firstPendingDepositSlot,
            params.firstPendingDepositSlotProof
        );

        uint64 firstPendingDepositBlockNumber = IBeaconOracle(BEACON_ORACLE)
            .slotToBlock(params.firstPendingDepositSlot);

        // For each native staking contract's deposits
        uint256 depositsCount = depositsRoots.length;
        uint64 totalDepositsGwei = 0;
        for (uint256 i = 0; i < depositsCount; ++i) {
            bytes32 depositDataRoot = depositsRoots[i];

            // Check the stored deposit is still waiting to be processed on the beacon chain.
            // That is, the first pending deposit block number is before the
            // block number of the staking strategy's deposit.
            // If it has it will need to be verified with `verifyDeposit`
            require(
                firstPendingDepositBlockNumber <
                    deposits[depositDataRoot].blockNumber,
                "Deposit has been processed"
            );

            totalDepositsGwei += deposits[depositDataRoot].amountGwei;
        }

        // verify beaconBlock.state.balances root to beacon block root
        IBeaconProofs(BEACON_PROOFS).verifyBalancesContainer(
            params.blockRoot,
            params.balancesContainerRoot,
            params.validatorContainerProof
        );

        uint256 totalValidatorBalance = 0;
        uint256 verifiedValidatorsCount = verifiedValidators.length;
        // for each validator
        for (uint256 i = 0; i < verifiedValidatorsCount; ++i) {
            // verify validator's balance in beaconBlock.state.balances to the
            // beaconBlock.state.balances container root
            uint256 validatorBalance = IBeaconProofs(BEACON_PROOFS)
                .verifyValidatorBalance(
                    params.balancesContainerRoot,
                    params.validatorBalanceLeaves[i],
                    params.validatorBalanceProofs[i],
                    verifiedValidators[i],
                    IBeaconProofs.BalanceProofLevel.Container
                );

            // total validator balances
            totalValidatorBalance += validatorBalance;

            // If the validator balance is zero
            if (validatorBalance == 0) {
                // Remove the validator from the list of verified validators.

                // Reduce the count of verified validators which is the last index before the pop removes it.
                verifiedValidatorsCount -= 1;
                // Remove the validator with a zero balance from the list of verified validators
                // Move the last validator to the current index
                verifiedValidators[i] = verifiedValidators[
                    verifiedValidatorsCount
                ];
                // Delete the last validator from the list
                verifiedValidators.pop();
            }
        }

        // store the verified balance in storage
        lastVerifiedBalance = SafeCast.toUint128(
            (totalDepositsGwei * 1 gwei) +
                totalValidatorBalance +
                balancesMem.wethBalance +
                balancesMem.ethBalance
        );
        // Reset the last snap timestamp so a new snapBalances has to be made
        lastSnapTimestamp = 0;

        // If there has been a consolidation
        if (consolidationSourceStrategy != address(0)) {
            // Call the old sweeping strategy to confirm the consolidation has been completed
            IConsolidationSource(consolidationSourceStrategy)
                .confirmConsolidation();

            // Reset the stored consolidation state
            consolidationLastPubKeyHash = bytes32(0);
            consolidationSourceStrategy = address(0);

            // Unpause now the balance of the target validator has been verified
            _unpause();
        }
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
