// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { BaseHarvester } from "./BaseHarvester.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import "../utils/Helpers.sol";

contract OETHHarvester is BaseHarvester {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    // "_usdtAddress" is set to Vault's address, but is really not used
    constructor(address _vault) BaseHarvester(_vault) {}

    /**
     * @dev Swap a reward token for stablecoins on Uniswap. The token must have
     *       a registered price feed with the price provider.
     * @param _swapToken Address of the token to swap.
     * @param _rewardTo Address where to send the share of harvest rewards to
     */
    function _swap(address _swapToken, address _rewardTo) internal override {
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

        uint256 balanceToSwap = Math.min(balance, tokenConfig.liquidationLimit);

        // Find reward token price feed paired with (W)ETH
        uint256 oraclePrice = IOracle(priceProvider).price(_swapToken);

        // Oracle price is in 18 digits, WETH decimals are in 1e18
        uint256 minExpected = (balanceToSwap *
            (1e4 - tokenConfig.allowedSlippageBps) * // max allowed slippage
            oraclePrice).scaleBy(18, Helpers.getDecimals(_swapToken)) /
            1e4 / // fix the max slippage decimal position
            1e18; // and oracle price decimals position

        address wethAddress = IUniswapV2Router(
            tokenConfig.uniswapV2CompatibleAddr
        ).WETH();

        // Uniswap redemption path
        address[] memory path = new address[](2);
        path[0] = _swapToken;
        path[1] = wethAddress;

        // slither-disable-next-line unused-return
        IUniswapV2Router(tokenConfig.uniswapV2CompatibleAddr)
            .swapExactTokensForTokens(
                balanceToSwap,
                minExpected,
                path,
                address(this),
                block.timestamp
            );

        IERC20 wethErc20 = IERC20(wethAddress);
        uint256 wethBalance = wethErc20.balanceOf(address(this));

        uint256 vaultBps = 1e4 - tokenConfig.harvestRewardBps;
        uint256 rewardsProceedsShare = (wethBalance * vaultBps) / 1e4;

        require(
            vaultBps > tokenConfig.harvestRewardBps,
            "Address receiving harvest incentive is receiving more rewards than the rewards proceeds address"
        );

        wethErc20.safeTransfer(rewardProceedsAddress, rewardsProceedsShare);
        wethErc20.safeTransfer(
            _rewardTo,
            wethBalance - rewardsProceedsShare // remaining share of the rewards
        );
    }
}
