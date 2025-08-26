// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Governable } from "../../governance/Governable.sol";
import { IDepositContract } from "../../interfaces/IDepositContract.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { BeaconRoots } from "../../beacon/BeaconRoots.sol";
import { PartialWithdrawal } from "../../beacon/PartialWithdrawal.sol";
import { IBeaconProofs } from "../../interfaces/IBeaconProofs.sol";

/**
 * @title Validator lifecycle management contract
 * @notice This contract implements all the required functionality to
 * register, deposit, withdraw, exit and remove validators.
 * @author Origin Protocol Inc
 */
abstract contract CompoundingValidatorManager is Governable {
    using SafeERC20 for IERC20;

    /// @dev The amount of ETH in wei that is required for a deposit to a new validator.
    /// Initially this is 32 ETH, but will be reduced to 1 ETH after P2P's APIs have been updated
    /// to support deposits of 1 ETH.
    uint256 internal constant DEPOSIT_AMOUNT_WEI = 32 ether;
    /// @dev The maximum number of deposits that are waiting to be verified as processed on the beacon chain.
    uint256 internal constant MAX_DEPOSITS = 12;
    /// @dev The maximum number of validators that can be verified.
    uint256 internal constant MAX_VERIFIED_VALIDATORS = 48;
    /// @dev The default withdrawable epoch value on the Beacon chain.
    /// A value in the far future means the validator is not exiting.
    uint64 internal constant FAR_FUTURE_EPOCH = type(uint64).max;
    /// @dev The number of seconds between each beacon chain slot.
    uint64 internal constant SLOT_DURATION = 12;
    /// @dev The number of slots in each beacon chain epoch.
    uint64 internal constant SLOTS_PER_EPOCH = 32;
    /// @dev Minimum time in seconds to allow snapped balances to be verified.
    /// Set to 1 epoch as the pending deposits only changes every epoch.
    /// That's also enough time to generate the proofs and call `verifyBalances`.
    uint64 internal constant SNAP_BALANCES_DELAY =
        SLOTS_PER_EPOCH * SLOT_DURATION;

    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the beacon chain deposit contract
    address public immutable BEACON_CHAIN_DEPOSIT_CONTRACT;
    /// @notice The address of the SSV Network contract used to interface with
    address public immutable SSV_NETWORK;
    /// @notice Address of the OETH Vault proxy contract
    address public immutable VAULT_ADDRESS;
    /// @notice Address of the Beacon Proofs contract that verifies beacon chain data
    address public immutable BEACON_PROOFS;
    /// @notice The timestamp of the Beacon chain genesis.
    /// @dev this is different on Testnets like Hoodi so is set at deployment time.
    uint64 public immutable BEACON_GENESIS_TIMESTAMP;

    /// @notice Address of the registrator - allowed to register, withdraw, exit and remove validators
    address public validatorRegistrator;

    /// @notice Deposit data for new compounding validators.
    /// @dev A `VERIFIED` deposit can mean 3 separate things:
    ///      - a deposit has been processed by the beacon chain and shall be included in the
    ///        balance of the next verifyBalances call
    ///      - a deposit has been done to a slashed validator and has probably been recovered
    ///        back to this strategy. Probably because we can not know for certain. This contract
    ///        only detects when the validator has passed its withdrawal epoch. It is close to impossible
    ///        to prove with Merkle Proofs that the postponed deposit this contract is responsible for
    ///        creating is not present anymore in BeaconChain.state.pending_deposits. This in effect
    ///        means that there might be a period where this contract thinks the deposit has been already
    ///        returned as ETH balance before it happens. This will result in some days (or weeks)
    ///        -> depending on the size of deposit queue of showing a deficit when calling `checkBalance`.
    ///        As this only offsets the yield and doesn't cause a critical double-counting we are not addressing
    ///        this issue.
    ///      - A deposit has been done to the validator, but our deposit has been front run by a malicious
    ///        actor. Funds in the deposit this contract makes are not recoverable.
    enum DepositStatus {
        UNKNOWN, // default value
        PENDING, // deposit is pending and waiting to be  verified
        VERIFIED // deposit has been verified
    }

    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param amountGwei Amount of ETH in gwei that has been deposited to the beacon chain deposit contract
    /// @param slot The beacon chain slot number when the deposit has been made
    /// @param depositIndex The index of the deposit in the list of active deposits
    /// @param status The status of the deposit, either UNKNOWN, PENDING or VERIFIED
    /// @param withdrawableEpoch The withdrawableEpoch of the validator which is being deposited to.
    ///        At deposit time this is set to max default value (FAR_FUTURE_EPOCH). If a deposit has
    ///        made to a slashed validator the `withdrawableEpoch` will be set to the epoch of that
    ///        validator.
    struct DepositData {
        bytes32 pubKeyHash;
        uint64 amountGwei;
        uint64 slot;
        uint32 depositIndex;
        DepositStatus status;
        uint64 withdrawableEpoch;
    }
    /// @notice Restricts to only one deposit to an unverified validator at a time.
    /// This is to limit front-running attacks of deposits to the beacon chain contract.
    ///
    /// @dev The value is set to true when a deposit to a new validator has been done that has
    /// not yet be verified.
    bool public firstDeposit;
    /// @notice Unique identifier of the next validator deposit.
    uint128 public nextDepositID;
    /// @notice Mapping of the deposit ID to the deposit data
    mapping(uint256 => DepositData) public deposits;
    /// @notice List of strategy deposit IDs to a validator.
    /// The list can be for deposits waiting to be verified as processed on the beacon chain,
    /// or deposits that have been verified to an exiting validator and is now waiting for the
    /// validator's balance to be swept.
    /// The list may not be ordered by time of deposit.
    /// Removed deposits will move the last deposit to the removed index.
    uint256[] public depositList;

    enum ValidatorState {
        NON_REGISTERED, // validator is not registered on the SSV network
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        VERIFIED, // validator has been verified to exist on the beacon chain
        EXITING, // The validator has been requested to exit or has been verified as forced exit
        EXITED, // The validator has been verified to have a zero balance
        REMOVED, // validator has funds withdrawn to this strategy contract and is removed from the SSV
        INVALID // The validator has been front-run and the withdrawal address is not this strategy
    }

    // Validator data
    struct ValidatorData {
        ValidatorState state; // The state of the validator known to this contract
        uint64 index; // The index of the validator on the beacon chain
    }
    /// @notice List of validator public key hashes that have been verified to exist on the beacon chain.
    /// These have had a deposit processed and the validator's balance increased.
    /// Validators will be removed from this list when its verified they have a zero balance.
    bytes32[] public verifiedValidators;
    /// @notice Mapping of the hash of the validator's public key to the validator state and index.
    /// Uses the Beacon chain hashing for BLSPubkey which is sha256(abi.encodePacked(validator.pubkey, bytes16(0)))
    mapping(bytes32 => ValidatorData) public validator;

    /// @param blockRoot Beacon chain block root of the snapshot
    /// @param timestamp Timestamp of the snapshot
    /// @param ethBalance The balance of ETH in the strategy contract at the snapshot
    struct Balances {
        bytes32 blockRoot;
        uint64 timestamp;
        uint128 ethBalance;
    }
    /// @notice Mapping of the block root to the balances at that slot
    Balances public snappedBalance;
    /// @notice The last verified ETH balance of the strategy
    uint256 public lastVerifiedEthBalance;

    /// @dev This contract receives WETH as the deposit asset, but unlike other strategies doesn't immediately
    /// deposit it to an underlying platform. Rather a special privilege account stakes it to the validators.
    /// For that reason calling WETH.balanceOf(this) in a deposit function can contain WETH that has just been
    /// deposited and also WETH that has previously been deposited. To keep a correct count we need to keep track
    /// of WETH that has already been accounted for.
    /// This value represents the amount of WETH balance of this contract that has already been accounted for by the
    /// deposit events.
    /// It is important to note that this variable is not concerned with WETH that is a result of full/partial
    /// withdrawal of the validators. It is strictly concerned with WETH that has been deposited and is waiting to
    /// be staked.
    uint256 public depositedWethAccountedFor;

    // For future use
    uint256[50] private __gap;

    event RegistratorChanged(address indexed newAddress);
    event StakingMonitorChanged(address indexed newAddress);
    event FirstDepositReset();
    event SSVValidatorRegistered(
        bytes32 indexed pubKeyHash,
        uint64[] operatorIds
    );
    event SSVValidatorRemoved(bytes32 indexed pubKeyHash, uint64[] operatorIds);
    event ETHStaked(
        bytes32 indexed pubKeyHash,
        uint256 indexed depositID,
        bytes pubKey,
        uint256 amountWei
    );
    event ValidatorVerified(
        bytes32 indexed pubKeyHash,
        uint64 indexed validatorIndex
    );
    event ValidatorInvalid(bytes32 indexed pubKeyHash);
    event DepositVerified(uint256 indexed depositID, uint256 amountWei);
    event DepositToValidatorExiting(
        uint256 indexed depositID,
        uint256 amountWei,
        uint64 withdrawableEpoch
    );
    event DepositValidatorExited(uint256 indexed depositID, uint256 amountWei);
    event ValidatorWithdraw(bytes32 indexed pubKeyHash, uint256 amountWei);
    event BalancesSnapped(bytes32 indexed blockRoot, uint256 ethBalance);
    event BalancesVerified(
        uint64 indexed timestamp,
        uint256 totalDepositsWei,
        uint256 totalValidatorBalance,
        uint256 ethBalance
    );

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(msg.sender == validatorRegistrator, "Not Registrator");
        _;
    }

    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _vaultAddress Address of the Vault
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _ssvNetwork Address of the SSV Network contract
    /// @param _beaconProofs Address of the Beacon Proofs contract that verifies beacon chain data
    /// @param _beaconGenesisTimestamp The timestamp of the Beacon chain's genesis.
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork,
        address _beaconProofs,
        uint64 _beaconGenesisTimestamp
    ) {
        WETH = _wethAddress;
        BEACON_CHAIN_DEPOSIT_CONTRACT = _beaconChainDepositContract;
        SSV_NETWORK = _ssvNetwork;
        VAULT_ADDRESS = _vaultAddress;
        BEACON_PROOFS = _beaconProofs;
        BEACON_GENESIS_TIMESTAMP = _beaconGenesisTimestamp;

        require(
            block.timestamp > _beaconGenesisTimestamp,
            "Invalid genesis timestamp"
        );
    }

    /**
     *
     *             Admin Functions
     *
     */

    /// @notice Set the address of the registrator which can register, exit and remove validators
    function setRegistrator(address _address) external onlyGovernor {
        validatorRegistrator = _address;
        emit RegistratorChanged(_address);
    }

    /// @notice Reset the `firstDeposit` flag to false so deposits to unverified validators can be made again.
    function resetFirstDeposit() external onlyGovernor {
        require(firstDeposit, "No first deposit");

        firstDeposit = false;

        emit FirstDepositReset();
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
    /// @param ssvAmount The amount of SSV tokens to be deposited to the SSV cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    // slither-disable-start reentrancy-no-eth
    function registerSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        uint256 ssvAmount,
        Cluster calldata cluster
    ) external onlyRegistrator {
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);
        // Check each public key has not already been used
        require(
            validator[pubKeyHash].state == ValidatorState.NON_REGISTERED,
            "Validator already registered"
        );

        // Store the validator state as registered
        validator[pubKeyHash].state = ValidatorState.REGISTERED;

        ISSVNetwork(SSV_NETWORK).registerValidator(
            publicKey,
            operatorIds,
            sharesData,
            ssvAmount,
            cluster
        );

        emit SSVValidatorRegistered(pubKeyHash, operatorIds);
    }

    // slither-disable-end reentrancy-no-eth

    struct ValidatorStakeData {
        bytes pubkey;
        bytes signature;
        bytes32 depositDataRoot;
    }

    /// @notice Stakes WETH in this strategy to a compounding validator.
    /// Does not convert any ETH sitting in this strategy to WETH.
    /// @param validatorStakeData validator data needed to stake.
    /// The `ValidatorStakeData` struct contains the pubkey, signature and depositDataRoot.
    /// Only the registrator can call this function.
    /// @param depositAmountGwei The amount of WETH to stake to the validator in Gwei.
    // slither-disable-start reentrancy-eth
    function stakeEth(
        ValidatorStakeData calldata validatorStakeData,
        uint64 depositAmountGwei
    ) external onlyRegistrator {
        uint256 depositAmountWei = uint256(depositAmountGwei) * 1 gwei;
        // Check there is enough WETH from the deposits sitting in this strategy contract
        // There could be ETH from withdrawals but we'll ignore that. If it's really needed
        // the ETH can be withdrawn and then deposited back to the strategy.
        require(
            depositAmountWei <= IWETH9(WETH).balanceOf(address(this)),
            "Insufficient WETH"
        );
        require(depositList.length < MAX_DEPOSITS, "Max deposits");

        // Convert required ETH from WETH and do the necessary accounting
        _convertWethToEth(depositAmountWei);

        // Hash the public key using the Beacon Chain's hashing for BLSPubkey
        bytes32 pubKeyHash = _hashPubKey(validatorStakeData.pubkey);
        ValidatorState currentState = validator[pubKeyHash].state;
        // Can only stake to a validator has have been registered or verified.
        // Can not stake to a validator that has been staked but not yet verified.
        require(
            (currentState == ValidatorState.REGISTERED ||
                currentState == ValidatorState.VERIFIED),
            "Not registered or verified"
        );
        require(depositAmountWei >= 1 ether, "Deposit too small");
        if (currentState == ValidatorState.REGISTERED) {
            // Can only have one pending deposit to an unverified validator at a time.
            // This is to limit front-running deposit attacks to a single deposit.
            // The exiting deposit needs to be verified before another deposit can be made.
            // If there was a front-running attack, the validator needs to be verified as invalid
            // and the Governor calls `resetFirstDeposit` to set `firstDeposit` to false.
            require(!firstDeposit, "Existing first deposit");
            // Limits the amount of ETH that can be at risk from a front-running deposit attack.
            require(
                depositAmountWei == DEPOSIT_AMOUNT_WEI,
                "Invalid first deposit amount"
            );
            // Limits the number of validator balance proofs to verifyBalances
            require(
                verifiedValidators.length + 1 < MAX_VERIFIED_VALIDATORS,
                "Max validators"
            );

            // Flag a deposit to an unverified validator so only no other deposits can be made
            // to an unverified validator.
            firstDeposit = true;
        }

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
            validatorStakeData.pubkey,
            withdrawalCredentials,
            validatorStakeData.signature,
            validatorStakeData.depositDataRoot
        );

        //// Update contract storage
        // Store the validator state if needed
        if (currentState == ValidatorState.REGISTERED) {
            validator[pubKeyHash].state = ValidatorState.STAKED;
        }

        /// After the Pectra upgrade the validators have a new restriction when proposing
        /// blocks. The timestamps are at strict intervals of 12 seconds from the genesis block
        /// forward. Each slot is created at strict 12 second intervals and those slots can
        /// either have blocks attached to them or not. This way using the block.timestamp
        /// the slot number can easily be calculated.
        uint64 depositSlot = (SafeCast.toUint64(block.timestamp) -
            BEACON_GENESIS_TIMESTAMP) / SLOT_DURATION;

        // Store the deposit data for verifyDeposit and verifyBalances
        uint256 depositID = nextDepositID++;
        deposits[depositID] = DepositData({
            pubKeyHash: pubKeyHash,
            amountGwei: depositAmountGwei,
            slot: depositSlot,
            depositIndex: SafeCast.toUint32(depositList.length),
            status: DepositStatus.PENDING,
            withdrawableEpoch: FAR_FUTURE_EPOCH
        });
        depositList.push(depositID);

        emit ETHStaked(
            pubKeyHash,
            depositID,
            validatorStakeData.pubkey,
            depositAmountWei
        );
    }

    // slither-disable-end reentrancy-eth

    /// @notice Request a full or partial withdrawal from a validator.
    /// A zero amount will trigger a full withdrawal.
    /// If the remaining balance is < 32 ETH then only the amount in excess of 32 ETH will be withdrawn.
    /// Only the Registrator can call this function.
    /// 1 wei of value should be sent with the tx to pay for the withdrawal request fee.
    /// If no value sent, 1 wei will be taken from the strategy's ETH balance if it has any.
    /// If no ETH balance, the tx will revert.
    /// @param publicKey The public key of the validator
    /// @param amountGwei The amount of ETH to be withdrawn from the validator in Gwei.
    /// A zero amount will trigger a full withdrawal.
    // slither-disable-start reentrancy-no-eth
    function validatorWithdrawal(bytes calldata publicKey, uint64 amountGwei)
        external
        payable
        onlyRegistrator
    {
        // Hash the public key using the Beacon Chain's format
        bytes32 pubKeyHash = _hashPubKey(publicKey);
        ValidatorState currentState = validator[pubKeyHash].state;
        require(
            currentState == ValidatorState.VERIFIED,
            "Validator not verified"
        );

        PartialWithdrawal.request(publicKey, amountGwei);

        // If a full withdrawal (validator exit)
        if (amountGwei == 0) {
            // Store the validator state as exiting so no more deposits can be made to it.
            validator[pubKeyHash].state = ValidatorState.EXITING;
        }

        // Do not remove from the list of verified validators.
        // This is done in the verifyBalances function once the validator's balance has been verified to be zero.
        // The validator state will be set to EXITED in the verifyBalances function.

        emit ValidatorWithdraw(pubKeyHash, uint256(amountGwei) * 1 gwei);
    }

    // slither-disable-end reentrancy-no-eth

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
    // slither-disable-start reentrancy-no-eth
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

    /**
     *
     *             SSV Management
     *
     */

    // slither-disable-end reentrancy-no-eth

    /// `depositSSV` has been removed as `deposit` on the SSVNetwork contract can be called directly
    /// by the Strategist which is already holding SSV tokens.

    /// @notice Withdraws excess SSV Tokens from the SSV Network contract which was used to pay the SSV Operators.
    /// @dev A SSV cluster is defined by the SSVOwnerAddress and the set of operatorIds.
    /// @param operatorIds The operator IDs of the SSV Cluster
    /// @param ssvAmount The amount of SSV tokens to be withdrawn from the SSV cluster
    /// @param cluster The SSV cluster details including the validator count and SSV balance
    function withdrawSSV(
        uint64[] memory operatorIds,
        uint256 ssvAmount,
        Cluster memory cluster
    ) external onlyGovernor {
        ISSVNetwork(SSV_NETWORK).withdraw(operatorIds, ssvAmount, cluster);
    }

    /**
     *
     *             Beacon Chain Proofs
     *
     */

    /// @notice Verifies a validator's index to its public key.
    /// Adds to the list of verified validators if the validator's withdrawal address is this strategy's address.
    /// Marks the validator as invalid and removes the deposit if the withdrawal address is not this strategy's address.
    /// @param nextBlockTimestamp The timestamp of the execution layer block after the beacon chain slot
    /// we are verifying.
    /// The next one is needed as the Beacon Oracle returns the parent beacon block root for a block timestamp,
    /// which is the beacon block root of the previous block.
    /// @param validatorIndex The index of the validator on the beacon chain.
    /// @param pubKeyHash The hash of the validator's public key using the Beacon Chain's format
    /// @param withdrawalAddress The withdrawal address of the validator which should be this strategy's address.
    /// If the withdrawal address is not this strategy's address, the initial deposit was front-run
    /// and the validator is marked as invalid.
    /// @param validatorPubKeyProof The merkle proof for the validator public key to the beacon block root.
    /// This is 53 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    function verifyValidator(
        uint64 nextBlockTimestamp,
        uint64 validatorIndex,
        bytes32 pubKeyHash,
        address withdrawalAddress,
        bytes calldata validatorPubKeyProof
    ) external {
        require(
            validator[pubKeyHash].state == ValidatorState.STAKED,
            "Validator not staked"
        );

        // Get the beacon block root of the slot we are verifying the validator in.
        // The parent beacon block root of the next block is the beacon block root of the slot we are verifying.
        bytes32 blockRoot = BeaconRoots.parentBlockRoot(nextBlockTimestamp);

        // Verify the validator index is for the validator with the given public key.
        // Also verify the validator's withdrawal credential points to the `withdrawalAddress`.
        IBeaconProofs(BEACON_PROOFS).verifyValidator(
            blockRoot,
            pubKeyHash,
            validatorPubKeyProof,
            validatorIndex,
            withdrawalAddress
        );

        // Store the validator state as verified
        validator[pubKeyHash] = ValidatorData({
            state: ValidatorState.VERIFIED,
            index: validatorIndex
        });

        // If the initial deposit was front-run and the withdrawal address is not this strategy
        if (withdrawalAddress != address(this)) {
            // override the validator state
            validator[pubKeyHash].state = ValidatorState.INVALID;

            // Find and remove the deposit as the funds can not be recovered
            uint256 depositCount = depositList.length;
            for (uint256 i = 0; i < depositCount; i++) {
                DepositData memory deposit = deposits[depositList[i]];
                if (deposit.pubKeyHash == pubKeyHash) {
                    _removeDeposit(depositList[i], deposit);
                    break;
                }
            }

            // Leave the `firstDeposit` flag as true so no more deposits to unverified validators can be made.
            // The Governor has to reset the `firstDeposit` to false before another deposit to
            // an unverified validator can be made.
            // The Governor can set a new `validatorRegistrator` if they suspect it has been compromised.

            emit ValidatorInvalid(pubKeyHash);
            return;
        }

        // Add the new validator to the list of verified validators
        verifiedValidators.push(pubKeyHash);

        // Reset the firstDeposit flag as the first deposit to an unverified validator has been verified.
        firstDeposit = false;

        emit ValidatorVerified(pubKeyHash, validatorIndex);
    }

    struct FirstPendingDepositProofData {
        uint64 slot;
        uint64 validatorIndex;
        bytes32 pubKeyHash;
        bytes pendingDepositPubKeyProof;
        bytes withdrawableEpochProof;
        bytes validatorPubKeyProof;
    }

    struct DepositValidatorProofData {
        uint64 withdrawableEpoch;
        bytes withdrawableEpochProof;
    }

    /// @notice Verifies a deposit on the execution layer has been processed by the beacon chain.
    /// This means the accounting of the strategy's ETH moves from a pending deposit to a validator balance.
    ///
    /// Important: this function has a limitation where the `verificationSlot` that is passed by the off-chain
    /// verifier requires a slot immediately after it to propose a block otherwise the `BeaconRoots.parentBlockRoot`
    /// will fail. This shouldn't be a problem, since by the current behaviour of beacon chain only 1%-3% slots
    /// don't propose a block.
    /// @param depositID The deposit ID emitted in `ETHStaked` from the `stakeEth` function.
    /// @param depositProcessedSlot Any slot on or after the strategy's deposit was processed on the beacon chain.
    /// Can not be a slot with pending deposits with the same slot as the deposit being verified.
    /// Can not be a slot before a missed slot as the Beacon Root contract will have the parent block root
    /// set for the next block timestamp in 12 seconds time.
    /// @param firstDepositValidatorCreatedSlot The slot on or after when the validator of the first pending deposit
    /// was created on the beacon chain. This is used to verify the validator has not exited. Can be the same as
    /// `depositProcessedSlot` when the first pending deposit was to an already existing validator
    // slither-disable-start reentrancy-no-eth
    function verifyDeposit(
        uint256 depositID,
        uint64 depositProcessedSlot,
        uint64 firstDepositValidatorCreatedSlot,
        FirstPendingDepositProofData calldata firstPendingDeposit,
        DepositValidatorProofData calldata strategyValidatorData
    ) external {
        // Load into memory the previously saved deposit data
        DepositData memory deposit = deposits[depositID];
        ValidatorData memory strategyValidator = validator[deposit.pubKeyHash];
        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");
        require(
            strategyValidator.state == ValidatorState.VERIFIED,
            "Validator not verified"
        );
        // The verification slot must be after the deposit's slot.
        // This is needed for when the deposit queue is empty.
        require(deposit.slot < depositProcessedSlot, "Slot not after deposit");
        require(
            depositProcessedSlot <= firstDepositValidatorCreatedSlot,
            "Invalid verification slots"
        );

        // Get the parent beacon block root of the next block which is the block root of the deposit verification slot.
        // This will revert if the slot after the verification slot was missed.
        bytes32 depositBlockRoot = BeaconRoots.parentBlockRoot(
            _calcNextBlockTimestamp(depositProcessedSlot)
        );

        // Verify the slot of the first pending deposit matches the beacon chain
        bool isDepositQueueEmpty = IBeaconProofs(BEACON_PROOFS)
            .verifyFirstPendingDeposit(
                depositBlockRoot,
                firstPendingDeposit.slot,
                firstPendingDeposit.pubKeyHash,
                firstPendingDeposit.pendingDepositPubKeyProof
            );

        // If the deposit queue is not empty
        if (!isDepositQueueEmpty) {
            // Get the parent beacon block root of the next block which is
            // the block root of the validator verification slot.
            // This will revert if the slot after the verification slot was missed.
            bytes32 validatorBlockRoot = BeaconRoots.parentBlockRoot(
                _calcNextBlockTimestamp(firstDepositValidatorCreatedSlot)
            );

            // Verify the validator of the first pending deposit is not exiting.
            // If it is exiting we can't be sure this deposit has not been postponed in the deposit queue.
            // Hence we can not verify if the strategy's deposit has been processed or not.
            IBeaconProofs(BEACON_PROOFS).verifyValidatorWithdrawable(
                validatorBlockRoot,
                firstPendingDeposit.validatorIndex,
                firstPendingDeposit.pubKeyHash,
                FAR_FUTURE_EPOCH,
                firstPendingDeposit.withdrawableEpochProof,
                firstPendingDeposit.validatorPubKeyProof
            );
        }

        // Verify the withdrawableEpoch on the validator of the strategy's deposit
        IBeaconProofs(BEACON_PROOFS).verifyValidatorWithdrawable(
            depositBlockRoot,
            strategyValidator.index,
            strategyValidatorData.withdrawableEpoch,
            strategyValidatorData.withdrawableEpochProof
        );

        // If the validator is exiting because it has been slashed
        if (strategyValidatorData.withdrawableEpoch != FAR_FUTURE_EPOCH) {
            // Store the exit epoch in the deposit data
            deposit.withdrawableEpoch = strategyValidatorData.withdrawableEpoch;

            emit DepositToValidatorExiting(
                depositID,
                uint256(deposit.amountGwei) * 1 gwei,
                strategyValidatorData.withdrawableEpoch
            );

            validator[deposit.pubKeyHash].state = ValidatorState.EXITING;

            // Leave the deposit status as PENDING
            return;
        }

        // solhint-disable max-line-length
        // Check the deposit slot is before the first pending deposit's slot on the beacon chain.
        // If this is not true then we can't guarantee the deposit has been processed by the beacon chain.
        // The deposit's slot can not be the same slot as the first pending deposit as there could be
        // many deposits in the same block, hence have the same pending deposit slot.
        // If the deposit queue is empty then our deposit must have been processed on the beacon chain.
        // The deposit slot can be zero for validators consolidating to a compounding validator or 0x01 validator
        // being promoted to a compounding one. Reference:
        // - [switch_to_compounding_validator](https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#new-switch_to_compounding_validator
        // - [queue_excess_active_balance](https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#new-queue_excess_active_balance)
        // - [process_consolidation_request](https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#new-process_consolidation_request)
        // We can not guarantee that the deposit has been processed in that case.
        // solhint-enable max-line-length
        require(
            deposit.slot < firstPendingDeposit.slot || isDepositQueueEmpty,
            "Deposit likely not processed"
        );

        // Remove the deposit now it has been verified as processed on the beacon chain.
        _removeDeposit(depositID, deposit);

        emit DepositVerified(depositID, uint256(deposit.amountGwei) * 1 gwei);
    }

    function _removeDeposit(uint256 depositID, DepositData memory deposit)
        internal
    {
        // After verifying the proof, update the contract storage
        deposits[depositID].status = DepositStatus.VERIFIED;
        // Move the last deposit to the index of the verified deposit
        uint256 lastDeposit = depositList[depositList.length - 1];
        depositList[deposit.depositIndex] = lastDeposit;
        deposits[lastDeposit].depositIndex = deposit.depositIndex;
        // Delete the last deposit from the list
        depositList.pop();
    }

    /// @dev Calculates the timestamp of the next execution block from the given slot.
    /// @param slot The beacon chain slot number used for merkle proof verification.
    function _calcNextBlockTimestamp(uint64 slot)
        internal
        view
        returns (uint64)
    {
        // Calculate the next block timestamp from the slot.
        return SLOT_DURATION * slot + BEACON_GENESIS_TIMESTAMP + SLOT_DURATION;
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Stores the current ETH balance at the current block and beacon block root
    ///         of the slot that is associated with the previous block.
    ///
    /// When snapping / verifying balance it is of a high importance that there is no
    /// miss-match in respect to ETH that is held by the contract and balances that are
    /// verified on the validators.
    ///
    /// First some context on the beacon-chain block building behaviour. Relevant parts of
    /// constructing a block on the beacon chain consist of:
    ///  - process_withdrawals: ETH is deducted from the validator's balance
    ///  - process_execution_payload: immediately after the previous step executing all the
    ///    transactions
    ///  - apply the withdrawals: adding ETH to the recipient which is the withdrawal address
    ///    contained in the withdrawal credentials of the exited validators
    ///
    /// That means that balance increases which are part of the post-block execution state are
    /// done within the block, but the transaction that are contained within that block can not
    /// see / interact with the balance from the exited validators. Only transactions in the
    /// next block can do that.
    ///
    /// When snap balances is performed the state of the chain is snapped across 2 separate
    /// chain states:
    ///  - ETH balance of the contract is recorded on block X -> and corresponding slot Y
    ///  - beacon chain block root is recorded of block X - 1 -> and corresponding slot Y - 1
    ///    given there were no missed slots. It could also be Y - 2, Y - 3 depending on how
    ///    many slots have not managed to propose a block. For the sake of simplicity this slot
    ///    will be referred to as Y - 1 as it makes no difference in the argument
    ///
    /// Given these 2 separate chain states it is paramount that verify balances can not experience
    /// miss-counting ETH or much more dangerous double counting of the ETH.
    ///
    /// When verifyBalances is called it is performed on the current block Z where Z > X. Verify
    /// balances adds up all the ETH (omitting WETH) controlled by this contract:
    ///  - ETH balance in the contract on block X
    ///  - ETH balance in Deposits on block Z that haven't been yet processed in slot Y - 1
    ///  - ETH balance in validators that are active in slot Y - 1
    ///  - skips the ETH balance in validators that have withdrawn in slot Y - 1 (or sooner)
    ///    and have their balance visible to transactions in slot Y and corresponding block X
    ///    (or sooner)
    ///
    /// Lets verify the correctness of ETH accounting given the above described behaviour.
    ///
    /// *ETH balance in the contract on block X*
    ///
    /// This is an ETH balance of the contract on a non current X block. Any ETH leaving the
    /// contract as a result of a withdrawal subtracts from the ETH accounted for on block X
    /// if `verifyBalances` has already been called. It also invalidates a `snapBalances` in
    /// case `verifyBalances` has not been called yet. Not performing this would result in not
    /// accounting for the withdrawn ETH that has happened anywhere in the block interval [X + 1, Z].
    ///
    /// Similarly to withdrawals any `stakeEth` deposits to the deposit contract adds to the ETH
    /// accounted for since the last `verifyBalances` has been called. And it invalidates the
    /// `snapBalances` in case `verifyBalances` hasn't been yet called. Not performing this
    /// would result in double counting the `stakedEth` since it would be present once in the
    /// snapped contract balance and the second time in deposit storage variables.
    ///
    /// This behaviour is correct.
    ///
    /// *ETH balance in Deposits on block Z that haven't been yet processed in slot Y - 1*
    ///
    /// The contract sums up all the ETH that has been deposited to the Beacon chain deposit
    /// contract at block Z. The execution layer doesn't have direct access to the state of
    /// deposits on the beacon chain. And if it is to sum up all the ETH that is marked to be
    /// deposited it needs to be sure to not double count ETH that is in deposits (storage vars)
    /// and could also be part of the validator balances. It does that by verifying that at
    /// slot Y - 1 none of the deposits visible on block Z have been processed. Meaning since
    /// the last snap till now all are still in queue. Which ensures they can not be part of
    /// the validator balances in later steps.
    ///
    /// This behaviour is correct.
    ///
    /// *ETH balance in validators that are active in slot Y - 1*
    ///
    /// The contract is verifying none of the deposits on Y - 1 slot have been processed and
    /// for that reason it checks the validator balances in the same slot. Ensuring accounting
    /// correctness.
    ///
    /// This behaviour is correct.
    ///
    /// *The withdrawn validators*
    ///
    /// The withdrawn validators could have their balances deducted in any slot before slot
    /// Y - 1 and the execution layer sees the balance increase in the subsequent slot. Lets
    /// look at the "worst case scenario" where the validator withdrawal is processed in the
    /// slot Y - 1 (snapped slot) and see their balance increase (in execution layer) in slot
    /// Y -> block X. The ETH balance on the contract is snapped at block X meaning that
    /// even if the validator exits at the latest possible time it is paramount that the ETH
    /// balance on the execution layer is recorded in the next block. Correctly accounting
    /// for the withdrawn ETH.
    ///
    /// Worth mentioning if the validator exit is processed by the slot Y and balance increase
    /// seen on the execution layer on block X + 1 the withdrawal is ignored by both the
    /// validator balance verification as well as execution layer contract balance snap.
    ///
    /// This behaviour is correct.
    ///
    /// The validator balances on the beacon chain can then be proved with `verifyBalances`.
    function snapBalances() external {
        uint64 currentTimestamp = SafeCast.toUint64(block.timestamp);
        require(
            snappedBalance.timestamp + SNAP_BALANCES_DELAY < currentTimestamp,
            "Snap too soon"
        );

        bytes32 blockRoot = BeaconRoots.parentBlockRoot(currentTimestamp);
        // Get the current ETH balance
        uint256 ethBalance = address(this).balance;

        // Store the snapped balance
        snappedBalance = Balances({
            blockRoot: blockRoot,
            timestamp: currentTimestamp,
            ethBalance: SafeCast.toUint128(ethBalance)
        });

        emit BalancesSnapped(blockRoot, ethBalance);
    }

    // A struct is used to avoid stack too deep errors
    struct BalanceProofs {
        // BeaconBlock.state.balances
        bytes32 balancesContainerRoot;
        bytes balancesContainerProof;
        // BeaconBlock.state.balances[validatorIndex]
        bytes32[] validatorBalanceLeaves;
        bytes[] validatorBalanceProofs;
    }

    /// @notice Verifies the balances of all active validators on the beacon chain
    /// and checks no pending deposits have been processed by the beacon chain.
    /// @param balanceProofs a `BalanceProofs` struct containing the following:
    /// balancesContainerRoot - the merkle root of the balances container
    /// balancesContainerProof - The merkle proof for the balances container to the beacon block root.
    ///   This is 9 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// validatorBalanceLeaves - Array of leaf nodes containing the validator balance with three other balances.
    /// validatorBalanceProofs -  Array of merkle proofs for the validator balance to the Balances container root.
    ///   This is 39 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    // slither-disable-start reentrancy-no-eth
    function verifyBalances(
        uint64 validatorVerificationBlockTimestamp,
        FirstPendingDepositProofData calldata firstPendingDeposit,
        BalanceProofs calldata balanceProofs
    ) external {
        // Load previously snapped balances for the given block root
        Balances memory balancesMem = snappedBalance;
        // Check the balances are the latest
        require(balancesMem.timestamp > 0, "No snapped balances");

        uint256 verifiedValidatorsCount = verifiedValidators.length;
        uint256 totalValidatorBalance = 0;

        // If there are no verified validators then we can skip the balance verification
        if (verifiedValidatorsCount > 0) {
            require(
                balanceProofs.validatorBalanceProofs.length ==
                    verifiedValidatorsCount,
                "Invalid balance proofs"
            );
            require(
                balanceProofs.validatorBalanceLeaves.length ==
                    verifiedValidatorsCount,
                "Invalid balance leaves"
            );
            // verify beaconBlock.state.balances root to beacon block root
            IBeaconProofs(BEACON_PROOFS).verifyBalancesContainer(
                balancesMem.blockRoot,
                balanceProofs.balancesContainerRoot,
                balanceProofs.balancesContainerProof
            );

            // for each validator in reserve order so we can pop off exited validators at the end
            for (uint256 i = verifiedValidatorsCount; i > 0; ) {
                --i;
                // verify validator's balance in beaconBlock.state.balances to the
                // beaconBlock.state.balances container root
                uint256 validatorBalanceGwei = IBeaconProofs(BEACON_PROOFS)
                    .verifyValidatorBalance(
                        balanceProofs.balancesContainerRoot,
                        balanceProofs.validatorBalanceLeaves[i],
                        balanceProofs.validatorBalanceProofs[i],
                        validator[verifiedValidators[i]].index
                    );

                // If the validator balance is zero
                if (validatorBalanceGwei == 0) {
                    // Store the validator state as exited
                    // This could have been in VERIFIED or EXITING state
                    validator[verifiedValidators[i]].state = ValidatorState
                        .EXITED;

                    // Remove the validator with a zero balance from the list of verified validators

                    // Reduce the count of verified validators which is the last index before the pop removes it.
                    verifiedValidatorsCount -= 1;

                    // Move the last validator that has already been verified to the current index.
                    // There's an extra SSTORE if i is the last active validator but that's fine,
                    // It's not a common case and the code is simpler this way.
                    verifiedValidators[i] = verifiedValidators[
                        verifiedValidatorsCount
                    ];
                    // Delete the last validator from the list
                    verifiedValidators.pop();

                    // The validator balance is zero so not need to add to totalValidatorBalance
                    continue;
                }

                // convert Gwei balance to Wei and add to the total validator balance
                totalValidatorBalance += validatorBalanceGwei * 1 gwei;
            }
        }

        uint256 depositsCount = depositList.length;
        uint256 totalDepositsWei = 0;

        // If there are no deposits then we can skip the deposit verification.
        // This section is after the validator balance verifications so an exited validator will be marked
        // as EXITED before the deposits are verified. If there was a deposit to an exited validator
        // then the deposit can only be removed once the validator is fully exited.
        if (depositsCount > 0) {
            // Verify the slot of the first pending deposit matches the beacon chain
            bool isDepositQueueEmpty = IBeaconProofs(BEACON_PROOFS)
                .verifyFirstPendingDeposit(
                    balancesMem.blockRoot,
                    firstPendingDeposit.slot,
                    firstPendingDeposit.pubKeyHash,
                    firstPendingDeposit.pendingDepositPubKeyProof
                );

            // If there are no deposits in the beacon chain queue then our deposits must have been processed.
            // If the deposits have been processed, each deposit will need to be verified with `verifyDeposit`
            require(!isDepositQueueEmpty, "Deposits have been processed");

            // The verification of the validator the first pending deposit is for must be on or after when
            // `snapBalances` was called.
            require(
                balancesMem.timestamp <= validatorVerificationBlockTimestamp,
                "Invalid validator timestamp"
            );

            // Verify the validator of the first pending deposit is not exiting by checking
            // the withdrawable epoch is far into the future.
            // If it is exiting we can't be sure this deposit has not been postponed in the deposit queue.
            // Hence we can not verify if the strategy's deposit has been processed or not.
            IBeaconProofs(BEACON_PROOFS).verifyValidatorWithdrawable(
                // Get the parent beacon block root of the next block which is
                // the block root of the validator verification slot.
                // This will revert if the slot after the verification slot was missed.
                BeaconRoots.parentBlockRoot(
                    validatorVerificationBlockTimestamp
                ),
                firstPendingDeposit.validatorIndex,
                firstPendingDeposit.pubKeyHash,
                // Validator is not exiting
                FAR_FUTURE_EPOCH,
                firstPendingDeposit.withdrawableEpochProof,
                firstPendingDeposit.validatorPubKeyProof
            );

            // solhint-disable max-line-length
            // If a validator is converted from a sweeping validator to a compounding validator, any balance in excess
            // of the min 32 ETH is put in the pending deposit queue. Reference:
            // - [switch_to_compounding_validator](https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#new-switch_to_compounding_validator
            // - [queue_excess_active_balance](https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#new-queue_excess_active_balance)
            // - [process_consolidation_request](https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#new-process_consolidation_request)
            // This will have a slot value of zero unfortunately.
            // We can not prove the strategy's deposits are still pending with a zero slot value so revert the tx.
            // Another snapBalances will need to be taken that does not have consolidation deposits at the front of the
            // beacon chain deposit queue.
            // solhint-enable max-line-length
            require(
                firstPendingDeposit.slot > 0,
                "Invalid first pending deposit"
            );

            // Calculate the epoch at the time of the snapBalances
            uint64 verificationEpoch = (SafeCast.toUint64(
                balancesMem.timestamp
            ) - BEACON_GENESIS_TIMESTAMP) / (SLOT_DURATION * SLOTS_PER_EPOCH);

            // For each staking strategy's deposits
            for (uint256 i = 0; i < depositsCount; ++i) {
                uint256 depositID = depositList[i];
                DepositData memory depositData = deposits[depositID];

                // Check the stored deposit is still waiting to be processed on the beacon chain.
                // That is, the first pending deposit slot is before the slot of the staking strategy's deposit.
                // If the deposit has been processed, it will need to be verified with `verifyDeposit`.
                // OR the deposit is to an exiting validator so check it is still not withdrawable.
                // If the validator is not withdrawable, then the deposit can not have been processed yet.
                // If the validator is now withdrawable, then the deposit may have been processed. The strategy
                // now has to wait until the validator's balance is verified to be zero.
                // OR the validator has exited and the deposit is now verified as processed.
                require(
                    firstPendingDeposit.slot < depositData.slot ||
                        (verificationEpoch < depositData.withdrawableEpoch &&
                            depositData.withdrawableEpoch !=
                            FAR_FUTURE_EPOCH) ||
                        validator[depositData.pubKeyHash].state ==
                        ValidatorState.EXITED,
                    "Deposit likely processed"
                );

                // Remove the deposit if the validator has exited.
                if (
                    validator[depositData.pubKeyHash].state ==
                    ValidatorState.EXITED
                ) {
                    _removeDeposit(depositID, depositData);

                    emit DepositValidatorExited(
                        depositID,
                        uint256(depositData.amountGwei) * 1 gwei
                    );

                    // Skip to the next deposit as the deposit amount is now in the strategy's ETH balance
                    continue;
                }

                // Convert the deposit amount from Gwei to Wei and add to the total
                totalDepositsWei += uint256(depositData.amountGwei) * 1 gwei;
            }
        }

        // Store the verified balance in storage
        lastVerifiedEthBalance =
            totalDepositsWei +
            totalValidatorBalance +
            balancesMem.ethBalance;
        // Reset the last snap timestamp so a new snapBalances has to be made
        snappedBalance.timestamp = 0;

        emit BalancesVerified(
            balancesMem.timestamp,
            totalDepositsWei,
            totalValidatorBalance,
            balancesMem.ethBalance
        );
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Hash a validator public key using the Beacon Chain's format
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        require(pubKey.length == 48, "Invalid public key length");
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    /**
     *
     *         WETH and ETH Accounting
     *
     */

    /// @dev Called when WETH is transferred out of the strategy so
    /// the strategy knows how much WETH it has on deposit.
    /// This is so it can emit the correct amount in the Deposit event in depositAll().
    function _transferWeth(uint256 _amount, address _recipient) internal {
        IERC20(WETH).safeTransfer(_recipient, _amount);

        // The min is required as more WETH can be withdrawn than deposited
        // as the strategy earns consensus and execution rewards.
        uint256 deductAmount = Math.min(_amount, depositedWethAccountedFor);
        depositedWethAccountedFor -= deductAmount;

        // No change in ETH balance so no need to snapshot the balances
    }

    /// @dev Converts ETH to WETH and updates the accounting.
    /// @param _ethAmount The amount of ETH in wei.
    function _convertEthToWeth(uint256 _ethAmount) internal {
        // slither-disable-next-line arbitrary-send-eth
        IWETH9(WETH).deposit{ value: _ethAmount }();

        depositedWethAccountedFor += _ethAmount;

        // Store the reduced ETH balance.
        // The ETH balance in this strategy contract can be more than the last verified ETH balance
        // due to partial withdrawals or full exits being processed by the beacon chain since the last snapBalances.
        // It can also happen from execution rewards (MEV) or ETH donations.
        lastVerifiedEthBalance -= Math.min(lastVerifiedEthBalance, _ethAmount);

        // The ETH balance was decreased to WETH so we need to invalidate the last balances snap.
        snappedBalance.timestamp = 0;
    }

    /// @dev Converts WETH to ETH and updates the accounting.
    /// @param _wethAmount The amount of WETH in wei.
    function _convertWethToEth(uint256 _wethAmount) internal {
        IWETH9(WETH).withdraw(_wethAmount);

        uint256 deductAmount = Math.min(_wethAmount, depositedWethAccountedFor);
        depositedWethAccountedFor -= deductAmount;

        // Store the increased ETH balance
        lastVerifiedEthBalance += _wethAmount;

        // The ETH balance was increased from WETH so we need to invalidate the last balances snap.
        snappedBalance.timestamp = 0;
    }

    /**
     *
     *             View Functions
     *
     */

    /// @notice Returns the number of deposits waiting to be verified as processed on the beacon chain,
    /// or deposits that have been verified to an exiting validator and is now waiting for the
    /// validator's balance to be swept.
    function depositListLength() external view returns (uint256) {
        return depositList.length;
    }

    /// @notice Returns the number of verified validators.
    function verifiedValidatorsLength() external view returns (uint256) {
        return verifiedValidators.length;
    }
}
