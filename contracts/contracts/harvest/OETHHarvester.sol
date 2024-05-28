// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IUniswapV3Router } from "../interfaces/uniswap/IUniswapV3Router.sol";
import { IBalancerVault } from "../interfaces/balancer/IBalancerVault.sol";
import { ICurvePool } from "../strategies/ICurvePool.sol";
import "../utils/Helpers.sol";
import { AbstractHarvesterBase } from "./AbstractHarvesterBase.sol";

contract OETHHarvester is AbstractHarvesterBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    enum SwapPlatform {
        UniswapV2Compatible,
        UniswapV3,
        Balancer,
        Curve
    }

    error InvalidUniswapV2PathLength();
    error EmptyBalancerPoolId();
    error InvalidCurvePoolAssetIndex(address token);

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
        _validateConfigAndApproveTokens(_tokenAddress, tokenConfig);
        address newRouterAddress = tokenConfig.swapPlatformAddr;

        SwapPlatform _platform = SwapPlatform(tokenConfig.swapPlatform);
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
            revert InvalidSwapPlatform(uint8(_platform));
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

    function _doSwap(
        uint8 swapPlatform,
        address routerAddress,
        address rewardTokenAddress,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal virtual override returns (uint256 amountOut) {
        SwapPlatform _swapPlatform = SwapPlatform(swapPlatform);
        if (_swapPlatform == SwapPlatform.UniswapV2Compatible) {
            return
                _swapWithUniswapV2(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else if (_swapPlatform == SwapPlatform.UniswapV3) {
            return
                _swapWithUniswapV3(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else if (_swapPlatform == SwapPlatform.Balancer) {
            return
                _swapWithBalancer(
                    routerAddress,
                    rewardTokenAddress,
                    amountIn,
                    minAmountOut
                );
        } else if (_swapPlatform == SwapPlatform.Curve) {
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
