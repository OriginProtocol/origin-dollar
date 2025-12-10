// SPDX-License-Identifier: BUSL-1.1
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
import { IUniswapV3Router } from "../interfaces/uniswap/IUniswapV3Router.sol";
import { IBalancerVault } from "../interfaces/balancer/IBalancerVault.sol";
import { ICurvePool } from "../strategies/ICurvePool.sol";
import "../utils/Helpers.sol";

abstract contract AbstractHarvester is Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    enum SwapPlatform {
        UniswapV2Compatible,
        UniswapV3,
        Balancer,
        Curve
    }

    event SupportedStrategyUpdate(address strategyAddress, bool isSupported);
    event RewardTokenConfigUpdated(
        address tokenAddress,
        uint16 allowedSlippageBps,
        uint16 harvestRewardBps,
        SwapPlatform swapPlatform,
        address swapPlatformAddr,
        bytes swapData,
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

    error EmptyAddress();
    error InvalidSlippageBps();
    error InvalidHarvestRewardBps();

    error InvalidSwapPlatform(SwapPlatform swapPlatform);

    error InvalidUniswapV2PathLength();
    error InvalidTokenInSwapPath(address token);
    error EmptyBalancerPoolId();
    error InvalidCurvePoolAssetIndex(address token);

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
        SwapPlatform swapPlatform;
        /* How much token can be sold per one harvest call. If the balance of rewards tokens
         * exceeds that limit multiple harvest calls are required to harvest all of the tokens.
         * Set it to MAX_INT to effectively disable the limit.
         */
        uint256 liquidationLimit;
    }

    mapping(address => RewardTokenConfig) public rewardTokenConfigs;
    mapping(address => bool) public supportedStrategies;

    address public immutable vaultAddress;

    IOracle public immutable oracle;

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

    // Uniswap V2 path for reward tokens using Uniswap V2 Router
    mapping(address => address[]) public uniswapV2Path;
    // Uniswap V3 path for reward tokens using Uniswap V3 Router
    mapping(address => bytes) public uniswapV3Path;
    // Pool ID to use for reward tokens on Balancer
    mapping(address => bytes32) public balancerPoolId;

    struct CurvePoolIndices {
        // Casted into uint128 and stored in a struct to save gas
        uint128 rewardTokenIndex;
        uint128 baseTokenIndex;
    }
    // Packed indices of assets on the Curve pool
    mapping(address => CurvePoolIndices) public curvePoolIndices;

    constructor(
        address _vaultAddress,
        address _baseTokenAddress,
        address _oracleAddress
    ) {
        require(_vaultAddress != address(0));
        require(_baseTokenAddress != address(0));

        vaultAddress = _vaultAddress;
        baseTokenAddress = _baseTokenAddress;
        oracle = IOracle(_oracleAddress);

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
     * @param tokenConfig.swapPlatformAddr Address Address of a UniswapV2 compatible contract to perform
     *          the exchange from reward tokens to stablecoin (currently hard-coded to USDT)
     * @param tokenConfig.liquidationLimit uint256 Maximum amount of token to be sold per one swap function call.
     *          When value is 0 there is no limit.
     * @param tokenConfig.doSwapRewardToken bool Disables swapping of the token when set to true,
     *          does not cause it to revert though.
     * @param tokenConfig.swapPlatform SwapPlatform to use for Swapping
     * @param swapData Additional data required for swapping
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        RewardTokenConfig calldata tokenConfig,
        bytes calldata swapData
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
        oracle.price(_tokenAddress);

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
        if (_platform == SwapPlatform.UniswapV2Compatible) {
            uniswapV2Path[_tokenAddress] = _decodeUniswapV2Path(
                swapData,
                _tokenAddress
            );
        } else if (_platform == SwapPlatform.UniswapV3) {
            uniswapV3Path[_tokenAddress] = _decodeUniswapV3Path(
                swapData,
                _tokenAddress
            );
        } else if (_platform == SwapPlatform.Balancer) {
            balancerPoolId[_tokenAddress] = _decodeBalancerPoolId(
                swapData,
                newRouterAddress,
                _tokenAddress
            );
        } else if (_platform == SwapPlatform.Curve) {
            curvePoolIndices[_tokenAddress] = _decodeCurvePoolIndices(
                swapData,
                newRouterAddress,
                _tokenAddress
            );
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
            swapData,
            tokenConfig.liquidationLimit,
            tokenConfig.doSwapRewardToken
        );
    }

    /**
     * @dev Decodes the data passed into Uniswap V2 path and validates
     *      it to make sure the path is for `token` to `baseToken`
     *
     * @param data Ecnoded data passed to the `setRewardTokenConfig`
     * @param token The address of the reward token
     * @return path The validated Uniswap V2 path
     */
    function _decodeUniswapV2Path(bytes calldata data, address token)
        internal
        view
        returns (address[] memory path)
    {
        (path) = abi.decode(data, (address[]));
        uint256 len = path.length;

        if (len < 2) {
            // Path should have at least two tokens
            revert InvalidUniswapV2PathLength();
        }

        // Do some validation
        if (path[0] != token) {
            revert InvalidTokenInSwapPath(path[0]);
        }

        if (path[len - 1] != baseTokenAddress) {
            revert InvalidTokenInSwapPath(path[len - 1]);
        }
    }

    /**
     * @dev Decodes the data passed into Uniswap V3 path and validates
     *      it to make sure the path is for `token` to `baseToken`
     *
     * @param data Ecnoded data passed to the `setRewardTokenConfig`
     * @param token The address of the reward token
     * @return path The validated Uniswap V3 path
     */
    function _decodeUniswapV3Path(bytes calldata data, address token)
        internal
        view
        returns (bytes calldata path)
    {
        path = data;

        address decodedAddress = address(uint160(bytes20(data[0:20])));

        if (decodedAddress != token) {
            // Invalid Reward Token in swap path
            revert InvalidTokenInSwapPath(decodedAddress);
        }

        decodedAddress = address(uint160(bytes20(data[path.length - 20:])));
        if (decodedAddress != baseTokenAddress) {
            // Invalid Base Token in swap path
            revert InvalidTokenInSwapPath(decodedAddress);
        }
    }

    /**
     * @dev Decodes the data passed to Balancer Pool ID
     *
     * @param data Ecnoded data passed to the `setRewardTokenConfig`
     * @return poolId The pool ID
     */
    function _decodeBalancerPoolId(
        bytes calldata data,
        address balancerVault,
        address token
    ) internal view returns (bytes32 poolId) {
        (poolId) = abi.decode(data, (bytes32));

        if (poolId == bytes32(0)) {
            revert EmptyBalancerPoolId();
        }

        IBalancerVault bVault = IBalancerVault(balancerVault);

        // Note: this reverts if token is not a pool asset
        // slither-disable-next-line unused-return
        bVault.getPoolTokenInfo(poolId, token);

        // slither-disable-next-line unused-return
        bVault.getPoolTokenInfo(poolId, baseTokenAddress);
    }

    /**
     * @dev Decodes the data passed to get the pool indices and
     *      checks it against the Curve Pool to make sure it's
     *      not misconfigured. The indices are packed into a single
     *      uint256 for gas savings
     *
     * @param data Ecnoded data passed to the `setRewardTokenConfig`
     * @param poolAddress Curve pool address
     * @param token The address of the reward token
     * @return indices Packed pool asset indices
     */
    function _decodeCurvePoolIndices(
        bytes calldata data,
        address poolAddress,
        address token
    ) internal view returns (CurvePoolIndices memory indices) {
        indices = abi.decode(data, (CurvePoolIndices));

        ICurvePool pool = ICurvePool(poolAddress);
        if (token != pool.coins(indices.rewardTokenIndex)) {
            revert InvalidCurvePoolAssetIndex(token);
        }
        if (baseTokenAddress != pool.coins(indices.baseTokenIndex)) {
            revert InvalidCurvePoolAssetIndex(baseTokenAddress);
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
        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; ++i) {
            _swap(rewardTokens[i], _rewardTo, oracle);
        }
    }

    /**
     * @dev Collect reward tokens from a specific strategy and swap them for
     *      base token on the configured swap platform
     * @param _strategyAddr Address of the strategy to collect rewards from.
     */
    function _harvest(address _strategyAddr) internal virtual {
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

    function _doSwap(
        SwapPlatform swapPlatform,
        address routerAddress,
        address rewardTokenAddress,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        if (swapPlatform == SwapPlatform.UniswapV2Compatible) {
            return
                _swapWithUniswapV2(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else if (swapPlatform == SwapPlatform.UniswapV3) {
            return
                _swapWithUniswapV3(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else if (swapPlatform == SwapPlatform.Balancer) {
            return
                _swapWithBalancer(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else if (swapPlatform == SwapPlatform.Curve) {
            return
                _swapWithCurve(
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
     * @dev Swaps the token to `baseToken` with Uniswap V2
     *
     * @param routerAddress Uniswap V2 Router address
     * @param swapToken Address of the tokenIn
     * @param amountIn Amount of `swapToken` to swap
     * @param minAmountOut Minimum expected amount of `baseToken`
     *
     * @return amountOut Amount of `baseToken` received after the swap
     */
    function _swapWithUniswapV2(
        address routerAddress,
        address swapToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        address[] memory path = uniswapV2Path[swapToken];

        uint256[] memory amounts = IUniswapV2Router(routerAddress)
            .swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                path,
                address(this),
                block.timestamp
            );

        amountOut = amounts[amounts.length - 1];
    }

    /**
     * @dev Swaps the token to `baseToken` with Uniswap V3
     *
     * @param routerAddress Uniswap V3 Router address
     * @param swapToken Address of the tokenIn
     * @param amountIn Amount of `swapToken` to swap
     * @param minAmountOut Minimum expected amount of `baseToken`
     *
     * @return amountOut Amount of `baseToken` received after the swap
     */
    function _swapWithUniswapV3(
        address routerAddress,
        address swapToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        bytes memory path = uniswapV3Path[swapToken];

        IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router
            .ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut
            });
        amountOut = IUniswapV3Router(routerAddress).exactInput(params);
    }

    /**
     * @dev Swaps the token to `baseToken` on Balancer
     *
     * @param balancerVaultAddress BalancerVaultAddress
     * @param swapToken Address of the tokenIn
     * @param amountIn Amount of `swapToken` to swap
     * @param minAmountOut Minimum expected amount of `baseToken`
     *
     * @return amountOut Amount of `baseToken` received after the swap
     */
    function _swapWithBalancer(
        address balancerVaultAddress,
        address swapToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        bytes32 poolId = balancerPoolId[swapToken];

        IBalancerVault.SingleSwap memory singleSwap = IBalancerVault
            .SingleSwap({
                poolId: poolId,
                kind: IBalancerVault.SwapKind.GIVEN_IN,
                assetIn: swapToken,
                assetOut: baseTokenAddress,
                amount: amountIn,
                userData: hex""
            });

        IBalancerVault.FundManagement memory fundMgmt = IBalancerVault
            .FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: payable(address(this)),
                toInternalBalance: false
            });

        amountOut = IBalancerVault(balancerVaultAddress).swap(
            singleSwap,
            fundMgmt,
            minAmountOut,
            block.timestamp
        );
    }

    /**
     * @dev Swaps the token to `baseToken` on Curve
     *
     * @param poolAddress Curve Pool Address
     * @param swapToken Address of the tokenIn
     * @param amountIn Amount of `swapToken` to swap
     * @param minAmountOut Minimum expected amount of `baseToken`
     *
     * @return amountOut Amount of `baseToken` received after the swap
     */
    function _swapWithCurve(
        address poolAddress,
        address swapToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        CurvePoolIndices memory indices = curvePoolIndices[swapToken];

        // Note: Not all CurvePools return the `amountOut`, make sure
        // to use only pool that do. Otherwise the swap would revert
        // always
        amountOut = ICurvePool(poolAddress).exchange(
            uint256(indices.rewardTokenIndex),
            uint256(indices.baseTokenIndex),
            amountIn,
            minAmountOut
        );
    }
}
