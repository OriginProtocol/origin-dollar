// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IFeeSplitter {
    event Distributed(
        address indexed asset,
        uint256 opsAmount,
        uint256 buybackAmount
    );
    event OperationsBpsUpdated(uint16 bps);
    event OperationsWalletUpdated(address wallet);
    event HarvesterUpdated(address harvester);
    event OperatorUpdated(address operator);
    event AssetAdded(address indexed asset, uint256 minAmount);
    event AssetRemoved(address indexed asset);
    event MinDistributeUpdated(address indexed asset, uint256 minAmount);
    event Rescued(address indexed token, uint256 amount);
    event GovernorshipTransferred(
        address indexed previousGovernor,
        address indexed newGovernor
    );
    event PendingGovernorshipTransfer(
        address indexed previousGovernor,
        address indexed newGovernor
    );
    event StrategistUpdated(address _address);

    function MAX_OPERATIONS_BPS() external view returns (uint16);

    function operationsBps() external view returns (uint16);

    function operationsWallet() external view returns (address);

    function harvester() external view returns (address);

    function operatorAddr() external view returns (address);

    function supportedAssets(uint256 index) external view returns (address);

    function isSupported(address asset) external view returns (bool);

    function minDistribute(address asset) external view returns (uint256);

    function getSupportedAssets() external view returns (address[] memory);

    function previewDistribute(address asset)
        external
        view
        returns (uint256 opsAmount, uint256 buybackAmount);

    function distribute() external;

    function distribute(address[] calldata assets) external;

    function setOperationsBps(uint16 bps) external;

    function setOperationsWallet(address wallet) external;

    function setHarvester(address harvester) external;

    function rescue(address token, uint256 amount) external;

    function addAsset(address asset, uint256 minAmount) external;

    function removeAsset(address asset) external;

    function setMinDistribute(address asset, uint256 minAmount) external;

    function setOperatorAddr(address operator) external;

    function optIntoRebase(address oToken) external;

    // Governable / Strategizable
    function governor() external view returns (address);

    function strategistAddr() external view returns (address);

    function setStrategistAddr(address _address) external;

    function transferGovernance(address newGovernor) external;

    function claimGovernance() external;
}
