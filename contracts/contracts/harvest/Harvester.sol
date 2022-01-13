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

    // Tokens that should be swapped for stablecoins
    address[] public swapTokens;

    // Address of Uniswap
    address public uniswapAddr = address(0);

    // Address of Vault
    address public vaultAddress = address(0);

    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _vaultAddress Address of the Vault
     */
    function initialize(address _vaultAddress)
        external
        onlyGovernor
        initializer
    {
        _initialize(_vaultAddress);
    }

    function _initialize(address _vaultAddress) internal {
        vaultAddress = _vaultAddress;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        address priceProvider = IVault(vaultAddress).priceProvider();

        if (uniswapAddr != address(0)) {
            for (uint256 i = 0; i < swapTokens.length; i++) {
                // Revoke swap token approvals for old address
                IERC20(swapTokens[i]).safeApprove(uniswapAddr, 0);
            }
        }
        uniswapAddr = _address;
        for (uint256 i = 0; i < swapTokens.length; i++) {
            // Add swap token approvals for new address
            IERC20(swapTokens[i]).safeApprove(uniswapAddr, type(uint256).max);
        }
        emit UniswapUpdated(_address);
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

        address priceProvider = IVault(vaultAddress).priceProvider();

        // Revert if feed does not exist
        IOracle(priceProvider).price(_addr);

        swapTokens.push(_addr);

        // Give Uniswap infinite approval
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
    function harvest() external nonReentrant {
        _harvest();
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap.
     */
    function swap() external nonReentrant {
        _swap();
    }

    /*
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvestAndSwap() external nonReentrant {
        // TODO add protection so that harvestAndSwap isn't called twice too closely together
        _harvest();
        _swap();
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
    function harvest(address _strategyAddr) external nonReentrant {
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
        uint256[] memory liquidationLimits = strategy
            .getRewardLiquidationLimits();
        uint32 harvestRewardBps = strategy.getHarvestRewardBps();

        require(
            rewardTokens.length == liquidationLimits.length,
            "Reward token array and liquidation limit array must be of the same size"
        );

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _swap(rewardTokens[i], liquidationLimits[i], harvestRewardBps);
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
        uint256[] memory swapLimits = new uint256[](swapTokens.length);
        uint32[] memory harvestRewardsBps = new uint32[](swapTokens.length);
        // reset to zero
        for (uint256 i = 0; i < swapLimits.length; i++) {
            swapLimits[i] = 0;
        }
        address[] memory allStrategies = IVault(vaultAddress)
            .getAllStrategies();

        // Find corresponding reward token from strategies and fetch its swap limit
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            address[] memory rewardTokens = strategy.getRewardTokenAddresses();
            uint256[] memory liquidationLimits = strategy
                .getRewardLiquidationLimits();
            uint32 harvestRewardBps = strategy.getHarvestRewardBps();

            require(
                rewardTokens.length == liquidationLimits.length,
                "Reward token array and liquidation limit array must be of the same size"
            );

            for (uint256 j = 0; j < rewardTokens.length; j++) {
                for (uint256 h = 0; h < swapTokens.length; h++) {
                    if (rewardTokens[j] == swapTokens[h]) {
                        swapLimits[h] = liquidationLimits[j];
                        harvestRewardsBps[h] = harvestRewardBps;
                    }
                }
            }
        }

        for (uint256 i = 0; i < swapTokens.length; i++) {
            _swap(swapTokens[i], swapLimits[i], harvestRewardsBps[i]);
        }
    }

    /**
     * @dev Swap a record token for stablecoins for Uniswap. The token must have
     *       a registered price feed with the price provider.
     * @param _swapToken Address of the token to swap.
     */
    function _swap(address _swapToken, uint256 _swapLimit, uint32 _harvestRewardBps)
        internal
        returns (uint256[] memory swapResult)
    {
        address priceProvider = IVault(vaultAddress).priceProvider();
        address[] memory allAssets = IVault(vaultAddress).getAllAssets();

        if (uniswapAddr != address(0)) {
            IERC20 swapToken = IERC20(_swapToken);
            uint256 balance = swapToken.balanceOf(address(this));
            if (balance > 0) {
                uint256 maxBalanceToSwap = balance;
                if (_swapLimit != 0) {
                    maxBalanceToSwap = Math.min(balance, _swapLimit);
                }

                // This'll revert if there is no price feed
                uint256 oraclePrice = IOracle(priceProvider).price(_swapToken);
                // Oracle price is 1e8, USDT output is 1e6
                uint256 minExpected = ((maxBalanceToSwap * oraclePrice * 97) /
                    100).scaleBy(6, Helpers.getDecimals(_swapToken) + 8);

                // Uniswap redemption path
                address[] memory path = new address[](3);
                path[0] = _swapToken;
                path[1] = IUniswapV2Router(uniswapAddr).WETH();
                path[2] = allAssets[1]; // USDT

                swapResult = IUniswapV2Router(uniswapAddr)
                    .swapExactTokensForTokens(
                        maxBalanceToSwap,
                        minExpected,
                        path,
                        address(this),
                        block.timestamp
                    );

                IERC20 usdt = IERC20(allAssets[1]); // USDT
                uint256 usdTbalance = usdt.balanceOf(address(this));
                uint32 vaultBps = 1e4 - _harvestRewardBps;
                require(_harvestRewardBps > 0, "Harvest rewards can not be zero");
                require(vaultBps > _harvestRewardBps, "Address calling harvest is receiving more rewards than the vault");

                usdt.safeTransfer(vaultAddress, usdTbalance * vaultBps / 1e4);
                usdt.safeTransfer(msg.sender, usdTbalance * _harvestRewardBps / 1e4);
            }
        }
    }
}
