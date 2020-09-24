pragma solidity 0.5.11;

interface IVault {
    // VaultAdmin.sol
    function setPriceProvider(address _priceProvider) external;

    function setRedeemFeeBps(uint256 _redeemFeeBps) external;

    function setVaultBuffer(uint256 _vaultBuffer) external;

    function setAutoAllocateThreshold(uint256 _threshold) external;

    function setRebaseThreshold(uint256 _threshold) external;

    function supportAsset(address _asset) external;

    function addStrategy(address _addr, uint256 _targetWeight) external;

    function removeStrategy(address _addr) external;

    function setStrategyWeights() external;

    function pauseRebase() external;

    function unpauseRebase() external;

    function pauseDeposits() external;

    function unpauseDeposits() external;

    function transferToken(address _asset, uint256 _amount) external;

    function collectRewardTokens() external;

    function priceUSDMint(string calldata symbol) external returns (uint256);

    function priceUSDRedeem(string calldata symbol) external returns (uint256);

    // VaultCore.sol
    function mint(address _asset, uint256 _amount) external;

    function mintMultiple(
        address[] calldata _assets,
        uint256[] calldata _amount
    ) external;

    function redeem(uint256 _amount) external;

    function redeemAll() external;

    function allocate() external;

    function rebase() external returns (uint256);

    function checkBalance(address _asset) external view returns (uint256);

    function calculateRedeemOutputs(uint256 _amount)
        external
        returns (uint256[] memory);

    function getAssetCount() external view returns (uint256);

    function getAllAssets() external view returns (address[] memory);

    function getStrategyCount() external view returns (uint256);

    function getAPR() external returns (uint256);

    function isSupportedAsset(address _asset) external view returns (bool);
}
