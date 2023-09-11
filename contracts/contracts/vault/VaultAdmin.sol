// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OToken VaultAdmin contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IOracle } from "../interfaces/IOracle.sol";
import { ISwapper } from "../interfaces/ISwapper.sol";
import { IVault } from "../interfaces/IVault.sol";
import { StableMath } from "../utils/StableMath.sol";

import "./VaultStorage.sol";

contract VaultAdmin is VaultStorage {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @dev Verifies that the caller is the Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @notice Set address of price provider.
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
        emit PriceProviderUpdated(_priceProvider);
    }

    /**
     * @notice Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        require(_redeemFeeBps <= 1000, "Redeem fee should not be over 10%");
        redeemFeeBps = _redeemFeeBps;
        emit RedeemFeeUpdated(_redeemFeeBps);
    }

    /**
     * @notice Set a buffer of assets to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding assets from a Strategy.
     * @param _vaultBuffer Percentage using 18 decimals. 100% = 1e18.
     */
    function setVaultBuffer(uint256 _vaultBuffer)
        external
        onlyGovernorOrStrategist
    {
        require(_vaultBuffer <= 1e18, "Invalid value");
        vaultBuffer = _vaultBuffer;
        emit VaultBufferUpdated(_vaultBuffer);
    }

    /**
     * @notice Sets the minimum amount of OTokens in a mint to trigger an
     * automatic allocation of funds afterwords.
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setAutoAllocateThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        autoAllocateThreshold = _threshold;
        emit AllocateThresholdUpdated(_threshold);
    }

    /**
     * @notice Set a minimum amount of OTokens in a mint or redeem that triggers a
     * rebase
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setRebaseThreshold(uint256 _threshold) external onlyGovernor {
        rebaseThreshold = _threshold;
        emit RebaseThresholdUpdated(_threshold);
    }

    /**
     * @notice Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }

    /**
     * @notice Set the default Strategy for an asset, i.e. the one which the asset
            will be automatically allocated to and withdrawn from
     * @param _asset Address of the asset
     * @param _strategy Address of the Strategy
     */
    function setAssetDefaultStrategy(address _asset, address _strategy)
        external
        onlyGovernorOrStrategist
    {
        emit AssetDefaultStrategyUpdated(_asset, _strategy);
        // If its a zero address being passed for the strategy we are removing
        // the default strategy
        if (_strategy != address(0)) {
            // Make sure the strategy meets some criteria
            require(strategies[_strategy].isSupported, "Strategy not approved");
            IStrategy strategy = IStrategy(_strategy);
            require(assets[_asset].isSupported, "Asset is not supported");
            require(
                strategy.supportsAsset(_asset),
                "Asset not supported by Strategy"
            );
        }
        assetDefaultStrategies[_asset] = _strategy;
    }

    /**
     * @notice Set maximum amount of OTokens that can at any point be minted and deployed
     * to strategy (used only by ConvexOUSDMetaStrategy for now).
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setNetOusdMintForStrategyThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        /**
         * Because `netOusdMintedForStrategy` check in vault core works both ways
         * (positive and negative) the actual impact of the amount of OToken minted
         * could be double the threshold. E.g.:
         *  - contract has threshold set to 100
         *  - state of netOusdMinted is -90
         *  - in effect it can mint 190 OToken and still be within limits
         *
         * We are somewhat mitigating this behaviour by resetting the netOusdMinted
         * counter whenever new threshold is set. So it can only move one threshold
         * amount in each direction. This also enables us to reduce the threshold
         * amount and not have problems with current netOusdMinted being near
         * limits on either side.
         */
        netOusdMintedForStrategy = 0;
        netOusdMintForStrategyThreshold = _threshold;
        emit NetOusdMintForStrategyThresholdChanged(_threshold);
    }

    /***************************************
                    Swaps
    ****************************************/

    /**
     * @notice Strategist swaps collateral assets sitting in the vault.
     * @param _fromAsset The token address of the asset being sold by the vault.
     * @param _toAsset The token address of the asset being purchased by the vault.
     * @param _fromAssetAmount The amount of assets being sold by the vault.
     * @param _minToAssetAmount The minimum amount of assets to be purchased.
     * @param _data implementation specific data. eg 1Inch swap data
     * @return toAssetAmount The amount of toAssets that was received from the swap
     */
    function swapCollateral(
        address _fromAsset,
        address _toAsset,
        uint256 _fromAssetAmount,
        uint256 _minToAssetAmount,
        bytes calldata _data
    )
        external
        nonReentrant
        onlyGovernorOrStrategist
        returns (uint256 toAssetAmount)
    {
        // Check fromAsset and toAsset are valid
        Asset memory fromAssetConfig = assets[address(_fromAsset)];
        Asset memory toAssetConfig = assets[_toAsset];
        require(fromAssetConfig.isSupported, "From asset is not supported");
        require(toAssetConfig.isSupported, "To asset is not supported");

        // Load swap config into memory to avoid separate SLOADs
        SwapConfig memory config = swapConfig;

        // Scope a new block to remove toAssetBalBefore from the scope of swapCollateral.
        // This avoids a stack too deep error.
        {
            uint256 toAssetBalBefore = IERC20(_toAsset).balanceOf(
                address(this)
            );

            // Transfer from assets to the swapper contract
            IERC20(_fromAsset).safeTransfer(config.swapper, _fromAssetAmount);

            // Call to the Swapper contract to do the actual swap
            // The -1 is required for stETH which sometimes transfers 1 wei less than what was specified.
            // slither-disable-next-line unused-return
            ISwapper(config.swapper).swap(
                _fromAsset,
                _toAsset,
                _fromAssetAmount - 1,
                _minToAssetAmount,
                _data
            );

            // Compute the change in asset balance held by the Vault
            toAssetAmount =
                IERC20(_toAsset).balanceOf(address(this)) -
                toAssetBalBefore;
        }

        // Check the to assets returned is above slippage amount specified by the strategist
        require(
            toAssetAmount >= _minToAssetAmount,
            "Strategist slippage limit"
        );

        // Scope a new block to remove minOracleToAssetAmount from the scope of swapCollateral.
        // This avoids a stack too deep error.
        {
            // Check the slippage against the Oracle in case the strategist made a mistake or has become malicious.
            // to asset amount = from asset amount * from asset price / to asset price
            uint256 minOracleToAssetAmount = (_fromAssetAmount *
                (1e4 - fromAssetConfig.allowedOracleSlippageBps) *
                IOracle(priceProvider).price(_fromAsset)) /
                (IOracle(priceProvider).price(_toAsset) *
                    (1e4 + toAssetConfig.allowedOracleSlippageBps));

            // Scale both sides up to 18 decimals to compare
            require(
                toAssetAmount.scaleBy(18, toAssetConfig.decimals) >=
                    minOracleToAssetAmount.scaleBy(
                        18,
                        fromAssetConfig.decimals
                    ),
                "Oracle slippage limit exceeded"
            );
        }

        // Check the vault's total value hasn't gone below the OToken total supply
        // by more than the allowed percentage.
        require(
            IVault(address(this)).totalValue() >=
                (oUSD.totalSupply() * ((1e4 - config.allowedUndervalueBps))) /
                    1e4,
            "Allowed value < supply"
        );

        emit Swapped(_fromAsset, _toAsset, _fromAssetAmount, toAssetAmount);
    }

    /***************************************
                    Swap Config
    ****************************************/

    /**
     * @notice Set the contract the performs swaps of collateral assets.
     * @param _swapperAddr Address of the Swapper contract that implements the ISwapper interface.
     */
    function setSwapper(address _swapperAddr) external onlyGovernor {
        swapConfig.swapper = _swapperAddr;
        emit SwapperChanged(_swapperAddr);
    }

    /// @notice Contract that swaps the vault's collateral assets
    function swapper() external view returns (address swapper_) {
        swapper_ = swapConfig.swapper;
    }

    /**
     * @notice Set max allowed percentage the vault total value can drop below the OToken total supply in basis points
     * when executing collateral swaps.
     * @param _basis Percentage in basis points. eg 100 == 1%
     */
    function setSwapAllowedUndervalue(uint16 _basis) external onlyGovernor {
        require(_basis < 10001, "Invalid basis points");
        swapConfig.allowedUndervalueBps = _basis;
        emit SwapAllowedUndervalueChanged(_basis);
    }

    /**
     * @notice Max allowed percentage the vault total value can drop below the OToken total supply in basis points
     * when executing a collateral swap.
     * For example 100 == 1%
     * @return value Percentage in basis points.
     */
    function allowedSwapUndervalue() external view returns (uint256 value) {
        value = swapConfig.allowedUndervalueBps;
    }

    /**
     * @notice Set the allowed slippage from the Oracle price for collateral asset swaps.
     * @param _asset Address of the asset token.
     * @param _allowedOracleSlippageBps allowed slippage from Oracle in basis points. eg 20 = 0.2%. Max 10%.
     */
    function setOracleSlippage(address _asset, uint16 _allowedOracleSlippageBps)
        external
        onlyGovernor
    {
        require(assets[_asset].isSupported, "Asset not supported");
        require(_allowedOracleSlippageBps < 1000, "Slippage too high");

        assets[_asset].allowedOracleSlippageBps = _allowedOracleSlippageBps;

        emit SwapSlippageChanged(_asset, _allowedOracleSlippageBps);
    }

    /***************************************
                Asset Config
    ****************************************/

    /**
     * @notice Add a supported asset to the contract, i.e. one that can be
     *         to mint OTokens.
     * @param _asset Address of asset
     */
    function supportAsset(address _asset, uint8 _unitConversion)
        external
        onlyGovernor
    {
        require(!assets[_asset].isSupported, "Asset already supported");

        assets[_asset] = Asset({
            isSupported: true,
            unitConversion: UnitConversion(_unitConversion),
            decimals: 0, // will be overridden in _cacheDecimals
            allowedOracleSlippageBps: 0 // 0% by default
        });

        _cacheDecimals(_asset);
        allAssets.push(_asset);

        // Verify that our oracle supports the asset
        // slither-disable-next-line unused-return
        IOracle(priceProvider).price(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @notice Cache decimals on OracleRouter for a particular asset. This action
     *      is required before that asset's price can be accessed.
     * @param _asset Address of asset token
     */
    function cacheDecimals(address _asset) external onlyGovernor {
        _cacheDecimals(_asset);
    }

    /***************************************
                Strategy Config
    ****************************************/

    /**
     * @notice Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     */
    function approveStrategy(address _addr) external onlyGovernor {
        require(!strategies[_addr].isSupported, "Strategy already approved");
        strategies[_addr] = Strategy({ isSupported: true, _deprecated: 0 });
        allStrategies.push(_addr);
        emit StrategyApproved(_addr);
    }

    /**
     * @notice Remove a strategy from the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not approved");

        uint256 assetCount = allAssets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            require(
                assetDefaultStrategies[allAssets[i]] != _addr,
                "Strategy is default for an asset"
            );
        }

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 stratCount = allStrategies.length;
        uint256 strategyIndex = stratCount;
        for (uint256 i = 0; i < stratCount; ++i) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < stratCount) {
            allStrategies[strategyIndex] = allStrategies[stratCount - 1];
            allStrategies.pop();

            // Mark the strategy as not supported
            strategies[_addr].isSupported = false;

            // Withdraw all assets
            IStrategy strategy = IStrategy(_addr);
            strategy.withdrawAll();

            emit StrategyRemoved(_addr);
        }
    }

    /***************************************
                Strategies
    ****************************************/

    /**
     * @notice Deposit multiple assets from the vault into the strategy.
     * @param _strategyToAddress Address of the Strategy to deposit assets into.
     * @param _assets Array of asset address that will be deposited into the strategy.
     * @param _amounts Array of amounts of each corresponding asset to deposit.
     */
    function depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist nonReentrant {
        _depositToStrategy(_strategyToAddress, _assets, _amounts);
    }

    function _depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal {
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            address assetAddr = _assets[i];
            require(
                IStrategy(_strategyToAddress).supportsAsset(assetAddr),
                "Asset unsupported"
            );
            // Send required amount of funds to the strategy
            IERC20(assetAddr).safeTransfer(_strategyToAddress, _amounts[i]);
        }

        // Deposit all the funds that have been sent to the strategy
        IStrategy(_strategyToAddress).depositAll();
    }

    /**
     * @notice Withdraw multiple assets from the strategy to the vault.
     * @param _strategyFromAddress Address of the Strategy to withdraw assets from.
     * @param _assets Array of asset address that will be withdrawn from the strategy.
     * @param _amounts Array of amounts of each corresponding asset to withdraw.
     */
    function withdrawFromStrategy(
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist nonReentrant {
        _withdrawFromStrategy(
            address(this),
            _strategyFromAddress,
            _assets,
            _amounts
        );
    }

    /**
     * @param _recipient can either be a strategy or the Vault
     */
    function _withdrawFromStrategy(
        address _recipient,
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal {
        require(
            strategies[_strategyFromAddress].isSupported,
            "Invalid from Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            // Withdraw from Strategy to the recipient
            IStrategy(_strategyFromAddress).withdraw(
                _recipient,
                _assets[i],
                _amounts[i]
            );
        }
    }

    /**
     * @notice Sets the maximum allowable difference between
     * total supply and backing assets' value.
     */
    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
        emit MaxSupplyDiffChanged(_maxSupplyDiff);
    }

    /**
     * @notice Sets the trusteeAddress that can receive a portion of yield.
     *      Setting to the zero address disables this feature.
     */
    function setTrusteeAddress(address _address) external onlyGovernor {
        trusteeAddress = _address;
        emit TrusteeAddressChanged(_address);
    }

    /**
     * @notice Sets the TrusteeFeeBps to the percentage of yield that should be
     *      received in basis points.
     */
    function setTrusteeFeeBps(uint256 _basis) external onlyGovernor {
        require(_basis <= 5000, "basis cannot exceed 50%");
        trusteeFeeBps = _basis;
        emit TrusteeFeeBpsChanged(_basis);
    }

    /**
     * @notice Set OToken Metapool strategy
     * @param _ousdMetaStrategy Address of OToken metapool strategy
     */
    function setOusdMetaStrategy(address _ousdMetaStrategy)
        external
        onlyGovernor
    {
        ousdMetaStrategy = _ousdMetaStrategy;
        emit OusdMetaStrategyUpdated(_ousdMetaStrategy);
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @notice Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = true;
        emit RebasePaused();
    }

    /**
     * @notice Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = false;
        emit RebaseUnpaused();
    }

    /**
     * @notice Set the deposit paused flag to true to prevent capital movement.
     */
    function pauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = true;
        emit CapitalPaused();
    }

    /**
     * @notice Set the deposit paused flag to false to enable capital movement.
     */
    function unpauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = false;
        emit CapitalUnpaused();
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        require(!assets[_asset].isSupported, "Only unsupported assets");
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /***************************************
             Strategies Admin
    ****************************************/

    /**
     * @notice Withdraws all assets from the strategy and sends assets to the Vault.
     * @param _strategyAddr Strategy address.
     */
    function withdrawAllFromStrategy(address _strategyAddr)
        external
        onlyGovernorOrStrategist
    {
        require(
            strategies[_strategyAddr].isSupported,
            "Strategy is not supported"
        );
        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.withdrawAll();
    }

    /**
     * @notice Withdraws all assets from all the strategies and sends assets to the Vault.
     */
    function withdrawAllFromStrategies() external onlyGovernorOrStrategist {
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            IStrategy(allStrategies[i]).withdrawAll();
        }
    }

    /***************************************
                    Utils
    ****************************************/

    function _cacheDecimals(address token) internal {
        Asset storage tokenAsset = assets[token];
        if (tokenAsset.decimals != 0) {
            return;
        }
        uint8 decimals = IBasicToken(token).decimals();
        require(decimals >= 6 && decimals <= 18, "Unexpected precision");
        tokenAsset.decimals = decimals;
    }
}
