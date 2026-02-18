// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Cluster {
    uint32 validatorCount;
    uint64 networkFeeIndex;
    uint64 index;
    bool active;
    uint256 balance;
}

interface ISSVNetwork {
    /**********/
    /* Errors */
    /**********/

    error CallerNotOwner(); // 0x5cd83192
    error CallerNotWhitelisted(); // 0x8c6e5d71
    error FeeTooLow(); // 0x732f9413
    error FeeExceedsIncreaseLimit(); // 0x958065d9
    error NoFeeDeclared(); // 0x1d226c30
    error ApprovalNotWithinTimeframe(); // 0x97e4b518
    error OperatorDoesNotExist(); // 0x961e3e8c
    error InsufficientBalance(); // 0xf4d678b8
    error ValidatorDoesNotExist(); // 0xe51315d2
    error ClusterNotLiquidatable(); // 0x60300a8d
    error InvalidPublicKeyLength(); // 0x637297a4
    error InvalidOperatorIdsLength(); // 0x38186224
    error ClusterAlreadyEnabled(); // 0x3babafd2
    error ClusterIsLiquidated(); // 0x95a0cf33
    error ClusterDoesNotExists(); // 0x185e2b16
    error IncorrectClusterState(); // 0x12e04c87
    error UnsortedOperatorsList(); // 0xdd020e25
    error NewBlockPeriodIsBelowMinimum(); // 0x6e6c9cac
    error ExceedValidatorLimit(); // 0x6df5ab76
    error TokenTransferFailed(); // 0x045c4b02
    error SameFeeChangeNotAllowed(); // 0xc81272f8
    error FeeIncreaseNotAllowed(); // 0x410a2b6c
    error NotAuthorized(); // 0xea8e4eb5
    error OperatorsListNotUnique(); // 0xa5a1ff5d
    error OperatorAlreadyExists(); // 0x289c9494
    error TargetModuleDoesNotExist(); // 0x8f9195fb
    error MaxValueExceeded(); // 0x91aa3017
    error FeeTooHigh(); // 0xcd4e6167
    error PublicKeysSharesLengthMismatch(); // 0x9ad467b8
    error IncorrectValidatorStateWithData(bytes publicKey); // 0x89307938
    error ValidatorAlreadyExistsWithData(bytes publicKey); // 0x388e7999
    error EmptyPublicKeysList(); // df83e679

    // legacy errors
    error ValidatorAlreadyExists(); // 0x8d09a73e
    error IncorrectValidatorState(); // 0x2feda3c1

    event AdminChanged(address previousAdmin, address newAdmin);
    event BeaconUpgraded(address indexed beacon);
    event ClusterDeposited(
        address indexed owner,
        uint64[] operatorIds,
        uint256 value,
        Cluster cluster
    );
    event ClusterLiquidated(
        address indexed owner,
        uint64[] operatorIds,
        Cluster cluster
    );
    event ClusterReactivated(
        address indexed owner,
        uint64[] operatorIds,
        Cluster cluster
    );
    event ClusterWithdrawn(
        address indexed owner,
        uint64[] operatorIds,
        uint256 value,
        Cluster cluster
    );
    event DeclareOperatorFeePeriodUpdated(uint64 value);
    event ExecuteOperatorFeePeriodUpdated(uint64 value);
    event FeeRecipientAddressUpdated(
        address indexed owner,
        address recipientAddress
    );
    event Initialized(uint8 version);
    event LiquidationThresholdPeriodUpdated(uint64 value);
    event MinimumLiquidationCollateralUpdated(uint256 value);
    event NetworkEarningsWithdrawn(uint256 value, address recipient);
    event NetworkFeeUpdated(uint256 oldFee, uint256 newFee);
    event OperatorAdded(
        uint64 indexed operatorId,
        address indexed owner,
        bytes publicKey,
        uint256 fee
    );
    event OperatorFeeDeclarationCancelled(
        address indexed owner,
        uint64 indexed operatorId
    );
    event OperatorFeeDeclared(
        address indexed owner,
        uint64 indexed operatorId,
        uint256 blockNumber,
        uint256 fee
    );
    event OperatorFeeExecuted(
        address indexed owner,
        uint64 indexed operatorId,
        uint256 blockNumber,
        uint256 fee
    );
    event OperatorFeeIncreaseLimitUpdated(uint64 value);
    event OperatorMaximumFeeUpdated(uint64 maxFee);
    event OperatorRemoved(uint64 indexed operatorId);
    event OperatorWhitelistUpdated(
        uint64 indexed operatorId,
        address whitelisted
    );
    event OperatorWithdrawn(
        address indexed owner,
        uint64 indexed operatorId,
        uint256 value
    );
    event OwnershipTransferStarted(
        address indexed previousOwner,
        address indexed newOwner
    );
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event Upgraded(address indexed implementation);
    event ValidatorAdded(
        address indexed owner,
        uint64[] operatorIds,
        bytes publicKey,
        bytes shares,
        Cluster cluster
    );
    event ValidatorExited(
        address indexed owner,
        uint64[] operatorIds,
        bytes publicKey
    );
    event ValidatorRemoved(
        address indexed owner,
        uint64[] operatorIds,
        bytes publicKey,
        Cluster cluster
    );

