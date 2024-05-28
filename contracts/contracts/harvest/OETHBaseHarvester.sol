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
import { IStrategy } from "./../interfaces/IStrategy.sol";
import { IVault } from "./../interfaces/IVault.sol";

contract OETHBaseHarvester is AbstractHarvesterBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    enum SwapPlatform {
        Aerodrome // Only aerodrome is supported for now.
    }

    event PriceProviderAddressChanged(address priceProviderAddress);
    event PerformanceFeeChanged(uint256 performanceFee);
    event PerformanceFeeReceiverChanged(address performanceFeeReceiver);

    // Aerodrome route to swap using Aerodrome Router
    mapping(address => bytes) public aerodromeRoute;

    // Performance fee config
    uint256 public performanceFeeBps;
    address public performanceFeeReceiver;

    constructor(address _vaultAddress, address _baseTokenAddress)
        AbstractHarvesterBase(_vaultAddress, _baseTokenAddress)
    {}

    /**
     * @dev Used to update the performance fee basis points. Eg: 1000 represents 10%
     *
     * @param _performanceFee New performance fee.
     */
    function setPerformanceFeeBps(uint256 _performanceFee)
        external
        onlyGovernor
    {
        require(_performanceFee < 1e4, "Fee too high");
        performanceFeeBps = _performanceFee;
        emit PerformanceFeeChanged(_performanceFee);
    }

    /**
     * @dev Used to update the performance fee receiver address.
     *
     * @param _performanceFeeReceiver New address to receive the performance fee.
     */
    function setPerformanceFeeReceiver(address _performanceFeeReceiver)
        external
        onlyGovernor
    {
        require(_performanceFeeReceiver != address(0), "Zero Address");
        performanceFeeReceiver = _performanceFeeReceiver;
        emit PerformanceFeeReceiverChanged(_performanceFeeReceiver);
    }

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
     * @param swapData Route required for swapping
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        RewardTokenConfig calldata tokenConfig,
        bytes calldata swapData
    ) external onlyGovernor {
        _validateConfigAndApproveTokens(_tokenAddress, tokenConfig);

        address newRouterAddress = tokenConfig.swapPlatformAddr;
        uint8 _platform = tokenConfig.swapPlatform;
        if (_platform == uint8(SwapPlatform.Aerodrome)) {
            _validateAerodromeRoute(swapData, _tokenAddress);
            aerodromeRoute[_tokenAddress] = swapData;
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
            swapData,
            tokenConfig.liquidationLimit,
            tokenConfig.doSwapRewardToken
        );
    }

    /**
     * @dev Validates the route to make sure the path is for `token` to `baseToken`
     *
     * @param data Route passed to the `setRewardTokenConfig`
     * @param token The address of the reward token
     */
    function _validateAerodromeRoute(bytes memory data, address token)
        internal
        view
    {
        IRouter.Route[] memory route = abi.decode(data, (IRouter.Route[]));
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
     * @dev Collect reward tokens from a specific strategy, send performance fee and swap
     *      the remaining tokens for base token on the configured swap platform
     * @param _strategyAddr Address of the strategy to collect rewards from
     * @param _rewardTo Address where to send a share of harvest rewards to as an incentive
     *      for executing this function
     */
    function _harvestAndSwap(address _strategyAddr, address _rewardTo)
        internal
        virtual
        override
    {
        _harvest(_strategyAddr);
        IStrategy strategy = IStrategy(_strategyAddr);
        address[] memory rewardTokens = strategy.getRewardTokenAddresses();
        IOracle priceProvider = IOracle(IVault(vaultAddress).priceProvider());
        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; ++i) {
            uint256 totalRewards = IERC20(rewardTokens[i]).balanceOf(
                address(this)
            );
            uint256 feeAmount = totalRewards.mul(performanceFeeBps).div(1e4);
            // Send fee to performance fee receiver
            IERC20(rewardTokens[i]).transfer(performanceFeeReceiver, feeAmount);
            // swap the remaining amount
            _swap(rewardTokens[i], _rewardTo, priceProvider);
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
        IRouter.Route[] memory route = abi.decode(
            aerodromeRoute[swapToken],
            (IRouter.Route[])
        );

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
