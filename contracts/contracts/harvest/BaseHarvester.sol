// SPDX-License-Identifier: MIT
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

import "hardhat/console.sol";

abstract contract BaseHarvester is Governable {
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
        SwapPlatform platform,
        address swapRouterAddr,
        uint256 liquidationLimit,
        bool doSwapRewardToken
    );
    event RewardTokenSwapped(
        address indexed rewardToken,
        address indexed swappedInto,
        SwapPlatform platform,
        uint256 amountIn,
        uint256 amountOut
    );

    event RewardProceedsTransferred(
        address indexed token,
        address farmer,
        uint256 protocolShare,
        uint256 farmerShare
    );

    // Configuration properties for harvesting logic of reward tokens
    struct RewardTokenConfig {
        // Max allowed slippage when swapping reward token for a stablecoin denominated in basis points.
        uint16 allowedSlippageBps;
        // Reward when calling a harvest function denominated in basis points.
        uint16 harvestRewardBps;
        // Address of compatible exchange router (Uniswap V2, SushiSwap).
        address swapRouterAddr;
        /* When true the reward token is being swapped. In a need of (temporarily) disabling the swapping of
         * a reward token this needs to be set to false.
         */
        bool doSwapRewardToken;
        // Platform to use for Swapping
        SwapPlatform platform;
        /* How much token can be sold per one harvest call. If the balance of rewards tokens
         * exceeds that limit multiple harvest calls are required to harvest all of the tokens.
         * Set it to MAX_INT to effectively disable the limit.
         */
        uint256 liquidationLimit;
    }

    mapping(address => RewardTokenConfig) public rewardTokenConfigs;
    mapping(address => bool) public supportedStrategies;

    mapping(address => address[]) public uniswapV2Path;
    mapping(address => bytes) public uniswapV3Path;
    mapping(address => bytes32) public balancerPoolId;

    struct CurvePoolData {
        uint256 rewardTokenIndex;
        uint256 baseTokenIndex;
    }
    mapping(address => CurvePoolData) public curvePoolData;

    address public immutable vaultAddress;

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

    // "_usdtAddress" is set to Vault's address, but is really not used
    constructor(address _vaultAddress, address _baseTokenAddress) {
        require(_vaultAddress != address(0));
        require(_baseTokenAddress != address(0));
        vaultAddress = _vaultAddress;
        baseTokenAddress = _baseTokenAddress;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Throws if called by any address other than the Vault.
     */
    modifier onlyVaultOrGovernor() {
        require(
            msg.sender == vaultAddress || isGovernor(),
            "Caller is not the Vault or Governor"
        );
        _;
    }

    /**
     * Set the Address receiving rewards proceeds.
     * @param _rewardProceedsAddress Address of the reward token
     */
    function setRewardsProceedsAddress(address _rewardProceedsAddress)
        external
        onlyGovernor
    {
        require(
            _rewardProceedsAddress != address(0),
            "Rewards proceeds address should be a non zero address"
        );

        rewardProceedsAddress = _rewardProceedsAddress;
    }

    /**
     * @dev Add/update a reward token configuration that holds harvesting config variables
     * @param _tokenAddress Address of the reward token
     * @param tokenConfig.allowedSlippageBps uint16 maximum allowed slippage denominated in basis points.
     *        Example: 300 == 3% slippage
     * @param tokenConfig.harvestRewardBps uint16 amount of reward tokens the caller of the function is rewarded.
     *        Example: 100 == 1%
     * @param tokenConfig.swapRouterAddr Address Address of a UniswapV2 compatible contract to perform
     *        the exchange from reward tokens to stablecoin (currently hard-coded to USDT)
     * @param tokenConfig.liquidationLimit uint256 Maximum amount of token to be sold per one swap function call.
     *        When value is 0 there is no limit.
     * @param tokenConfig.doSwapRewardToken bool When true the reward token is being swapped. In a need of (temporarily)
     *        disabling the swapping of a reward token this needs to be set to false.
     * @param tokenConfig.platform SwapPlatform to use for Swapping
     * @param swapData Additional data required for swapping
     */
    function setRewardTokenConfig(
        address _tokenAddress,
        RewardTokenConfig calldata tokenConfig,
        // uint16 _allowedSlippageBps,
        // uint16 _harvestRewardBps,
        // SwapPlatform _platform,
        // address _swapRouterAddr,
        // uint256 _liquidationLimit,
        // bool _doSwapRewardToken,
        bytes calldata swapData
    ) external onlyGovernor {
        require(
            tokenConfig.allowedSlippageBps <= 1000,
            "Allowed slippage should not be over 10%"
        );
        require(
            tokenConfig.harvestRewardBps <= 1000,
            "Harvest reward fee should not be over 10%"
        );

        address newRouterAddress = tokenConfig.swapRouterAddr;
        require(
            newRouterAddress != address(0),
            "Swap router address should be non zero address"
        );

        // RewardTokenConfig memory tokenConfig = RewardTokenConfig({
        //     allowedSlippageBps: _allowedSlippageBps,
        //     harvestRewardBps: _harvestRewardBps,
        //     swapRouterAddr: _swapRouterAddr,
        //     doSwapRewardToken: _doSwapRewardToken,
        //     platform: _platform,
        //     liquidationLimit: _liquidationLimit
        // });

        SwapPlatform _platform = tokenConfig.platform;
        address oldRouterAddress = rewardTokenConfigs[_tokenAddress]
            .swapRouterAddr;
        rewardTokenConfigs[_tokenAddress] = tokenConfig;

        IERC20 token = IERC20(_tokenAddress);
        address priceProvider = IVault(vaultAddress).priceProvider();

        // Revert if feed does not exist
        // slither-disable-next-line unused-return
        IOracle(priceProvider).price(_tokenAddress);

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

        if (_platform == SwapPlatform.UniswapV2Compatible) {
            uniswapV2Path[_tokenAddress] = _decodeUniswapV2Path(swapData, _tokenAddress);
        } else if (_platform == SwapPlatform.UniswapV3) {
            uniswapV3Path[_tokenAddress] = _decodeUniswapV3Path(swapData, _tokenAddress);
        } else if (_platform == SwapPlatform.Balancer) {
            balancerPoolId[_tokenAddress] = _decodeBalancerPoolId(swapData);
        } else if (_platform == SwapPlatform.Curve) {
            curvePoolData[_tokenAddress] = _decodeCurvePool(swapData, newRouterAddress, _tokenAddress);
        } else {
            revert("Unknown SwapPlatfrom");
            // require(swapData.length == 0, "Invalid swapData");
        }

        emit RewardTokenConfigUpdated(
            _tokenAddress,
            tokenConfig.allowedSlippageBps,
            tokenConfig.harvestRewardBps,
            _platform,
            newRouterAddress,
            tokenConfig.liquidationLimit,
            tokenConfig.doSwapRewardToken
        );
    }

    function _decodeUniswapV2Path(bytes calldata data, address token) internal view returns (address[] memory path) {
        (path) = abi.decode(data, (address[]));

        // Do some validation
        require(
            path.length >= 2 
                && path[0] == token 
                && path[path.length - 1] == baseTokenAddress
        , "Invalid Uniswap V2 path");
    }

    function _decodeUniswapV3Path(bytes calldata data, address token) internal view returns (bytes calldata path) {
        path = data;

        // Do some validation
        bytes memory tokBytes = new bytes(20);
        for (uint256 i = 0; i < 20; ++i) {
            tokBytes[i] = path[i];
        }
        require(address(bytes20(tokBytes)) == token, "Invalid Reward Token in swap path");

        uint256 tok1Offset = path.length - 20;
        for (uint256 i = 0; i < 20; ++i) {
            tokBytes[i] = path[i + tok1Offset];
        }
        require(address(bytes20(tokBytes)) == baseTokenAddress, "Invalid Base Token in swap path");
    }

    // function testPure() external pure returns (bytes memory) {
    //     return abi.encodePacked(
    //         address(0xD533a949740bb3306d119CC777fa900bA034cd52),
    //         uint24(300),
    //         address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2),
    //         uint24(500),
    //         address(0xdAC17F958D2ee523a2206206994597C13D831ec7)
    //     );
    // }

    function _decodeBalancerPoolId(bytes calldata data) internal pure returns (bytes32 poolId) {
        (poolId) = abi.decode(data, (bytes32));

        // Do some validation
        require(poolId != bytes32(0), "Invalid Balancer Pool ID");
    }

    function _decodeCurvePool(bytes calldata data, address poolAddress, address token) internal view returns (CurvePoolData memory poolData) {
        (poolData) = abi.decode(data, (CurvePoolData));

        ICurvePool pool = ICurvePool(poolAddress);
        require(token == pool.coins(poolData.rewardTokenIndex), "Invalid Reward Token Index");
        require(baseTokenAddress == pool.coins(poolData.baseTokenIndex), "Invalid Base Token Index");
    }

    /**
     * @dev Flags a strategy as supported or not supported one
     * @param _strategyAddress Address of the strategy
     * @param _isSupported Bool marking strategy as supported or not supported
     */
    function setSupportedStrategy(address _strategyAddress, bool _isSupported)
        external
        onlyVaultOrGovernor
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
     * @dev Collect reward tokens from all strategies
     */
    function harvest() external onlyGovernor nonReentrant {
        _harvest();
    }

    /**
     * @dev Swap all supported swap tokens for stablecoins via Uniswap.
     */
    function swap() external onlyGovernor nonReentrant {
        _swap(rewardProceedsAddress);
    }

    /*
     * @dev Collect reward tokens from all strategies and swap for supported
     *      stablecoin via Uniswap
     */
    function harvestAndSwap() external onlyGovernor nonReentrant {
        _harvest();
        _swap(rewardProceedsAddress);
    }

    /**
     * @dev Collect reward tokens for a specific strategy.
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
        // Remember _harvest function checks for the validity of _strategyAddr
        _harvestAndSwap(_strategyAddr, msg.sender);
    }

    /**
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap. Can be called by anyone.
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
     * @dev Governance convenience function to swap a specific _rewardToken and send
     *       rewards to the vault.
     * @param _swapToken Address of the token to swap.
     */
    function swapRewardToken(address _swapToken)
        external
        onlyGovernor
        nonReentrant
    {
        _swap(_swapToken, rewardProceedsAddress);
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
     * @dev Collect reward tokens for a specific strategy and swap for supported
     *      stablecoin via Uniswap.
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
        require(
            supportedStrategies[_strategyAddr],
            "Not a valid strategy address"
        );

        IStrategy strategy = IStrategy(_strategyAddr);
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

            for (uint256 j = 0; j < rewardTokenAddresses.length; ++j) {
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
    function _swap(address _swapToken, address _rewardTo) internal virtual {
        RewardTokenConfig memory tokenConfig = rewardTokenConfigs[_swapToken];

        if (tokenConfig.platform == SwapPlatform.UniswapV2Compatible) {
            _swap(_swapToken, _rewardTo, _swapWithUniswapV2);
        } else if (tokenConfig.platform == SwapPlatform.UniswapV3) {
            _swap(_swapToken, _rewardTo, _swapWithUniswapV3);
        } else if (tokenConfig.platform == SwapPlatform.Balancer) {
            _swap(_swapToken, _rewardTo, _swapWithBalancer);
        } else if (tokenConfig.platform == SwapPlatform.Curve) {
            _swap(_swapToken, _rewardTo, _swapWithCurve);
        } else {
            revert("Unknown swap platform");
        }
    }

    function _swap(
        address _swapToken,
        address _rewardTo,
        function(RewardTokenConfig memory, address, uint256, uint256) returns (uint256) swapper
    ) internal virtual {
        RewardTokenConfig memory tokenConfig = rewardTokenConfigs[_swapToken];

        /* This will trigger a return when reward token configuration has not yet been set
         * or we have temporarily disabled swapping of specific reward token via setting
         * doSwapRewardToken to false.
         */
        if (!tokenConfig.doSwapRewardToken) {
            return;
        }

        {
            address priceProvider = IVault(vaultAddress).priceProvider();
            IERC20 swapToken = IERC20(_swapToken);
            uint256 balance = swapToken.balanceOf(address(this));

            if (balance == 0) {
                return;
            }

            if (tokenConfig.liquidationLimit > 0) {
                balance = Math.min(balance, tokenConfig.liquidationLimit);

            }

            // This'll revert if there is no price feed
            uint256 oraclePrice = IOracle(priceProvider).price(_swapToken);

            // Oracle price is 1e18
            uint256 minExpected = (balance *
                (1e4 - tokenConfig.allowedSlippageBps) * // max allowed slippage
                oraclePrice).scaleBy(Helpers.getDecimals(baseTokenAddress), Helpers.getDecimals(_swapToken)) /
                1e4 / // fix the max slippage decimal position
                1e18; // and oracle price decimals position
            
            // Do the swap
            uint256 amountReceived = swapper(
                tokenConfig,
                _swapToken,
                balance,
                minExpected
            );
            emit RewardTokenSwapped(_swapToken, baseTokenAddress, tokenConfig.platform, balance, amountReceived);
        }

        IERC20 desiredToken = IERC20(baseTokenAddress);
        uint256 desiredTokenBalance = desiredToken.balanceOf(address(this));

        uint256 vaultBps = 1e4 - tokenConfig.harvestRewardBps;
        uint256 rewardsProceedsShare = (desiredTokenBalance * vaultBps) / 1e4;

        require(
            vaultBps > tokenConfig.harvestRewardBps,
            "Address receiving harvest incentive is receiving more rewards than the rewards proceeds address"
        );

        uint256 farmerShare = desiredTokenBalance - rewardsProceedsShare;

        desiredToken.safeTransfer(rewardProceedsAddress, rewardsProceedsShare);
        desiredToken.safeTransfer(
            _rewardTo,
            farmerShare // remaining share of the rewards
        );
        emit RewardProceedsTransferred(
            baseTokenAddress,
            _rewardTo,
            rewardsProceedsShare,
            farmerShare
        );
    }

    function _swapWithUniswapV2(RewardTokenConfig memory tokenConfig, address swapToken, uint256 amountIn, uint256 minAmountOut) internal returns (uint256 amountOut) {
        address[] memory path = uniswapV2Path[swapToken];
        require(path.length >= 2, "Swap path not configured");

        uint256[] memory amounts = IUniswapV2Router(tokenConfig.swapRouterAddr)
            .swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                path,
                address(this),
                block.timestamp
            );

        amountOut = amounts[amounts.length - 1];
    }
    // function _getUniV2SwapPath(address token) internal virtual returns (address[] memory);

    function _swapWithUniswapV3(RewardTokenConfig memory tokenConfig, address swapToken, uint256 amountIn, uint256 minAmountOut) internal returns (uint256 amountOut) {
        bytes memory path = uniswapV3Path[swapToken];
        require(path.length > 0, "Swap path not configured");

        IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router.ExactInputParams({
            path: path,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut
        });
        amountOut = IUniswapV3Router(tokenConfig.swapRouterAddr).exactInput(params);
    }
    // function _getUniV3SwapPath(address token) internal virtual returns (bytes memory);

    function _swapWithBalancer(RewardTokenConfig memory tokenConfig, address swapToken, uint256 amountIn, uint256 minAmountOut) internal returns (uint256 amountOut) {
        bytes32 poolId = balancerPoolId[swapToken];
        require(poolId != bytes32(0), "Pool ID not configured");

        IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap({
            poolId: poolId,
            kind: IBalancerVault.SwapKind.GIVEN_IN,
            assetIn: swapToken,
            assetOut: baseTokenAddress,
            amount: amountIn,
            userData: hex""
        });

        IBalancerVault.FundManagement memory fundMgmt = IBalancerVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(address(this)),
            toInternalBalance: false
        });

        amountOut = IBalancerVault(tokenConfig.swapRouterAddr)
            .swap(singleSwap, fundMgmt, minAmountOut, block.timestamp);
    }

    function _swapWithCurve(RewardTokenConfig memory tokenConfig, address swapToken, uint256 amountIn, uint256 minAmountOut) internal returns (uint256 amountOut) {
        CurvePoolData memory poolData = curvePoolData[swapToken];

        amountOut = ICurvePool(tokenConfig.swapRouterAddr).exchange(
            poolData.rewardTokenIndex,
            poolData.baseTokenIndex,
            amountIn,
            minAmountOut
        );
    }
}