    fallback() external;

    function acceptOwnership() external;

    function cancelDeclaredOperatorFee(uint64 operatorId) external;

    function declareOperatorFee(uint64 operatorId, uint256 fee) external;

    function deposit(
        address clusterOwner,
        uint64[] memory operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external;

    function executeOperatorFee(uint64 operatorId) external;

    function exitValidator(bytes memory publicKey, uint64[] memory operatorIds)
        external;

    function bulkExitValidator(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds
    ) external;

    function getVersion() external pure returns (string memory version);

    function initialize(
        address token_,
        address ssvOperators_,
        address ssvClusters_,
        address ssvDAO_,
        address ssvViews_,
        uint64 minimumBlocksBeforeLiquidation_,
        uint256 minimumLiquidationCollateral_,
        uint32 validatorsPerOperatorLimit_,
        uint64 declareOperatorFeePeriod_,
        uint64 executeOperatorFeePeriod_,
        uint64 operatorMaxFeeIncrease_
    ) external;

    function liquidate(
        address clusterOwner,
        uint64[] memory operatorIds,
        Cluster memory cluster
    ) external;

    function owner() external view returns (address);

    function pendingOwner() external view returns (address);

    function proxiableUUID() external view returns (bytes32);

    function reactivate(
        uint64[] memory operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external;

    function reduceOperatorFee(uint64 operatorId, uint256 fee) external;

    function registerOperator(bytes memory publicKey, uint256 fee)
        external
        returns (uint64 id);

    function registerValidator(
        bytes memory publicKey,
        uint64[] memory operatorIds,
        bytes memory sharesData,
        Cluster memory cluster
    ) external payable;

    function bulkRegisterValidator(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        bytes[] calldata sharesData,
        uint256 amount,
        Cluster memory cluster
    ) external;

    function migrateClusterToETH(
        uint64[] calldata operatorIds,
        Cluster memory cluster
    ) external payable;

    function removeOperator(uint64 operatorId) external;

    function removeValidator(
        bytes memory publicKey,
        uint64[] memory operatorIds,
        Cluster memory cluster
    ) external;

    function bulkRemoveValidator(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        Cluster memory cluster
    ) external;

    function renounceOwnership() external;

    function setFeeRecipientAddress(address recipientAddress) external;

    function setOperatorWhitelist(uint64 operatorId, address whitelisted)
        external;

    function transferOwnership(address newOwner) external;

    function updateDeclareOperatorFeePeriod(uint64 timeInSeconds) external;

    function updateExecuteOperatorFeePeriod(uint64 timeInSeconds) external;

    function updateLiquidationThresholdPeriod(uint64 blocks) external;

    function updateMaximumOperatorFee(uint64 maxFee) external;

    function updateMinimumLiquidationCollateral(uint256 amount) external;

    function updateModule(uint8 moduleId, address moduleAddress) external;

    function updateNetworkFee(uint256 fee) external;

    function updateOperatorFeeIncreaseLimit(uint64 percentage) external;

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(address newImplementation, bytes memory data)
        external
        payable;

    function withdraw(
        uint64[] memory operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external;

    function withdrawAllOperatorEarnings(uint64 operatorId) external;

    function withdrawNetworkEarnings(uint256 amount) external;

    function withdrawOperatorEarnings(uint64 operatorId, uint256 amount)
        external;
}
