pragma solidity 0.5.11;

/**
 * @title OUSD Vault Admin Contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Origin Protocol Inc
 */

import "./VaultStorage.sol";
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";

contract VaultAdmin is VaultStorage {
    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Set address of price provider.
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
    }

    /**
     * @dev Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        redeemFeeBps = _redeemFeeBps;
    }

    /**
     * @dev Set a buffer of assets to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding assets from a Strategy.
     * @param _vaultBuffer Percentage using 18 decimals. 100% = 1e18.
     */
    function setVaultBuffer(uint256 _vaultBuffer) external onlyGovernor {
        vaultBuffer = _vaultBuffer;
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
    }

    /**
     * @dev Set a minimum amount of OUSD in a mint or redeem that triggers a
     * rebase
     * @param _threshold OUSD amount with 18 fixed decimals.
     */
    function setRebaseThreshold(uint256 _threshold) external onlyGovernor {
        rebaseThreshold = _threshold;
    }

    /**
     * @dev Set address of RebaseHooks contract which provides hooks for rebase
     * so things like AMMs can be synced with updated balances.
     * @param _address Address of RebaseHooks contract
     */
    function setRebaseHooksAddr(address _address) external onlyGovernor {
        rebaseHooksAddr = _address;
    }

    /**
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        uniswapAddr = _address;
    }

    /** @dev Add a supported asset to the contract, i.e. one that can be
     *         to mint OUSD.
     * @param _asset Address of asset
     */
    function supportAsset(address _asset) external onlyGovernor {
        require(!assets[_asset].isSupported, "Asset already supported");

        assets[_asset] = Asset({ isSupported: true });
        allAssets.push(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @dev Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     * @param _targetWeight Target percentage of asset allocation to strategy
     */
    function addStrategy(address _addr, uint256 _targetWeight)
        external
        onlyGovernor
    {
        require(!strategies[_addr].isSupported, "Strategy already added");

        strategies[_addr] = Strategy({
            isSupported: true,
            targetWeight: _targetWeight
        });
        allStrategies.push(_addr);

        emit StrategyAdded(_addr);
    }

    /**
     * @dev Remove a strategy from the Vault. Removes all invested assets and
     * returns them to the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not added");

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 strategyIndex = allStrategies.length;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        assert(strategyIndex < allStrategies.length);

        allStrategies[strategyIndex] = allStrategies[allStrategies.length - 1];
        allStrategies.length--;

        // Liquidate all assets
        IStrategy strategy = IStrategy(_addr);
        strategy.liquidate();

        emit StrategyRemoved(_addr);
    }

    /**
     * @notice Set the weights for multiple strategies.
     * @param _strategyAddresses Array of strategy addresses
     * @param _weights Array of corresponding weights, with 18 decimals.
     *                 For ex. 100%=1e18, 30%=3e17.
     */
    function setStrategyWeights(
        address[] calldata _strategyAddresses,
        uint256[] calldata _weights
    ) external onlyGovernor {
        require(
            _strategyAddresses.length == _weights.length,
            "Parameter length mismatch"
        );

        for (uint256 i = 0; i < _strategyAddresses.length; i++) {
            strategies[_strategyAddresses[i]].targetWeight = _weights[i];
        }

        emit StrategyWeightsUpdated(_strategyAddresses, _weights);
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @dev Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernor {
        rebasePaused = true;
    }

    /**
     * @dev Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernor {
        rebasePaused = false;
    }

    /**
     * @dev Set the deposit paused flag to true to prevent deposits.
     */
    function pauseDeposits() external onlyGovernor {
        depositPaused = true;

        emit DepositsPaused();
    }

    /**
     * @dev Set the deposit paused flag to false to enable deposits.
     */
    function unpauseDeposits() external onlyGovernor {
        depositPaused = false;

        emit DepositsUnpaused();
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
        IERC20(_asset).transfer(governor(), _amount);
    }

    /**
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvest() external onlyGovernor {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            _harvest(allStrategies[i]);
        }
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvest(address _strategyAddr) external onlyGovernor {
        _harvest(_strategyAddr);
    }

    /**
     * @dev Collect reward tokens from a single strategy and swap them for a
     *      supported stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function _harvest(address _strategyAddr) internal {
        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.collectRewardToken();

        if (uniswapAddr != address(0)) {
            IERC20 rewardToken = IERC20(strategy.rewardTokenAddress());
            uint256 rewardTokenAmount = rewardToken.balanceOf(address(this));
            if (rewardTokenAmount > 0) {
                // Give Uniswap full amount allowance
                rewardToken.safeApprove(uniswapAddr, 0);
                rewardToken.safeApprove(uniswapAddr, rewardTokenAmount);

                // Uniswap redemption path
                address[] memory path = new address[](3);
                path[0] = strategy.rewardTokenAddress();
                path[1] = IUniswapV2Router(uniswapAddr).WETH();
                path[2] = allAssets[1]; // USDT

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

    /***************************************
                    Pricing
    ****************************************/

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Using Min since min is what we use for mint pricing
     * @param symbol String symbol of the asset
     * @return uint256 USD price of 1 of the asset
     */
    function priceUSDMint(string calldata symbol) external returns (uint256) {
        return _priceUSDMint(symbol);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Using Min since min is what we use for mint pricing
     * @param symbol String symbol of the asset
     * @return uint256 USD price of 1 of the asset
     */
    function _priceUSDMint(string memory symbol) internal returns (uint256) {
        // Price from Oracle is returned with 8 decimals
        // scale to 18 so 18-8=10
        return IMinMaxOracle(priceProvider).priceMin(symbol).scaleBy(10);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Using Max since max is what we use for redeem pricing
     * @param symbol String symbol of the asset
     * @return uint256 USD price of 1 of the asset
     */
    function priceUSDRedeem(string calldata symbol) external returns (uint256) {
        // Price from Oracle is returned with 8 decimals
        // scale to 18 so 18-8=10
        return _priceUSDRedeem(symbol);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Using Max since max is what we use for redeem pricing
     * @param symbol String symbol of the asset
     * @return uint256 USD price of 1 of the asset
     */
    function _priceUSDRedeem(string memory symbol) internal returns (uint256) {
        // Price from Oracle is returned with 8 decimals
        // scale to 18 so 18-8=10
        return IMinMaxOracle(priceProvider).priceMax(symbol).scaleBy(10);
    }
}
