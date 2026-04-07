// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOETHSupernovaAMOStrategy {
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

    // Events (StableSwapAMMStrategy-specific)
    event SwapOTokensToPool(
        uint256 oTokenMinted,
        uint256 assetDepositAmount,
        uint256 oTokenDepositAmount,
        uint256 lpTokens
    );
    event SwapAssetsToPool(
        uint256 assetSwapped,
        uint256 lpTokens,
        uint256 oTokenBurnt
    );
    event MaxDepegUpdated(uint256 maxDepeg);

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

    // StableSwapAMMStrategy / OETHSupernovaAMOStrategy-specific functions
    function initialize(
        address[] calldata _rewardTokenAddresses,
        uint256 _maxDepeg
    ) external;

    function swapOTokensToPool(uint256 _oTokenAmount) external;

    function swapAssetsToPool(uint256 _assetAmount) external;

    function setMaxDepeg(uint256 _maxDepeg) external;

    // View functions
    function asset() external view returns (address);

    function oToken() external view returns (address);

    function pool() external view returns (address);

    function gauge() external view returns (address);

    function oTokenPoolIndex() external view returns (uint256);

    function maxDepeg() external view returns (uint256);

    function SOLVENCY_THRESHOLD() external view returns (uint256);

    function PRECISION() external view returns (uint256);
}
