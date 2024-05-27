// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IRouter } from "./../interfaces/aerodrome/IRouter.sol";
import "../utils/Helpers.sol";
import { AbstractHarvesterBase } from "./AbstractHarvesterBase.sol";
import { IVault } from "./../interfaces/IVault.sol";

contract OETHBaseHarvester is AbstractHarvesterBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    enum SwapPlatform {
        Aerodrome // Only aerodrome is supported for now.
    }

    event RewardTokenConfigUpdated(
        address tokenAddress,
        uint16 allowedSlippageBps,
        uint16 harvestRewardBps,
        uint8 swapPlatform,
        address swapPlatformAddr,
        IRouter.Route[] route,
        uint256 liquidationLimit,
        bool doSwapRewardToken
    );

    event PriceProviderAddressChanged(address priceProviderAddress);

    // Aerodrome route to swap using Aerodrome Router
    mapping(address => IRouter.Route[]) public aerodromeRoute;

    constructor(address _vaultAddress, address _baseTokenAddress)
        AbstractHarvesterBase(_vaultAddress, _baseTokenAddress)
    {}

    /**
     * @dev Add/update a reward token configuration that holds harvesting config variables
     * @param _tokenAddress Address of the reward token
     * @param tokenConfig.allowedSlippageBps uint16 maximum allowed slippage denominated in basis points.
     *          Example: 300 == 3% slippage
     * @param tokenConfig.harvestRewardBps uint16 amount of reward tokens the caller of the function is rewarded.
     *          Example: 100 == 1%
     * @param tokenConfig.swapPlatformAddr Address of a AMM contract to perform
     *          the exchange from reward tokens to stablecoin (currently hard-coded to USDT)
     * @param tokenConfig.liquidationLimit uint256 Maximum amount of token to be sold per one swap function call.
     *          When value is 0 there is no limit.
     * @param tokenConfig.doSwapRewardToken bool Disables swapping of the token when set to true,
     *          does not cause it to revert though.
     * @param tokenConfig.swapPlatform SwapPlatform to use for Swapping
     * @param route Route required for swapping
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        RewardTokenConfig calldata tokenConfig,
        IRouter.Route[] memory route
    ) external onlyGovernor {
        _validateConfigAndApproveTokens(_tokenAddress, tokenConfig);

        address newRouterAddress = tokenConfig.swapPlatformAddr;
        uint8 _platform = tokenConfig.swapPlatform;
        if (_platform == uint8(SwapPlatform.Aerodrome)) {
            _validateAerodromeRoute(route, _tokenAddress);

            // Find a better way to do this.
            IRouter.Route[] storage routes = aerodromeRoute[_tokenAddress];
            for (uint256 i = 0; i < route.length; ) {
                routes.push(route[i]);
                unchecked {
                    ++i;
                }
            }
        } else {
            // Note: This code is unreachable since Solidity reverts when
            // the value is outside the range of defined values of the enum
            // (even if it's under the max length of the base type)
            revert InvalidSwapPlatform(_platform);
        }

        emit RewardTokenConfigUpdated(
            _tokenAddress,
            tokenConfig.allowedSlippageBps,
            tokenConfig.harvestRewardBps,
            uint8(_platform),
            newRouterAddress,
            route,
            tokenConfig.liquidationLimit,
            tokenConfig.doSwapRewardToken
        );
    }

    /**
     * @dev Validates the route to make sure the path is for `token` to `baseToken`
     *
     * @param route Route passed to the `setRewardTokenConfig`
     * @param token The address of the reward token
     */
    function _validateAerodromeRoute(
        IRouter.Route[] memory route,
        address token
    ) internal view {
        // Do some validation
        if (route[0].from != token) {
            revert InvalidTokenInSwapPath(route[0].from);
        }

        if (route[route.length - 1].to != baseTokenAddress) {
            revert InvalidTokenInSwapPath(route[route.length - 1].to);
        }
    }

    function _doSwap(
        uint8 swapPlatform,
        address routerAddress,
        address rewardTokenAddress,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal virtual override returns (uint256 amountOut) {
        if (swapPlatform == uint8(SwapPlatform.Aerodrome)) {
            return
                _swapWithAerodrome(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else {
            // Should never be invoked since we catch invalid values
            // in the `setRewardTokenConfig` function before it's set
            revert InvalidSwapPlatform(swapPlatform);
        }
    }

    /**
     * @dev Swaps the token to `baseToken` with Aerodrome
     *
     * @param routerAddress Aerodrome Router address
     * @param swapToken Address of the tokenIn
     * @param amountIn Amount of `swapToken` to swap
     * @param minAmountOut Minimum expected amount of `baseToken`
     *
     * @return amountOut Amount of `baseToken` received after the swap
     */
    function _swapWithAerodrome(
        address routerAddress,
        address swapToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        IRouter.Route[] memory route = aerodromeRoute[swapToken];

        uint256[] memory amounts = IRouter(routerAddress)
            .swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                route,
                address(this),
                block.timestamp
            );

        amountOut = amounts[amounts.length - 1];
    }
}
