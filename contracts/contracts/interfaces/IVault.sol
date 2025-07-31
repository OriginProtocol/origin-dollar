// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultStorage } from "../vault/VaultStorage.sol";

interface IVault {
    // slither-disable-start constable-states

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
    event StrategyAddedToMintWhitelist(address indexed strategy);
    event StrategyRemovedFromMintWhitelist(address indexed strategy);
    event DripperChanged(address indexed _dripper);
    event WithdrawalRequested(
        address indexed _withdrawer,
        uint256 indexed _requestId,
        uint256 _amount,
        uint256 _queued
    );
    event WithdrawalClaimed(
        address indexed _withdrawer,
        uint256 indexed _requestId,
        uint256 _amount
    );
    event WithdrawalClaimable(uint256 _claimable, uint256 _newClaimable);

    // Governable.sol
    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function governor() external view returns (address);

    function ADMIN_IMPLEMENTATION() external view returns (address);

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

    function supportAsset(address _asset, uint8 _unitConversion) external;

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

    function setDripper(address _dripper) external;

    function dripper() external view returns (address);

    function weth() external view returns (address);

    function cacheWETHAssetIndex() external;

    function wethAssetIndex() external view returns (uint256);

    function initialize(address, address) external;

    function setAdminImpl(address) external;

    function removeAsset(address _asset) external;

    // These are OETH specific functions
    function addWithdrawalQueueLiquidity() external;

    function requestWithdrawal(uint256 _amount)
        external
        returns (uint256 requestId, uint256 queued);

    function claimWithdrawal(uint256 requestId)
        external
        returns (uint256 amount);

    function claimWithdrawals(uint256[] memory requestIds)
        external
        returns (uint256[] memory amounts, uint256 totalAmount);

    function withdrawalQueueMetadata()
        external
        view
        returns (VaultStorage.WithdrawalQueueMetadata memory);

    function withdrawalRequests(uint256 requestId)
        external
        view
        returns (VaultStorage.WithdrawalRequest memory);

    // OETHb specific functions
    function addStrategyToMintWhitelist(address strategyAddr) external;

    function removeStrategyFromMintWhitelist(address strategyAddr) external;

    function isMintWhitelistedStrategy(address strategyAddr)
        external
        view
        returns (bool);

    function withdrawalClaimDelay() external view returns (uint256);

    function setWithdrawalClaimDelay(uint256 newDelay) external;

    function lastRebase() external view returns (uint64);

    function dripDuration() external view returns (uint64);

    function setDripDuration(uint256 _dripDuration) external;

    function rebasePerSecondMax() external view returns (uint64);

    function setRebaseRateMax(uint256 yearlyApr) external;

    function rebasePerSecondTarget() external view returns (uint64);

    function previewYield() external view returns (uint256 yield);

    // slither-disable-end constable-states
}
