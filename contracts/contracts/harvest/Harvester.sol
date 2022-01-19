// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Initializable } from "../utils/Initializable.sol";
import { Governable } from "../governance/Governable.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import "../utils/Helpers.sol";

contract Harvester is Initializable, Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    event UniswapUpdated(address _address);
    event SwapTokenAdded(address _address);
    event SwapTokenRemoved(address _address);
    event RewardTokenConfigUpdated(
        address _tokenAddress,
        uint16 _allowedSlippageBps,
        uint16 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit
    );

    // Tokens that should be swapped for stablecoins
    address[] public swapTokens;

    // Strategies approved for use by the Vault
    struct RewardTokenConfig {
        // Max allowed slippage when swapping reward token for a stablecoin denominated in basis points.
        uint16 allowedSlippageBps;
        // Reward when calling a harvest function denominated in basis points.
        uint16 harvestRewardBps;
        /* Address of Uniswap V2 compatible exchange (Uniswap V2, SushiSwap).
         * When this is set to zero address swapping is disabled.
         */
        address uniswapV2CompatibleAddr;
        /* How much token can be sold per one harvest call. If the balance of rewards tokens
         * exceeds that limit multiple harvest calls are required to harvest all of the tokens.
         */
        uint256 liquidationLimit;
    }

    mapping(address => RewardTokenConfig) public rewardTokenConfigs;

    // Address of Vault
    address public vaultAddress = address(0);
    address public usdtAddress = address(0);

    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _vaultAddress Address of the Vault
     * @param _usdtAddress Address of Tether
     */
    function initialize(address _vaultAddress, address _usdtAddress)
        external
        onlyGovernor
        initializer
    {
        _initialize(_vaultAddress, _usdtAddress);
    }

    function _initialize(address _vaultAddress, address _usdtAddress) internal {
        vaultAddress = _vaultAddress;
        usdtAddress = _usdtAddress;
    }

    /***************************************
                 Configuration
    ****************************************/

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

        address priceProvider = IVault(vaultAddress).priceProvider();

        // Revert if feed does not exist
        IOracle(priceProvider).price(_addr);

        swapTokens.push(_addr);

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

        emit SwapTokenRemoved(_addr);
    }

    /**
     * @dev Add/update a reward token configuration that holds harvesting config variables
     * @param _tokenAddress Address of the reward token
     * @param _allowedSlippageBps uint16 maximum allowed slippage denominated in basis points. Example: 300 == 3% slippage
     * @param _harvestRewardBps uint16 amount of reward tokens the caller of the function is rewarded. Example: 100 == 1%
     * @param _uniswapV2CompatibleAddr Address Address of a UniswapV2 compatible contract to perform the exchange from reward
     *        tokens to stablecoin (currently hard-coded to USDT)
     * @param _liquidationLimit uint256 Maximum amount of token to be sold per one swap function call. When value is 0 there is no limit.
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        uint16 _allowedSlippageBps,
        uint16 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit
    ) external onlyGovernor {
        require(
            _harvestRewardBps <= 1000,
            "Harvest reward fee should not be over 10%"
        );
        require(
            _allowedSlippageBps <= 1000,
            "Allowed slippage should not be over 10%"
        );
        require(
            _uniswapV2CompatibleAddr != address(0),
            "Uniswap compatible address should be non zero address"
        );

        RewardTokenConfig memory tokenConfig = RewardTokenConfig({
            harvestRewardBps: _harvestRewardBps,
            allowedSlippageBps: _allowedSlippageBps,
            uniswapV2CompatibleAddr: _uniswapV2CompatibleAddr,
            liquidationLimit: _liquidationLimit
        });

        address oldUniswapAddress = rewardTokenConfigs[_tokenAddress]
            .uniswapV2CompatibleAddr;
        rewardTokenConfigs[_tokenAddress] = tokenConfig;

        IERC20 token = IERC20(_tokenAddress);

        // if changing token swap provider cancel existing allowance
        if (
            oldUniswapAddress != address(0) &&
            oldUniswapAddress != _uniswapV2CompatibleAddr
        ) {
            token.safeApprove(oldUniswapAddress, 0);
        }

        // Give Uniswap infinite approval when needed
        if (_uniswapV2CompatibleAddr != address(0)) {
            if (
                token.allowance(address(this), _uniswapV2CompatibleAddr) <
                type(uint256).max / 2
            ) {
                token.safeApprove(_uniswapV2CompatibleAddr, 0);
                token.safeApprove(_uniswapV2CompatibleAddr, type(uint256).max);
            }
        }

        emit RewardTokenConfigUpdated(
            _tokenAddress,
            _allowedSlippageBps,
            _harvestRewardBps,
            _uniswapV2CompatibleAddr,
            _liquidationLimit
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
        _swap();
    }

    /*
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvestAndSwap() external nonReentrant {
        // TODO: add protection so that harvestAndSwap isn't called twice too closely together
        _harvest();
        _swap();
        if (msg.sender != vaultAddress) {
            IVault(vaultAddress).rebase();
        }
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
        // TODO: add protection so that harvestAndSwap isn't called twice too closely together
        _harvest(_strategyAddr);
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap. Called from the vault.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvestAndSwap(address _strategyAddr) external nonReentrant {
        IStrategy strategy = IStrategy(_strategyAddr);
        _harvest(address(strategy));
        address[] memory rewardTokens = strategy.getRewardTokenAddresses();
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _swap(rewardTokens[i]);
        }
        if (msg.sender != vaultAddress) {
            IVault(vaultAddress).rebase();
        }
    }

    /**
     * @dev Collect reward tokens from a single strategy and swap them for a
     *      supported stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from.
     */
    function _harvest(address _strategyAddr) internal {
        IStrategy strategy = IStrategy(_strategyAddr);
        address[] memory rewardTokenAddresses = strategy
            .getRewardTokenAddresses();

        if (rewardTokenAddresses.length > 0) {
            strategy.collectRewardTokens();
        }
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap.
     */
    function _swap() internal {
        address[] memory allStrategies = IVault(vaultAddress)
            .getAllStrategies();

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
        RewardTokenConfig memory tokenConfig = rewardTokenConfigs[_swapToken];
        require(
            tokenConfig.uniswapV2CompatibleAddr != address(0),
            "Swap token is missing token configuration."
        );

        address priceProvider = IVault(vaultAddress).priceProvider();

        IERC20 swapToken = IERC20(_swapToken);
        uint256 balance = swapToken.balanceOf(address(this));
        if (balance > 0) {
            uint256 maxBalanceToSwap = balance;
            if (tokenConfig.liquidationLimit != 0) {
                maxBalanceToSwap = Math.min(
                    balance,
                    tokenConfig.liquidationLimit
                );
            }

            // This'll revert if there is no price feed
            uint256 oraclePrice = IOracle(priceProvider).price(_swapToken);
            // Oracle price is 1e8, USDT output is 1e6
            uint256 minExpected = (maxBalanceToSwap *
                oraclePrice *
                (1e4 - tokenConfig.allowedSlippageBps)).scaleBy( // max allowed slippage
                6,
                Helpers.getDecimals(_swapToken) + 8
            ) / 1e4; // fix the max slippage decimal position

            // Uniswap redemption path
            address[] memory path = new address[](3);
            path[0] = _swapToken;
            path[1] = IUniswapV2Router(tokenConfig.uniswapV2CompatibleAddr)
                .WETH();
            path[2] = usdtAddress;

            swapResult = IUniswapV2Router(tokenConfig.uniswapV2CompatibleAddr)
                .swapExactTokensForTokens(
                    maxBalanceToSwap,
                    minExpected,
                    path,
                    address(this),
                    block.timestamp
                );

            IERC20 usdt = IERC20(usdtAddress);
            uint256 usdtBalance = usdt.balanceOf(address(this));
            uint16 vaultBps = 1e4 - tokenConfig.harvestRewardBps;
            require(
                tokenConfig.harvestRewardBps > 0,
                "Harvest rewards can not be zero"
            );
            require(
                vaultBps > tokenConfig.harvestRewardBps,
                "Address calling harvest is receiving more rewards than the vault"
            );

            // When governor calls the swap function send full reward amount to the Vault
            if (isGovernor()) {
                usdt.safeTransfer(vaultAddress, usdtBalance);
            } else {
                usdt.safeTransfer(vaultAddress, (usdtBalance * vaultBps) / 1e4);
                usdt.safeTransfer(
                    msg.sender,
                    (usdtBalance * tokenConfig.harvestRewardBps) / 1e4
                );
            }
        }
    }
}
