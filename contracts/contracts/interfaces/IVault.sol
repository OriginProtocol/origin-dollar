pragma solidity 0.5.11;

interface IVault {
    event AssetSupported(address _asset);
    event StrategyAdded(address _addr);
    event StrategyRemoved(address _addr);
    event Mint(address _addr, uint256 _value);
    event Redeem(address _addr, uint256 _value);
    event StrategyWeightsUpdated(
        address[] _strategyAddresses,
        uint256[] weights
    );
    event DepositsPaused();
    event DepositsUnpaused();

    // Governable.sol
    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function governor() external view returns (address);

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

    function setRebaseHooksAddr(address _address) external;

    function rebaseHooksAddr() external view returns (address);

    function setUniswapAddr(address _address) external;

    function uniswapAddr() external view returns (address);

    function supportAsset(address _asset) external;

    function addStrategy(address _addr, uint256 _targetWeight) external;

    function removeStrategy(address _addr) external;

    function setStrategyWeights(
        address[] calldata _strategyAddresses,
        uint256[] calldata _weights
    ) external;

    function pauseRebase() external;

    function unpauseRebase() external;

    function rebasePaused() external view returns (bool);

    function pauseDeposits() external;

    function unpauseDeposits() external;

    function depositPaused() external view returns (bool);

    function transferToken(address _asset, uint256 _amount) external;

    function harvest() external;

    function harvest(address _strategyAddr) external;

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

    function allocateFrom(
        address _strategyFromAddress,
        address _strategyToAddress,
        address[] _assets,
        uint256[] _amounts
    ) external;

    function rebase() external returns (uint256);

    function totalValue() external view returns (uint256 value);

    function checkBalance() external view returns (uint256);

    function checkBalance(address _asset) external view returns (uint256);

    function calculateRedeemOutputs(uint256 _amount)
        external
        returns (uint256[] memory);

    function getAssetCount() external view returns (uint256);

    function getAllAssets() external view returns (address[] memory);

    function getStrategyCount() external view returns (uint256);

    function isSupportedAsset(address _asset) external view returns (bool);
}
