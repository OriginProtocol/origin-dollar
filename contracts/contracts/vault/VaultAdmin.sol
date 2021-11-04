// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title OUSD Vault Admin Contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
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
        for (uint256 i = 0; i < swapTokens.length; i++) {
            // Revoke swap token approvals for old address
            IERC20(swapTokens[i]).safeApprove(uniswapAddr, 0);
        }
        uniswapAddr = _address;
        for (uint256 i = 0; i < swapTokens.length; i++) {
            // Add swap token approvals for new address
            IERC20(swapTokens[i]).safeApprove(uniswapAddr, type(uint256).max);
        }
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

        for (uint256 i = 0; i < allAssets.length; i++) {
            require(
                assetDefaultStrategies[allAssets[i]] != _addr,
                "Strategy is default for an asset"
            );
        }

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
            allStrategies[strategyIndex] = allStrategies[
                allStrategies.length - 1
            ];
            allStrategies.pop();

            // Mark the strategy as not supported
            strategies[_addr].isSupported = false;

            // Withdraw all assets
            IStrategy strategy = IStrategy(_addr);
            strategy.withdrawAll();

            // Call harvest after withdraw in case withdraw triggers
            // distribution of additional reward tokens (true for Compound)
            _harvest(_addr);
            emit StrategyRemoved(_addr);
        }
    }

    /**
     * @dev Add a swap token to the tokens that get liquidated for stablecoins
     *      whenever swap is called. The token must have a valid feed registered
     *      with the price provider.
     * @param _addr Address of the token
     */
    function addSwapToken(address _addr) external onlyGovernor {
        for (uint256 i = 0; i < swapTokens.length; i++) {
            if (swapTokens[i] == _addr) {
                revert("Swap token already added");
            }
        }

        // Revert if feed does not exist
        IOracle(priceProvider).price(_addr);

        swapTokens.push(_addr);

        // Give Uniswap infinte approval
        if (uniswapAddr != address(0)) {
            IERC20 token = IERC20(_addr);
            token.safeApprove(uniswapAddr, 0);
            token.safeApprove(uniswapAddr, type(uint256).max);
        }

        emit SwapTokenAdded(_addr);
    }

    /**
     * @dev Remove a swap token from the tokens that get liquidated for stablecoins.
     * @param _addr Address of the token
     */
    function removeSwapToken(address _addr) external onlyGovernor {
        uint256 swapTokenIndex = swapTokens.length;
        for (uint256 i = 0; i < swapTokens.length; i++) {
            if (swapTokens[i] == _addr) {
                swapTokenIndex = i;
                break;
            }
        }

        require(swapTokenIndex != swapTokens.length, "Swap token not added");

        // Shift everything after the index element by 1
        for (uint256 i = swapTokenIndex; i < swapTokens.length - 1; i++) {
            swapTokens[i] = swapTokens[i + 1];
        }
        swapTokens.pop();

        if (uniswapAddr != address(0)) {
            IERC20 token = IERC20(_addr);
            // Remove Uniswap approval
            token.safeApprove(uniswapAddr, 0);
        }

        emit SwapTokenRemoved(_addr);
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
     * @dev Collect reward tokens from all strategies
     */
    function harvest() public onlyGovernorOrStrategist {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            _harvest(allStrategies[i]);
        }
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap.
     */
    function swap() external onlyVaultOrGovernorOrStrategist {
        _swap();
    }

    /*
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvestAndSwap() external onlyGovernorOrStrategist {
        harvest();
        _swap();
    }

    /**
     * @dev Collect reward tokens for a specific strategy. Called from the vault.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvest(address _strategyAddr)
        external
        onlyVaultOrGovernorOrStrategist
    {
        _harvest(_strategyAddr);
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap. Called from the vault.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvestAndSwap(address _strategyAddr)
        external
        onlyVaultOrGovernorOrStrategist
        returns (uint256[] memory)
    {
        IStrategy strategy = IStrategy(_strategyAddr);
        _harvest(address(strategy));
        return _swap(strategy.rewardTokenAddress());
    }

    /**
     * @dev Collect reward tokens from a single strategy and swap them for a
     *      supported stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from.
     */
    function _harvest(address _strategyAddr) internal {
        IStrategy strategy = IStrategy(_strategyAddr);
        address rewardTokenAddress = strategy.rewardTokenAddress();
        if (rewardTokenAddress != address(0)) {
            strategy.collectRewardToken();
        }
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap.
     */
    function _swap() internal {
        for (uint256 i = 0; i < swapTokens.length; i++) {
            _swap(swapTokens[i]);
        }
    }

    /**
     * @dev Swap a record token for stablecoins for Uniswap. The token must have
     *       a registered price feed with the price provider.
     * @param _swapToken Address of the token to swap.
     */
    function _swap(address _swapToken)
        internal
        returns (uint256[] memory swapResult)
    {
        if (uniswapAddr != address(0)) {
            IERC20 swapToken = IERC20(_swapToken);
            uint256 balance = swapToken.balanceOf(address(this));
            if (balance > 0) {
                // This'll revert if there is no price feed
                uint256 oraclePrice = IOracle(priceProvider).price(_swapToken);
                // Oracle price is 1e8, USDT output is 1e6
                uint256 minExpected = ((balance * oraclePrice * 97) / 100)
                    .scaleBy(6, Helpers.getDecimals(_swapToken) + 8);

                // Uniswap redemption path
                address[] memory path = new address[](3);
                path[0] = _swapToken;
                path[1] = IUniswapV2Router(uniswapAddr).WETH();
                path[2] = allAssets[1]; // USDT

                swapResult = IUniswapV2Router(uniswapAddr)
                    .swapExactTokensForTokens(
                        balance,
                        minExpected,
                        path,
                        address(this),
                        block.timestamp
                    );
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
        // Price from Oracle is returned with 8 decimals so scale to 18
        return price.scaleBy(18, 8);
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
        // Price from Oracle is returned with 8 decimals so scale to 18
        return price.scaleBy(18, 8);
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
