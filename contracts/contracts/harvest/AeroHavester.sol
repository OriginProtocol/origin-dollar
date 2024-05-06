// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IRouter } from "./../interfaces/aerodrome/IRouter.sol";
import "../utils/Helpers.sol";

contract AeroHarvester is Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    enum SwapPlatform {
        Aerodrome // Only aerodrome is supported for now.
    }

    event SupportedStrategyUpdate(address strategyAddress, bool isSupported);
    event RewardTokenConfigUpdated(
        address tokenAddress,
        uint16 allowedSlippageBps,
        uint16 harvestRewardBps,
        SwapPlatform swapPlatform,
        address swapPlatformAddr,
        IRouter.Route[] route,
        uint256 liquidationLimit,
        bool doSwapRewardToken
    );
    event RewardTokenSwapped(
        address indexed rewardToken,
        address indexed swappedInto,
        SwapPlatform swapPlatform,
        uint256 amountIn,
        uint256 amountOut
    );
    event RewardProceedsTransferred(
        address indexed token,
        address farmer,
        uint256 protcolYield,
        uint256 farmerFee
    );
    event RewardProceedsAddressChanged(address newProceedsAddress);
    event PriceProviderAddressChanged(address priceProviderAddress);

    error EmptyAddress();
    error InvalidSlippageBps();
    error InvalidHarvestRewardBps();

    error InvalidSwapPlatform(SwapPlatform swapPlatform);

    error InvalidTokenInSwapPath(address token);

    error UnsupportedStrategy(address strategyAddress);

    error SlippageError(uint256 actualBalance, uint256 minExpected);
    error BalanceMismatchAfterSwap(uint256 actualBalance, uint256 minExpected);

    // Configuration properties for harvesting logic of reward tokens
    struct RewardTokenConfig {
        // Max allowed slippage when swapping reward token for a stablecoin denominated in basis points.
        uint16 allowedSlippageBps;
        // Reward when calling a harvest function denominated in basis points.
        uint16 harvestRewardBps;
        // Address of AMM protocol like Aerodrome to perform swap Rewards => BaseToken.
        address swapPlatformAddr;
        /* When true the reward token is being swapped. In a need of (temporarily) disabling the swapping of
         * a reward token this needs to be set to false.
         */
        bool doSwapRewardToken;
        // Platform to use for Swapping
        SwapPlatform swapPlatform;
        /* How much token can be sold per one harvest call. If the balance of rewards tokens
         * exceeds that limit multiple harvest calls are required to harvest all of the tokens.
         * Set it to MAX_INT to effectively disable the limit.
         */
        uint256 liquidationLimit;
    }

    mapping(address => RewardTokenConfig) public rewardTokenConfigs;
    mapping(address => bool) public supportedStrategies;

    /**
     * Address receiving rewards proceeds. Initially the Vault contract later will possibly
     * be replaced by another contract that eases out rewards distribution.
     **/
    address public rewardProceedsAddress;

    /**
     * All tokens are swapped to this token before it gets transferred
     * to the `rewardProceedsAddress`. USDT for OUSD and WETH for OETH.
     **/
    address public immutable baseTokenAddress;
    // Cached decimals for `baseTokenAddress`
    uint256 public immutable baseTokenDecimals;

    // Aerodrome route to swap using Aerodrome Router
    mapping(address => IRouter.Route[]) public aerodromeRoute;

    // Address of the price provider
    IOracle public immutable priceProvider;

    constructor(IOracle _priceProvider, address _baseTokenAddress) {
        require(address(_priceProvider) != address(0));
        require(_baseTokenAddress != address(0));

        priceProvider = _priceProvider;
        baseTokenAddress = _baseTokenAddress;

        // Cache decimals as well
        baseTokenDecimals = Helpers.getDecimals(_baseTokenAddress);
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * Set the Address receiving rewards proceeds.
     * @param _rewardProceedsAddress Address of the reward token
     */
    function setRewardProceedsAddress(address _rewardProceedsAddress)
        external
        onlyGovernor
    {
        if (_rewardProceedsAddress == address(0)) {
            revert EmptyAddress();
        }

        rewardProceedsAddress = _rewardProceedsAddress;
        emit RewardProceedsAddressChanged(_rewardProceedsAddress);
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
     * @param route Route required for swapping
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        RewardTokenConfig calldata tokenConfig,
        IRouter.Route[] memory route
    ) external onlyGovernor {
        if (tokenConfig.allowedSlippageBps > 1000) {
            revert InvalidSlippageBps();
        }

        if (tokenConfig.harvestRewardBps > 1000) {
            revert InvalidHarvestRewardBps();
        }

        address newRouterAddress = tokenConfig.swapPlatformAddr;
        if (newRouterAddress == address(0)) {
            // Swap router address should be non zero address
            revert EmptyAddress();
        }

        address oldRouterAddress = rewardTokenConfigs[_tokenAddress]
            .swapPlatformAddr;
        rewardTokenConfigs[_tokenAddress] = tokenConfig;

        // Revert if feed does not exist
        // slither-disable-next-line unused-return
        priceProvider.price(_tokenAddress);

        IERC20 token = IERC20(_tokenAddress);
        // if changing token swap provider cancel existing allowance
        if (
            /* oldRouterAddress == address(0) when there is no pre-existing
             * configuration for said rewards token
             */
            oldRouterAddress != address(0) &&
            oldRouterAddress != newRouterAddress
        ) {
            token.safeApprove(oldRouterAddress, 0);
        }

        // Give SwapRouter infinite approval when needed
        if (oldRouterAddress != newRouterAddress) {
            token.safeApprove(newRouterAddress, 0);
            token.safeApprove(newRouterAddress, type(uint256).max);
        }

        SwapPlatform _platform = tokenConfig.swapPlatform;
        if (_platform == SwapPlatform.Aerodrome) {
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
            _platform,
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

    /**
     * @dev Flags a strategy as supported or not supported one
     * @param _strategyAddress Address of the strategy
     * @param _isSupported Bool marking strategy as supported or not supported
     */
    function setSupportedStrategy(address _strategyAddress, bool _isSupported)
        external
        onlyGovernor
    {
        supportedStrategies[_strategyAddress] = _isSupported;
        emit SupportedStrategyUpdate(_strategyAddress, _isSupported);
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
     * @dev Collect reward tokens from a specific strategy and swap them for
     *      base token on the configured swap platform. Can be called by anyone.
     *      Rewards incentivizing the caller are sent to the caller of this function.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvestAndSwap(address _strategyAddr) external nonReentrant {
        // Remember _harvest function checks for the validity of _strategyAddr
        _harvestAndSwap(_strategyAddr, msg.sender);
    }

    /**
     * @dev Collect reward tokens from a specific strategy and swap them for
     *      base token on the configured swap platform. Can be called by anyone
     * @param _strategyAddr Address of the strategy to collect rewards from
     * @param _rewardTo Address where to send a share of harvest rewards to as an incentive
     *      for executing this function
     */
    function harvestAndSwap(address _strategyAddr, address _rewardTo)
        external
        nonReentrant
    {
        // Remember _harvest function checks for the validity of _strategyAddr
        _harvestAndSwap(_strategyAddr, _rewardTo);
    }

    /**
     * @dev Collect reward tokens from a specific strategy and swap them for
     *      base token on the configured swap platform
     * @param _strategyAddr Address of the strategy to collect rewards from
     * @param _rewardTo Address where to send a share of harvest rewards to as an incentive
     *      for executing this function
     */
    function _harvestAndSwap(address _strategyAddr, address _rewardTo)
        internal
    {
        _harvest(_strategyAddr);
        IStrategy strategy = IStrategy(_strategyAddr);
        address[] memory rewardTokens = strategy.getRewardTokenAddresses();
        IOracle _priceProvider = priceProvider;
        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; ++i) {
            _swap(rewardTokens[i], _rewardTo, _priceProvider);
        }
    }

    /**
     * @dev Collect reward tokens from a specific strategy and swap them for
     *      base token on the configured swap platform
     * @param _strategyAddr Address of the strategy to collect rewards from.
     */
    function _harvest(address _strategyAddr) internal {
        if (!supportedStrategies[_strategyAddr]) {
            revert UnsupportedStrategy(_strategyAddr);
        }

        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.collectRewardTokens();
    }

    /**
     * @dev Swap a reward token for the base token on the configured
     *      swap platform. The token must have a registered price feed
     *      with the price provider
     * @param _swapToken Address of the token to swap
     * @param _rewardTo Address where to send the share of harvest rewards to
     * @param _priceProvider Oracle to get prices of the swap token
     */
    function _swap(
        address _swapToken,
        address _rewardTo,
        IOracle _priceProvider
    ) internal virtual {
        RewardTokenConfig memory tokenConfig = rewardTokenConfigs[_swapToken];

        /* This will trigger a return when reward token configuration has not yet been set
         * or we have temporarily disabled swapping of specific reward token via setting
         * doSwapRewardToken to false.
         */
        if (!tokenConfig.doSwapRewardToken) {
            return;
        }

        uint256 balance = IERC20(_swapToken).balanceOf(address(this));

        if (balance == 0) {
            return;
        }

        if (tokenConfig.liquidationLimit > 0) {
            balance = Math.min(balance, tokenConfig.liquidationLimit);
        }

        // This'll revert if there is no price feed
        uint256 oraclePrice = _priceProvider.price(_swapToken);

        // Oracle price is 1e18
        uint256 minExpected = (balance *
            (1e4 - tokenConfig.allowedSlippageBps) * // max allowed slippage
            oraclePrice).scaleBy(
                baseTokenDecimals,
                Helpers.getDecimals(_swapToken)
            ) /
            1e4 / // fix the max slippage decimal position
            1e18; // and oracle price decimals position

        // Do the swap
        uint256 amountReceived = _doSwap(
            tokenConfig.swapPlatform,
            tokenConfig.swapPlatformAddr,
            _swapToken,
            balance,
            minExpected
        );

        if (amountReceived < minExpected) {
            revert SlippageError(amountReceived, minExpected);
        }

        emit RewardTokenSwapped(
            _swapToken,
            baseTokenAddress,
            tokenConfig.swapPlatform,
            balance,
            amountReceived
        );

        IERC20 baseToken = IERC20(baseTokenAddress);
        uint256 baseTokenBalance = baseToken.balanceOf(address(this));
        if (baseTokenBalance < amountReceived) {
            // Note: It's possible to bypass this check by transfering `baseToken`
            // directly to Harvester before calling the `harvestAndSwap`. However,
            // there's no incentive for an attacker to do that. Doing a balance diff
            // will increase the gas cost significantly
            revert BalanceMismatchAfterSwap(baseTokenBalance, amountReceived);
        }

        // Farmer only gets fee from the base amount they helped farm,
        // They do not get anything from anything that already was there
        // on the Harvester
        uint256 farmerFee = amountReceived.mulTruncateScale(
            tokenConfig.harvestRewardBps,
            1e4
        );
        uint256 protcolYield = baseTokenBalance - farmerFee;

        baseToken.safeTransfer(rewardProceedsAddress, protcolYield);
        baseToken.safeTransfer(_rewardTo, farmerFee);
        emit RewardProceedsTransferred(
            baseTokenAddress,
            _rewardTo,
            protcolYield,
            farmerFee
        );
    }

    function _doSwap(
        SwapPlatform swapPlatform,
        address routerAddress,
        address rewardTokenAddress,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        if (swapPlatform == SwapPlatform.Aerodrome) {
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
