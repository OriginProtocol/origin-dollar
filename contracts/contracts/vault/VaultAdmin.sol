// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD Vault Admin Contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import "./VaultStorage.sol";

contract VaultAdmin is VaultStorage {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @dev Verifies that the caller is the Vault, Governor, or Strategist.
     */
    modifier onlyVaultOrGovernorOrStrategist() {
        require(
            msg.sender == address(this) ||
                msg.sender == strategistAddr ||
                isGovernor(),
            "Caller is not the Vault, Governor, or Strategist"
        );
        _;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Set address of price provider.
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
        emit PriceProviderUpdated(_priceProvider);
    }

    /**
     * @dev Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        require(_redeemFeeBps <= 1000, "Redeem fee should not be over 10%");
        redeemFeeBps = _redeemFeeBps;
        emit RedeemFeeUpdated(_redeemFeeBps);
    }

    /**
     * @dev Set a buffer of assets to keep in the Vault to handle most
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
     * @dev Sets the minimum amount of OUSD in a mint to trigger an
     * automatic allocation of funds afterwords.
     * @param _threshold OUSD amount with 18 fixed decimals.
     */
    function setAutoAllocateThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        autoAllocateThreshold = _threshold;
        emit AllocateThresholdUpdated(_threshold);
    }

    /**
     * @dev Set a minimum amount of OUSD in a mint or redeem that triggers a
     * rebase
     * @param _threshold OUSD amount with 18 fixed decimals.
     */
    function setRebaseThreshold(uint256 _threshold) external onlyGovernor {
        rebaseThreshold = _threshold;
        emit RebaseThresholdUpdated(_threshold);
    }

    /**
     * @dev Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }

    /**
     * @dev Set the default Strategy for an asset, i.e. the one which the asset
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
     * @dev Set maximum amount of OUSD that can at any point be minted and deployed
     * to strategy (used only by ConvexOUSDMetaStrategy for now).
     * @param _threshold OUSD amount with 18 fixed decimals.
     */
    function setNetOusdMintForStrategyThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        /**
         * Because `netOusdMintedForStrategy` check in vault core works both ways
         * (positive and negative) the actual impact of the amount of OUSD minted
         * could be double the threshold. E.g.:
         *  - contract has threshold set to 100
         *  - state of netOusdMinted is -90
         *  - in effect it can mint 190 OUSD and still be within limits
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

    /**
     * @dev Set the contract the performs swaps of collateral assets.
     * @param _swapperAddr Address of the Swapper contract that implements the ISwapper interface.
     */
    function setSwapper(address _swapperAddr) external onlyGovernor {
        swapper = _swapperAddr;
        emit SwapperChanged(_swapperAddr);
    }

    /**
     * @dev Set the allowed slippage for collateral asset swaps.
     * @param _asset Address of the asset token.
     * @param _allowedSwapSlippageBps allowed slippage in basis points. eg 20 = 0.2%. Max 10%.
     */
    function setSwapSlippage(address _asset, uint16 _allowedSwapSlippageBps)
        external
        onlyGovernor
    {
        require(assets[_asset].isSupported, "Asset not supported");
        require(_allowedSwapSlippageBps < 1000, "Slippage too high");

        assets[_asset].allowedSwapSlippageBps = _allowedSwapSlippageBps;

        emit SwapSlippageChanged(_asset, _allowedSwapSlippageBps);
    }

    /**
     * @dev Add a supported asset to the vault, i.e. one that can mint.
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
            allowedSwapSlippageBps: 0 // 0% by default
        });

        _cacheDecimals(_asset);
        allAssets.push(_asset);

        // Verify that our oracle supports the asset
        // slither-disable-next-line unused-return
        IOracle(priceProvider).price(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @dev Cache decimals on OracleRouter for a particular asset. This action
     *      is required before that asset's price can be accessed.
     * @param _asset Address of asset token
     */
    function cacheDecimals(address _asset) external onlyGovernor {
        _cacheDecimals(_asset);
    }

    /**
     * @dev Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     */
    function approveStrategy(address _addr) external onlyGovernor {
        require(!strategies[_addr].isSupported, "Strategy already approved");
        strategies[_addr] = Strategy({ isSupported: true, _deprecated: 0 });
        allStrategies.push(_addr);
        emit StrategyApproved(_addr);
    }

    /**
     * @dev Remove a strategy from the Vault.
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

    /**
     * @dev Move assets from one Strategy to another
     * @param _strategyFromAddress Address of Strategy to move assets from.
     * @param _strategyToAddress Address of Strategy to move assets to.
     * @param _assets Array of asset address that will be moved
     * @param _amounts Array of amounts of each corresponding asset to move.
     */
    function reallocate(
        address _strategyFromAddress,
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist {
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");
        _withdrawFromStrategy(
            _strategyToAddress,
            _strategyFromAddress,
            _assets,
            _amounts
        );

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            require(
                IStrategy(_strategyToAddress).supportsAsset(_assets[i]),
                "Asset unsupported"
            );
        }
        // Tell new Strategy to deposit into protocol
        IStrategy(_strategyToAddress).depositAll();
    }

    /**
     * @dev Deposit multiple assets from the vault into the strategy.
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
     * @dev Withdraw multiple assets from the strategy to the vault.
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
     * @dev Sets the maximum allowable difference between
     * total supply and backing assets' value.
     */
    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
        emit MaxSupplyDiffChanged(_maxSupplyDiff);
    }

    /**
     * @dev Sets the trusteeAddress that can receive a portion of yield.
     *      Setting to the zero address disables this feature.
     */
    function setTrusteeAddress(address _address) external onlyGovernor {
        trusteeAddress = _address;
        emit TrusteeAddressChanged(_address);
    }

    /**
     * @dev Sets the TrusteeFeeBps to the percentage of yield that should be
     *      received in basis points.
     */
    function setTrusteeFeeBps(uint256 _basis) external onlyGovernor {
        require(_basis <= 5000, "basis cannot exceed 50%");
        trusteeFeeBps = _basis;
        emit TrusteeFeeBpsChanged(_basis);
    }

    /**
     * @dev Set OUSD Meta strategy
     * @param _ousdMetaStrategy Address of ousd meta strategy
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
     * @dev Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = true;
        emit RebasePaused();
    }

    /**
     * @dev Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernor {
        rebasePaused = false;
        emit RebaseUnpaused();
    }

    /**
     * @dev Set the deposit paused flag to true to prevent capital movement.
     */
    function pauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = true;
        emit CapitalPaused();
    }

    /**
     * @dev Set the deposit paused flag to false to enable capital movement.
     */
    function unpauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = false;
        emit CapitalUnpaused();
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Transfer token to governor. Intended for recovering tokens stuck in
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
     * @dev Withdraws all assets from the strategy and sends assets to the Vault.
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
     * @dev Withdraws all assets from all the strategies and sends assets to the Vault.
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
