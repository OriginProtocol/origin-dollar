pragma solidity 0.5.11;

/**
 * @title OUSD Vault Admin Contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Origin Protocol Inc
 */

import "./VaultStorage.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";

contract VaultAdmin is VaultStorage {
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
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        uniswapAddr = _address;
        emit UniswapUpdated(_address);
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
        require(strategies[_strategy].isSupported, "Strategy not approved");
        IStrategy strategy = IStrategy(_strategy);
        require(assets[_asset].isSupported, "Asset is not supported");
        require(
            strategy.supportsAsset(_asset),
            "Asset not supported by Strategy"
        );
        assetDefaultStrategies[_asset] = _strategy;
    }

    /**
     * @dev Add a supported asset to the contract, i.e. one that can be
     *         to mint OUSD.
     * @param _asset Address of asset
     */
    function supportAsset(address _asset) external onlyGovernor {
        require(!assets[_asset].isSupported, "Asset already supported");

        assets[_asset] = Asset({ isSupported: true });
        allAssets.push(_asset);

        // Verify that our oracle supports the asset
        // slither-disable-next-line unused-return
        IOracle(priceProvider).price(_asset);

        emit AssetSupported(_asset);
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
     * @dev Remove a strategy from the Vault. Removes all invested assets and
     * returns them to the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not approved");

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 strategyIndex = allStrategies.length;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < allStrategies.length) {
            allStrategies[strategyIndex] = allStrategies[allStrategies.length -
                1];
            allStrategies.pop();

            // Withdraw all assets
            IStrategy strategy = IStrategy(_addr);
            strategy.withdrawAll();
            // Call harvest after withdraw in case withdraw triggers
            // distribution of additional reward tokens (true for Compound)
            _harvest(_addr);
            emit StrategyRemoved(_addr);
        }

        // Clean up struct in mapping, this can be removed later
        // See https://github.com/OriginProtocol/origin-dollar/issues/324
        strategies[_addr].isSupported = false;
    }

    /**
     * @notice Move assets from one Strategy to another
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
            strategies[_strategyFromAddress].isSupported,
            "Invalid from Strategy"
        );
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        IStrategy strategyFrom = IStrategy(_strategyFromAddress);
        IStrategy strategyTo = IStrategy(_strategyToAddress);

        for (uint256 i = 0; i < _assets.length; i++) {
            require(strategyTo.supportsAsset(_assets[i]), "Asset unsupported");
            // Withdraw from Strategy and pass other Strategy as recipient
            strategyFrom.withdraw(address(strategyTo), _assets[i], _amounts[i]);
        }
        // Tell new Strategy to deposit into protocol
        strategyTo.depositAll();
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
                    Rewards
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

    /**
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvest() external onlyGovernorOrStrategist {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            _harvest(allStrategies[i]);
        }
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap. Called from the vault.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvest(address _strategyAddr)
        external
        onlyVaultOrGovernorOrStrategist
        returns (uint256[] memory)
    {
        return _harvest(_strategyAddr);
    }

    /**
     * @dev Collect reward tokens from a single strategy and swap them for a
     *      supported stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function _harvest(address _strategyAddr)
        internal
        returns (uint256[] memory)
    {
        IStrategy strategy = IStrategy(_strategyAddr);
        address rewardTokenAddress = strategy.rewardTokenAddress();
        if (rewardTokenAddress != address(0)) {
            strategy.collectRewardToken();

            if (uniswapAddr != address(0)) {
                IERC20 rewardToken = IERC20(strategy.rewardTokenAddress());
                uint256 rewardTokenAmount = rewardToken.balanceOf(
                    address(this)
                );
                if (rewardTokenAmount > 0) {
                    // Give Uniswap full amount allowance
                    rewardToken.safeApprove(uniswapAddr, 0);
                    rewardToken.safeApprove(uniswapAddr, rewardTokenAmount);

                    // Uniswap redemption path
                    address[] memory path = new address[](3);
                    path[0] = strategy.rewardTokenAddress();
                    path[1] = IUniswapV2Router(uniswapAddr).WETH();
                    path[2] = allAssets[1]; // USDT

                    return
                        IUniswapV2Router(uniswapAddr).swapExactTokensForTokens(
                            rewardTokenAmount,
                            uint256(0),
                            path,
                            address(this),
                            now.add(1800)
                        );
                }
            }
        }
    }

    /***************************************
                    Pricing
    ****************************************/

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Never goes above 1, since that is how we price mints
     * @param asset address of the asset
     * @return uint256 USD price of 1 of the asset, in 18 decimal fixed
     */
    function priceUSDMint(address asset) external view returns (uint256) {
        uint256 price = IOracle(priceProvider).price(asset);
        if (price > 1e8) {
            price = 1e8;
        }
        // Price from Oracle is returned with 8 decimals
        // scale to 18 so 18-8=10
        return price.scaleBy(10);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Never goes below 1, since that is how we price redeems
     * @param asset Address of the asset
     * @return uint256 USD price of 1 of the asset, in 18 decimal fixed
     */
    function priceUSDRedeem(address asset) external view returns (uint256) {
        uint256 price = IOracle(priceProvider).price(asset);
        if (price < 1e8) {
            price = 1e8;
        }
        // Price from Oracle is returned with 8 decimals
        // scale to 18 so 18-8=10
        return price.scaleBy(10);
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
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            strategy.withdrawAll();
        }
    }
}
