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
import { IVault } from "./../interfaces/IVault.sol";
import "../utils/Helpers.sol";

abstract contract AbstractHarvesterBase is Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    event SupportedStrategyUpdate(address strategyAddress, bool isSupported);

    event RewardTokenSwapped(
        address indexed rewardToken,
        address indexed swappedInto,
        uint8 swapPlatform,
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

    event RewardTokenConfigUpdated(
        address tokenAddress,
        uint16 allowedSlippageBps,
        uint16 harvestRewardBps,
        uint8 swapPlatform,
        address swapPlatformAddr,
        bytes swapData,
        uint256 liquidationLimit,
        bool doSwapRewardToken
    );

    error EmptyAddress();
    error InvalidSlippageBps();
    error InvalidHarvestRewardBps();
    error InvalidTokenInSwapPath(address token);
    error InvalidSwapPlatform(uint8 swapPlatform);

    error UnsupportedStrategy(address strategyAddress);

    error SlippageError(uint256 actualBalance, uint256 minExpected);
    error BalanceMismatchAfterSwap(uint256 actualBalance, uint256 minExpected);

    // Configuration properties for harvesting logic of reward tokens
    struct RewardTokenConfig {
        // Max allowed slippage when swapping reward token for a stablecoin denominated in basis points.
        uint16 allowedSlippageBps;
        // Reward when calling a harvest function denominated in basis points.
        uint16 harvestRewardBps;
        // Address of compatible exchange protocol (Uniswap V2/V3, SushiSwap, Balancer and Curve).
        address swapPlatformAddr;
        /* When true the reward token is being swapped. In a need of (temporarily) disabling the swapping of
         * a reward token this needs to be set to false.
         */
        bool doSwapRewardToken;
        // Platform to use for Swapping
        uint8 swapPlatform;
        /* How much token can be sold per one harvest call. If the balance of rewards tokens
         * exceeds that limit multiple harvest calls are required to harvest all of the tokens.
         * Set it to MAX_INT to effectively disable the limit.
         */
        uint256 liquidationLimit;
    }
    address public immutable vaultAddress;

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

    constructor(address _vaultAddress, address _baseTokenAddress) {
        require(_vaultAddress != address(0));
        require(_baseTokenAddress != address(0));

        vaultAddress = _vaultAddress;
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
        virtual
    {
        _harvest(_strategyAddr);
        IStrategy strategy = IStrategy(_strategyAddr);
        address[] memory rewardTokens = strategy.getRewardTokenAddresses();
        IOracle priceProvider = IOracle(IVault(vaultAddress).priceProvider());
        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; ++i) {
            _swap(rewardTokens[i], _rewardTo, priceProvider);
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
        uint256 balance = IERC20(_swapToken).balanceOf(address(this));

        // No need to swap if the reward token is the base token. eg USDT or WETH.
        // There is also no limit on the transfer. Everything in the harvester will be transferred
        // to the Dripper regardless of the liquidationLimit config.
        if (_swapToken == baseTokenAddress) {
            IERC20(_swapToken).safeTransfer(rewardProceedsAddress, balance);
            // currently not paying the farmer any rewards as there is no swap
            emit RewardProceedsTransferred(
                baseTokenAddress,
                address(0),
                balance,
                0
            );
            return;
        }

        RewardTokenConfig memory tokenConfig = rewardTokenConfigs[_swapToken];

        /* This will trigger a return when reward token configuration has not yet been set
         * or we have temporarily disabled swapping of specific reward token via setting
         * doSwapRewardToken to false.
         */
        if (!tokenConfig.doSwapRewardToken) {
            return;
        }

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
            // Note: It's possible to bypass this check by transferring `baseToken`
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
        uint256 protocolYield = baseTokenBalance - farmerFee;

        baseToken.safeTransfer(rewardProceedsAddress, protocolYield);
        baseToken.safeTransfer(_rewardTo, farmerFee);
        emit RewardProceedsTransferred(
            baseTokenAddress,
            _rewardTo,
            protocolYield,
            farmerFee
        );
    }

    function _validateConfigAndApproveTokens(
        address _tokenAddress,
        RewardTokenConfig calldata tokenConfig
    ) internal {
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
        IOracle(IVault(vaultAddress).priceProvider()).price(_tokenAddress);

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
    }

    function _doSwap(
        uint8 swapPlatform,
        address routerAddress,
        address rewardTokenAddress,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal virtual returns (uint256 amountOut) {}
}
