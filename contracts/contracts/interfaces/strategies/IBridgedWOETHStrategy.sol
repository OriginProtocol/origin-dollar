// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBridgedWOETHStrategy {
    // Events (from InitializableAbstractStrategy)
    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    event RewardTokenCollected(
        address recipient,
        address rewardToken,
        uint256 amount
    );
    event PTokenAdded(address indexed _asset, address _pToken);
    event PTokenRemoved(address indexed _asset, address _pToken);
    event RewardTokenAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event HarvesterAddressesUpdated(
        address _oldHarvesterAddress,
        address _newHarvesterAddress
    );

    // Events (BridgedWOETHStrategy-specific)
    event MaxPriceDiffBpsUpdated(uint128 oldValue, uint128 newValue);
    event WOETHPriceUpdated(uint128 oldValue, uint128 newValue);

    // IStrategy functions
    function deposit(address _asset, uint256 _amount) external;

    function depositAll() external;

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external;

    function withdrawAll() external;

    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance);

    function supportsAsset(address _asset) external view returns (bool);

    function collectRewardTokens() external;

    function getRewardTokenAddresses() external view returns (address[] memory);

    function harvesterAddress() external view returns (address);

    function transferToken(address _asset, uint256 _amount) external;

    function setRewardTokenAddresses(address[] calldata _rewardTokenAddresses)
        external;

    // InitializableAbstractStrategy functions
    function platformAddress() external view returns (address);

    function vaultAddress() external view returns (address);

    function setHarvesterAddress(address _harvesterAddress) external;

    function safeApproveAllTokens() external;

    function rewardTokenAddresses(uint256 _index)
        external
        view
        returns (address);

    function setPTokenAddress(address _asset, address _pToken) external;

    function removePToken(uint256 _index) external;

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    // BridgedWOETHStrategy-specific functions
    function initialize(uint128 _maxPriceDiffBps) external;

    function setMaxPriceDiffBps(uint128 _maxPriceDiffBps) external;

    function updateWOETHOraclePrice() external returns (uint256);

    function getBridgedWOETHValue(uint256 woethAmount)
        external
        view
        returns (uint256);

    function depositBridgedWOETH(uint256 woethAmount) external;

    function withdrawBridgedWOETH(uint256 oethToBurn) external;

    // View functions
    function weth() external view returns (address);

    function bridgedWOETH() external view returns (address);

    function oethb() external view returns (address);

    function oracle() external view returns (address);

    function lastOraclePrice() external view returns (uint128);

    function maxPriceDiffBps() external view returns (uint128);
}
