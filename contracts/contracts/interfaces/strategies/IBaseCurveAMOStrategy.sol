// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBaseCurveAMOStrategy {
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

    // Events (BaseCurveAMOStrategy-specific)
    event MaxSlippageUpdated(uint256 newMaxSlippage);

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

    function transferToken(address token, uint256 amount) external;

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

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    // BaseCurveAMOStrategy-specific functions
    function initialize(
        address[] calldata _rewardTokenAddresses,
        uint256 _maxSlippage
    ) external;

    function mintAndAddOTokens(uint256 _oTokens) external;

    function removeAndBurnOTokens(uint256 _lpTokens) external;

    function removeOnlyAssets(uint256 _lpTokens) external;

    function setMaxSlippage(uint256 _maxSlippage) external;

    // BaseCurveAMOStrategy view functions
    function curvePool() external view returns (address);

    function gauge() external view returns (address);

    function gaugeFactory() external view returns (address);

    function weth() external view returns (address);

    function oeth() external view returns (address);

    function lpToken() external view returns (address);

    function oethCoinIndex() external view returns (uint128);

    function wethCoinIndex() external view returns (uint128);

    function maxSlippage() external view returns (uint256);

    function SOLVENCY_THRESHOLD() external view returns (uint256);
}
