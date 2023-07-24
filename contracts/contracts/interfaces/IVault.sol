// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultStorage } from "../vault/VaultStorage.sol";

interface IVault {
    event AssetSupported(address _asset);
    event AssetDefaultStrategyUpdated(address _asset, address _strategy);
    event AssetAllocated(address _asset, address _strategy, uint256 _amount);
    event StrategyApproved(address _addr);
    event StrategyRemoved(address _addr);
    event Mint(address _addr, uint256 _value);
    event Redeem(address _addr, uint256 _value);
    event CapitalPaused();
    event CapitalUnpaused();
    event RebasePaused();
    event RebaseUnpaused();
    event VaultBufferUpdated(uint256 _vaultBuffer);
    event RedeemFeeUpdated(uint256 _redeemFeeBps);
    event PriceProviderUpdated(address _priceProvider);
    event AllocateThresholdUpdated(uint256 _threshold);
    event RebaseThresholdUpdated(uint256 _threshold);
    event StrategistUpdated(address _address);
    event MaxSupplyDiffChanged(uint256 maxSupplyDiff);
    event YieldDistribution(address _to, uint256 _yield, uint256 _fee);
    event TrusteeFeeBpsChanged(uint256 _basis);
    event TrusteeAddressChanged(address _address);
    event SwapperChanged(address _address);
    event SwapAllowedUndervalueChanged(uint256 _basis);
    event SwapSlippageChanged(address _asset, uint256 _basis);
    event Swapped(
        address indexed _fromAsset,
        address indexed _toAsset,
        uint256 _fromAssetAmount,
        uint256 _toAssetAmount
    );

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

    function setStrategistAddr(address _address) external;

    function strategistAddr() external view returns (address);

    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external;

    function maxSupplyDiff() external view returns (uint256);

    function setTrusteeAddress(address _address) external;

    function trusteeAddress() external view returns (address);

    function setTrusteeFeeBps(uint256 _basis) external;

    function trusteeFeeBps() external view returns (uint256);

    function ousdMetaStrategy() external view returns (address);

    function setSwapper(address _swapperAddr) external;

    function setSwapAllowedUndervalue(uint16 _percentageBps) external;

    function setOracleSlippage(address _asset, uint16 _allowedOracleSlippageBps)
        external;

    function supportAsset(address _asset, uint8 _supportsAsset) external;

    function approveStrategy(address _addr) external;

    function removeStrategy(address _addr) external;

    function setAssetDefaultStrategy(address _asset, address _strategy)
        external;

    function assetDefaultStrategies(address _asset)
        external
        view
        returns (address);

    function pauseRebase() external;

    function unpauseRebase() external;

    function rebasePaused() external view returns (bool);

    function pauseCapital() external;

    function unpauseCapital() external;

    function capitalPaused() external view returns (bool);

    function transferToken(address _asset, uint256 _amount) external;

    function priceUnitMint(address asset) external view returns (uint256);

    function priceUnitRedeem(address asset) external view returns (uint256);

    // The following two function definitions exist for backward compatibility
    function priceUSDMint(address asset) external view returns (uint256);

    function priceUSDRedeem(address asset) external view returns (uint256);

    function withdrawAllFromStrategy(address _strategyAddr) external;

    function withdrawAllFromStrategies() external;

    function withdrawFromStrategy(
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external;

    function depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external;

    // VaultCore.sol
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external;

    function mintForStrategy(uint256 _amount) external;

    function redeem(uint256 _amount, uint256 _minimumUnitAmount) external;

    function burnForStrategy(uint256 _amount) external;

    function redeemAll(uint256 _minimumUnitAmount) external;

    function allocate() external;

    function rebase() external;

    function swapCollateral(
        address fromAsset,
        address toAsset,
        uint256 fromAssetAmount,
        uint256 minToAssetAmount,
        bytes calldata data
    ) external returns (uint256 toAssetAmount);

    function totalValue() external view returns (uint256 value);

    function checkBalance(address _asset) external view returns (uint256);

    function calculateRedeemOutputs(uint256 _amount)
        external
        view
        returns (uint256[] memory);

    function getAssetCount() external view returns (uint256);

    function getAssetConfig(address _asset)
        external
        view
        returns (VaultStorage.Asset memory config);

    function getAllAssets() external view returns (address[] memory);

    function getStrategyCount() external view returns (uint256);

    function swapper() external view returns (address);

    function allowedSwapUndervalue() external view returns (uint256);

    function getAllStrategies() external view returns (address[] memory);

    function isSupportedAsset(address _asset) external view returns (bool);

    function netOusdMintForStrategyThreshold() external view returns (uint256);

    function setOusdMetaStrategy(address _ousdMetaStrategy) external;

    function setNetOusdMintForStrategyThreshold(uint256 _threshold) external;

    function netOusdMintedForStrategy() external view returns (int256);
}
