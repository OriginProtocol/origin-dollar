// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import "../utils/Helpers.sol";

contract Harvester is Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    event UniswapUpdated(address _address);
    event RewardTokenConfigUpdated(
        address _tokenAddress,
        uint16 _allowedSlippageBps,
        uint16 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit,
        bool _doSwapRewardToken
    );

    // Configuration properties for harvesting logic of reward tokens
    struct RewardTokenConfig {
        // Max allowed slippage when swapping reward token for a stablecoin denominated in basis points.
        uint16 allowedSlippageBps;
        // Reward when calling a harvest function denominated in basis points.
        uint16 harvestRewardBps;
        /* Address of Uniswap V2 compatible exchange (Uniswap V2, SushiSwap).
         */
        address uniswapV2CompatibleAddr;
        /* When true the reward token is being swapped. In a need of (temporarily) disabling the swapping of
         * a reward token this needs to be set to false.
         */
        bool doSwapRewardToken;
        /* How much token can be sold per one harvest call. If the balance of rewards tokens
         * exceeds that limit multiple harvest calls are required to harvest all of the tokens.
         * When 0 there is no liquidationLimit;
         */
        uint256 liquidationLimit;
    }

    mapping(address => RewardTokenConfig) public rewardTokenConfigs;

    address public immutable vaultAddress;
    address public immutable usdtAddress;

    /**
     * @dev Constructor to set up initial internal state
     * @param _vaultAddress Address of the Vault
     * @param _usdtAddress Address of Tether
     */
    constructor(address _vaultAddress, address _usdtAddress) {
        require(address(_vaultAddress) != address(0));
        require(address(_usdtAddress) != address(0));
        vaultAddress = _vaultAddress;
        usdtAddress = _usdtAddress;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Add/update a reward token configuration that holds harvesting config variables
     * @param _tokenAddress Address of the reward token
     * @param _allowedSlippageBps uint16 maximum allowed slippage denominated in basis points.
     *        Example: 300 == 3% slippage
     * @param _harvestRewardBps uint16 amount of reward tokens the caller of the function is rewarded.
     *        Example: 100 == 1%
     * @param _uniswapV2CompatibleAddr Address Address of a UniswapV2 compatible contract to perform
     *        the exchange from reward tokens to stablecoin (currently hard-coded to USDT)
     * @param _liquidationLimit uint256 Maximum amount of token to be sold per one swap function call.
     *        When value is 0 there is no limit.
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        uint16 _allowedSlippageBps,
        uint16 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit,
        bool _doSwapRewardToken
    ) external onlyGovernor {
        require(
            _allowedSlippageBps <= 1000,
            "Allowed slippage should not be over 10%"
        );
        require(
            _harvestRewardBps <= 1000,
            "Harvest reward fee should not be over 10%"
        );
        require(
            _uniswapV2CompatibleAddr != address(0),
            "Uniswap compatible address should be non zero address"
        );

        RewardTokenConfig memory tokenConfig = RewardTokenConfig({
            harvestRewardBps: _harvestRewardBps,
            allowedSlippageBps: _allowedSlippageBps,
            uniswapV2CompatibleAddr: _uniswapV2CompatibleAddr,
            liquidationLimit: _liquidationLimit,
            doSwapRewardToken: _doSwapRewardToken
        });

        address oldUniswapAddress = rewardTokenConfigs[_tokenAddress]
            .uniswapV2CompatibleAddr;
        rewardTokenConfigs[_tokenAddress] = tokenConfig;

        IERC20 token = IERC20(_tokenAddress);

        // if changing token swap provider cancel existing allowance
        if (
            /* oldUniswapAddress == address(0) when there is no pre-existing 
             * configuration for said rewards token
             */
            oldUniswapAddress != address(0) &&
            oldUniswapAddress != _uniswapV2CompatibleAddr
        ) {
            token.safeApprove(oldUniswapAddress, 0);
        }

        // Give Uniswap infinite approval when needed
        if (
            oldUniswapAddress != _uniswapV2CompatibleAddr
        ) {
            token.safeApprove(_uniswapV2CompatibleAddr, 0);
            token.safeApprove(_uniswapV2CompatibleAddr, type(uint256).max);
        }

        emit RewardTokenConfigUpdated(
            _tokenAddress,
            _allowedSlippageBps,
            _harvestRewardBps,
            _uniswapV2CompatibleAddr,
            _liquidationLimit,
            _doSwapRewardToken
        );
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
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /**
     * @dev Collect reward tokens from all strategies
     */
    function harvest() external onlyGovernor nonReentrant {
        _harvest();
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap.
     */
    function swap() external onlyGovernor nonReentrant {
        _swap(vaultAddress);
    }

    /*
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvestAndSwap() external onlyGovernor nonReentrant {
        _harvest();
        _swap(vaultAddress);
    }

    /**
     * @dev Collect reward tokens from all strategies
     */
    function _harvest() internal {
        address[] memory allStrategies = IVault(vaultAddress)
            .getAllStrategies();
        for (uint256 i = 0; i < allStrategies.length; i++) {
            _harvest(allStrategies[i]);
        }
    }

    /**
     * @dev Collect reward tokens for a specific strategy. Called from the vault.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvest(address _strategyAddr) external onlyGovernor nonReentrant {
        _harvest(_strategyAddr);
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap. Can be called by anyone. Rewards incentivizing 
     *      the caller are sent to the caller of this function.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvestAndSwap(address _strategyAddr) external nonReentrant {
        _harvestAndSwap(_strategyAddr, msg.sender);
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap. Can be called by anyone.
     * @param _strategyAddr Address of the strategy to collect rewards from
     * @param _rewardTo Address where to send a share of harvest rewards to as an incentive
     *      for executing this function
     */
    function harvestAndSwap(address _strategyAddr, address _rewardTo) external nonReentrant {
        _harvestAndSwap(_strategyAddr, _rewardTo);
    }

    /**
     * @dev Governance convenience function to swap a specific _rewardToken and send
     *       rewards to the vault.
     * @param _swapToken Address of the token to swap.
     */
    function swapRewardToken(address _swapToken) external onlyGovernor nonReentrant {
        _swap(_swapToken, vaultAddress);
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap.
     * @param _strategyAddr Address of the strategy to collect rewards from
     * @param _rewardTo Address where to send a share of harvest rewards to as an incentive
     *      for executing this function
     */
    function _harvestAndSwap(address _strategyAddr, address _rewardTo) internal {
        IStrategy strategy = IStrategy(_strategyAddr);
        _harvest(address(strategy));
        address[] memory rewardTokens = strategy.getRewardTokenAddresses();
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _swap(rewardTokens[i], _rewardTo);
        }   
    }

    /**
     * @dev Collect reward tokens from a single strategy and swap them for a
     *      supported stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from.
     */
    function _harvest(address _strategyAddr) internal {
        bool validStrategy = false;
        address[] memory allStrategies = IVault(vaultAddress)
            .getAllStrategies();

        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _strategyAddr) {
                validStrategy = true;
            }
        }

        require(validStrategy, "Not a valid strategy address");

        IStrategy strategy = IStrategy(_strategyAddr);
        address[] memory rewardTokenAddresses = strategy
            .getRewardTokenAddresses();

        strategy.collectRewardTokens();
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap. And send the incentive part
     * of the rewards to _rewardTo address. 
     * @param _rewardTo Address where to send a share of harvest rewards to as an incentive
     *      for executing this function
     */
    function _swap(address _rewardTo) internal {
        address[] memory allStrategies = IVault(vaultAddress)
            .getAllStrategies();

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            address[] memory rewardTokenAddresses = strategy
                .getRewardTokenAddresses();

            for (uint256 j = 0; j < rewardTokenAddresses.length; j++) {
                _swap(rewardTokenAddresses[j], _rewardTo);
            }
        }
    }

    /**
     * @dev Swap a reward token for stablecoins on Uniswap. The token must have
     *       a registered price feed with the price provider.
     * @param _swapToken Address of the token to swap.
     * @param _rewardTo Address where to send the share of harvest rewards to
     */
    function _swap(address _swapToken, address _rewardTo) internal {
        RewardTokenConfig memory tokenConfig = rewardTokenConfigs[_swapToken];

        /* This will trigger a return when reward token configuration has not yet been set
         * or we have temporarily disabled swapping of specific reward token via setting
         * doSwapRewardToken to false. 
         */
        if (!tokenConfig.doSwapRewardToken) {
            return;
        }
        
        address priceProvider = IVault(vaultAddress).priceProvider();

        IERC20 swapToken = IERC20(_swapToken);
        uint256 balance = swapToken.balanceOf(address(this));

        if (balance == 0) {
            return;
        }

        uint256 balanceToSwap = balance;
        if (tokenConfig.liquidationLimit != 0) {
            balanceToSwap = Math.min(balance, tokenConfig.liquidationLimit);
        }

        // This'll revert if there is no price feed
        uint256 oraclePrice = IOracle(priceProvider).price(_swapToken);
        // Oracle price is 1e8, USDT output is 1e6
        uint256 minExpected = (balanceToSwap *
            oraclePrice *
            (1e4 - tokenConfig.allowedSlippageBps)).scaleBy( // max allowed slippage
            6,
            Helpers.getDecimals(_swapToken) + 8
        ) / 1e4; // fix the max slippage decimal position

        // Uniswap redemption path
        address[] memory path = new address[](3);
        path[0] = _swapToken;
        path[1] = IUniswapV2Router(tokenConfig.uniswapV2CompatibleAddr).WETH();
        path[2] = usdtAddress;

        // slither-disable-next-line unused-return
        IUniswapV2Router(tokenConfig.uniswapV2CompatibleAddr)
            .swapExactTokensForTokens(
                balanceToSwap,
                minExpected,
                path,
                address(this),
                block.timestamp
            );

        IERC20 usdt = IERC20(usdtAddress);
        uint256 usdtBalance = usdt.balanceOf(address(this));

        uint256 vaultBps = 1e4 - tokenConfig.harvestRewardBps;
        uint256 vaultShare = (usdtBalance * vaultBps) / 1e4;

        require(
            vaultBps > tokenConfig.harvestRewardBps,
            "Address calling harvest is receiving more rewards than the vault"
        );

        usdt.safeTransfer(vaultAddress, vaultShare);
        usdt.safeTransfer(
            _rewardTo,
            usdtBalance - vaultShare // remaining share of the rewards
        );
    }
}
