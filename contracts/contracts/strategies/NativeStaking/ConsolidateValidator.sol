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

    // @notice last target consolidation validator public key
    bytes32 public consolidationLastPubKeyHash;
    address public consolidationSourceStrategy;
    mapping(address => bool) public consolidationSourceStrategies;
    address public consolidationTargetStrategy;

    // For future use
    uint256[50] private __gap;

    event RegistratorChanged(address indexed newAddress);
    event SourceStrategyAdded(address indexed strategy);
    event TargetStrategyChanged(address indexed strategy);
    event ConsolidationRequested(
        bytes32 indexed targetPubKeyHash,
        address indexed sourceStrategy
    );
    event ConsolidationVerified(
        bytes32 indexed lastSourcePubKeyHash,
        uint64 indexed lastValidatorIndex,
        uint256 consolidationCount
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
        // PREVENT 2 different contracts form starting.

        IConsolidationTarget(consolidationTargetStrategy)
            .initiateConsolidation(targetPubKeyHash);

        // Store consolidation state
        consolidationLastPubKeyHash = targetPubKeyHash;
        consolidationSourceStrategy = msg.sender;

        emit ConsolidationRequested(
            targetPubKeyHash,
            msg.sender
        );
    }

    /// @notice Verifies that the consolidation has completed by verifying the 0x02 target validator
    /// balance is of the expected minimum value. Which is 32 ETH (the target validator owned before 
    /// starting the consolidation) + 32 ETH * number_of_source_validators
    /// @param targetValidatorIndex The index of the target validator
    /// @param validatorPubKeyProof The merkle proof that the validator's index matches its public key
    /// @param validatorBalanceProof The merkle proof of the target's validator balance
    // slither-disable-start reentrancy-no-eth
    function verifyConsolidation(
        uint64 parentBlockTimestamp,
        uint64 targetValidatorIndex,
        bytes calldata validatorPubKeyProof,
        bytes32 balancesLeaf,
        bytes calldata validatorBalanceProof
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

        bytes32 blockRoot = BeaconRoots.parentBlockRoot(parentBlockTimestamp);
        // Verify the validator index has the same public key as the last target validator
        IBeaconProofs(BEACON_PROOFS).verifyValidatorPubkey(
            blockRoot,
            consolidationLastPubKeyHashMem,
            validatorPubKeyProof,
            targetValidatorIndex,
            address(this) // Withdrawal address is this strategy
        );

        // Verify that the target validator has the expected ETH staked to it. This
        // confirms that all the source validators have successfully consolidated to it.
        uint256 validatorBalance = IBeaconProofs(BEACON_PROOFS)
            .verifyValidatorBalance(
                blockRoot,
                balancesLeaf,
                validatorBalanceProof,
                targetValidatorIndex,
                IBeaconProofs.BalanceProofLevel.BeaconBlock
            );

        // Call the old sweeping strategy to confirm the consolidation has been completed.
        // This will decrease the balance of the source strategy by 32 ETH for each validator being consolidated.
        uint256 consolidationCount = IConsolidationSource(
            consolidationSourceStrategy
        ).confirmConsolidation();

        // the target validator should have the balance of: 
        // - 32 ether of its own plus
        // - number of consolidated validators * 32 ether
        require(
            validatorBalance >= FULL_STAKE + consolidationCount * FULL_STAKE,
            "Validators not consolidated"
        );

        // Reset the stored consolidation state
        consolidationLastPubKeyHash = bytes32(0);
        consolidationSourceStrategy = address(0);

        emit ConsolidationVerified(
            consolidationLastPubKeyHashMem,
            targetValidatorIndex,
            consolidationCount
        );

        IConsolidationTarget(consolidationTargetStrategy)
            .consolidationCompleted(consolidationLastPubKeyHashMem, validatorBalance);
    }

    /// @notice Hash a validator public key using the Beacon Chain's format
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }
}
