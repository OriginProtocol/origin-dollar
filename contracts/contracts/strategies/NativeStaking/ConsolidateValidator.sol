// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Governable } from "../../governance/Governable.sol";
import { IConsolidationSource, IConsolidationStrategy, IConsolidationTarget } from "../../interfaces/IConsolidation.sol";
import { BeaconRoots } from "../../beacon/BeaconRoots.sol";
import { IBeaconProofs } from "../../interfaces/IBeaconProofs.sol";

/**
 * @title Contract for managing consolidation of 0x01 validators to 0x02 validator
 * @notice This contract implements the required functionality to
 * register, deposit and consolidate validators.
 * @author Origin Protocol Inc
 */
abstract contract ConsolidateValidator is Governable, IConsolidationStrategy, IConsolidationTarget {
    /// @notice Address of the Beacon Proofs contract that verifies beacon chain data
    address public immutable BEACON_PROOFS;
    uint256 public constant FULL_STAKE = 32 ether;

    /// @notice Address of the registrator - allowed to register, withdraw, exit and remove validators
    address public validatorRegistrator;

    /// @notice Specifies maximum shortfall of ETH allowed after consolidation. Unless a slashing
    ///         happens in the middle of consolidation this amount should remain at 0.
    uint256 public maximumConsolidationCorrection;

    // @notice last target consolidation validator public key
    bytes32 public consolidationLastPubKeyHash;
    address public consolidationSourceStrategy;
    mapping(address => bool) public consolidationSourceStrategies;
    address public consolidationTargetStrategy;
    uint64 public consolidationStartBlockTimestamp;

    // For future use
    uint256[43] private __gap;

    event RegistratorChanged(address indexed newAddress);
    event SourceStrategyAdded(address indexed strategy);
    event TargetStrategyChanged(address indexed strategy);
    event ConsolidationRequested(
        bytes32 indexed targetPubKeyHash,
        address indexed sourceStrategy,
        uint256 timestamp
    );
    event ConsolidationVerified(
        bytes32 indexed lastSourcePubKeyHash,
        uint64 indexed lastValidatorIndex,
        uint256 consolidationCount,
        uint256 consolidatedAmount
    );

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(msg.sender == validatorRegistrator, "Not Registrator");
        _;
    }

    /// @param _beaconProofs Address of the Beacon Proofs contract that verifies beacon chain data
    constructor(
        address _beaconProofs
    ) {
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

    /// @notice Sets the consolidation target strategy
    function setTargetStrategy(address _strategy) external onlyGovernor {
        consolidationTargetStrategy = _strategy;

        emit TargetStrategyChanged(_strategy);
    }

    /***************************************
                Consolidation
    ****************************************/

    /// @notice Receives requests from supported legacy strategies to consolidate sweeping validators to
    /// a new compounding validator on this new strategy.
    /// @param targetPubKeyHash The target validator's hashed public key
    function requestConsolidation(
        bytes32 targetPubKeyHash
    ) external {
        require(
            consolidationTargetStrategy != address(0),
            "Target strat not set"
        );
        require(
            consolidationSourceStrategies[msg.sender],
            "Not a source strategy"
        );
        require(
            consolidationSourceStrategy == address(0),
            "Another consolidation in progress"
        );

        /**
         * Record the timestamp of the consolidation start. This is later used to fetch the beacon 
         * chain Merkle hash tree root which is used to verify the target validator balance.
         */
        consolidationStartBlockTimestamp = SafeCast.toUint64(block.timestamp);

        IConsolidationTarget(consolidationTargetStrategy)
            .initiateConsolidation(targetPubKeyHash);

        // Store consolidation state
        consolidationLastPubKeyHash = targetPubKeyHash;
        consolidationSourceStrategy = msg.sender;

        emit ConsolidationRequested(
            targetPubKeyHash,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Verifies that the consolidation has completed by verifying the 0x02 target validator
    /// balance is of the expected minimum value. Which is 32 ETH (the target validator owned before 
    /// starting the consolidation) + 32 ETH * number_of_source_validators
    /// @param targetValidatorIndex The index of the target validator
    /// @param validatorPubKeyProof The merkle proof that the validator's index matches its public key
    /// @param validatorBalanceProofBefore The merkle proof of the target's validator balance before
    ///        the consolidation
    /// @param validatorBalanceProofAfter The merkle proof of the target's validator balance after
    ///        the consolidation
    // slither-disable-start reentrancy-no-eth
    function verifyConsolidation(
        uint64 parentBlockTimestamp,
        uint64 targetValidatorIndex,
        bytes calldata validatorPubKeyProof,
        bytes32 balancesLeafBefore,
        bytes calldata validatorBalanceProofBefore,
        bytes32 balancesLeafAfter,
        bytes calldata validatorBalanceProofAfter
    ) external onlyRegistrator {
        bytes32 consolidationLastPubKeyHashMem = consolidationLastPubKeyHash;
        require(
            consolidationTargetStrategy != address(0),
            "Target strat not set"
        );
        require(
            consolidationLastPubKeyHashMem != bytes32(0),
            "No consolidations"
        );

        /**
         * @param consolidationStartBlockTimestamp is recorded at the time consolidation has been 
         *        initialized. Assuring that the resulting balance can not include any of the
         *        consolidated validator balances.
         */
        uint256 targetValidatorBalanceBefore = _validatorBalanceProof(
            consolidationStartBlockTimestamp,
            consolidationLastPubKeyHashMem,
            targetValidatorIndex,
            validatorPubKeyProof,
            balancesLeafBefore,
            validatorBalanceProofBefore,
            consolidationTargetStrategy
        );

        /**
         * @param parentBlockTimestamp can be arbitrary and supplied from the governor. This contract isn't
         *        particularly concerned when the timestamp is from, as long as it contains sufficient
         *        balance - meaning that the validators have already consolidated.
         */
        uint256 targetValidatorBalanceAfter = _validatorBalanceProof(
            parentBlockTimestamp,
            consolidationLastPubKeyHashMem,
            targetValidatorIndex,
            validatorPubKeyProof,
            balancesLeafAfter,
            validatorBalanceProofAfter,
            consolidationTargetStrategy
        );

        // Call the old sweeping strategy to confirm the consolidation has been completed.
        // This will decrease the balance of the source strategy by 32 ETH for each validator being consolidated.
        uint256 consolidationCount = IConsolidationSource(
            consolidationSourceStrategy
        ).confirmConsolidation();

        // amount that has been gained due to consolidation
        uint256 consolidatedAmount = targetValidatorBalanceAfter - targetValidatorBalanceBefore;

        require(
            consolidatedAmount - maximumConsolidationCorrection >= FULL_STAKE * consolidationCount,
            "Not all validators consolidated"
        );

        // Reset the stored consolidation state
        consolidationLastPubKeyHash = bytes32(0);
        consolidationStartBlockTimestamp = 0;
        consolidationSourceStrategy = address(0);

        emit ConsolidationVerified(
            consolidationLastPubKeyHashMem,
            targetValidatorIndex,
            consolidationCount,
            consolidatedAmount
        );

        IConsolidationTarget(consolidationTargetStrategy)
            .consolidationCompleted(consolidationLastPubKeyHashMem, consolidatedAmount);
    }

    function _validatorBalanceProof(
        uint64 blockTimestamp,
        bytes32 validatorPubKeyHash,
        uint64 validatorIndex,
        bytes calldata validatorPubKeyProof,
        bytes32 balancesLeaf,
        bytes calldata validatorBalanceProof,
        address withdrawalAddress
    ) internal returns (uint256 balance) {
        bytes32 blockRoot = BeaconRoots.parentBlockRoot(blockTimestamp);
        // Verify the validator index has the same public key as the last target validator
        IBeaconProofs(BEACON_PROOFS).verifyValidatorPubkey(
            blockRoot,
            validatorPubKeyHash,
            validatorPubKeyProof,
            validatorIndex,
            withdrawalAddress
        );

        // Verify that the target validator has the expected ETH staked to it. This
        // confirms that all the source validators have successfully consolidated to it.
        balance = IBeaconProofs(BEACON_PROOFS)
            .verifyValidatorBalance(
                blockRoot,
                balancesLeaf,
                validatorBalanceProof,
                validatorIndex,
                IBeaconProofs.BalanceProofLevel.BeaconBlock
            );
    }

    /// @notice Hash a validator public key using the Beacon Chain's format
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }
}
