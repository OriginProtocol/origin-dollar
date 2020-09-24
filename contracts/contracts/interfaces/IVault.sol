pragma solidity 0.5.11;

interface IVault {
    // VaultAdmin.sol
    function setPriceProvider(address _priceProvider) external;

    function priceProvider() external view returns (address);

    function setRedeemFeeBps(uint256 _redeemFeeBps) external;

    function redeemFeeBps() external view returns (uint256);

    function setVaultBuffer(uint256 _vaultBuffer) external;

    function vaultBuffer() external view returns (uint256);

    function setAutoAllocateThreshold(uint256 _threshold) external;

    function autoAllocateThreshold() external view returns (uint256);

    function setRebaseThreshold(uint256 _threshold) external;

    function rebaseThreshold() external view returns (uint256);

    function setUniswapPairAddr(address _address) external;

    function uniswapPairAddr() external view returns (address);

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
