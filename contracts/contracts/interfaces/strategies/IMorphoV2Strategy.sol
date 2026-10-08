// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IMorphoV2Strategy {
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

    // Events (Generalized4626Strategy-specific)
    event ClaimedRewards(address indexed token, uint256 amount);

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

    function assetToPToken(address _asset) external view returns (address);

    function setPTokenAddress(address _asset, address _pToken) external;

    function removePToken(uint256 _index) external;

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    // Generalized4626Strategy functions
    function initialize() external;

    function merkleClaim(
        address token,
        uint256 amount,
        bytes32[] calldata proof
    ) external;

    // View functions
    function shareToken() external view returns (address);

    function assetToken() external view returns (address);

    function merkleDistributor() external view returns (address);

    // MorphoV2Strategy-specific functions
    function maxWithdraw() external view returns (uint256);
}
