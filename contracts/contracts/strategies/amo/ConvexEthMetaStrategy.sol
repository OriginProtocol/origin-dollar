// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/ETH pool
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { BaseConvexAMOStrategy } from "./BaseConvexAMOStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";

contract ConvexEthMetaStrategy is BaseConvexAMOStrategy {
    using SafeERC20 for IERC20;

    // Added for backward compatibility
    IERC20 public immutable oeth;
    IWETH9 public immutable weth;
    // Added for backward compatibility
    uint128 public constant oethCoinIndex = 1;
    uint128 public constant ethCoinIndex = 0;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexAMOConfig memory _convexConfig
    ) BaseConvexAMOStrategy(_baseConfig, _convexConfig) {
        oeth = IERC20(_convexConfig.oTokenAddress);
        weth = IWETH9(_convexConfig.assetAddress);
    }

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    function _unwrapAsset(uint256 _amount) internal override {
        weth.withdraw(_amount);
    }

    function _wrapAsset(uint256 amount) internal override {
        // Convert ETH to WETH
        weth.deposit{ value: amount }();
    }

    function _wrapAsset() internal override returns (uint256 assets) {
        // Get ETH balance of this strategy contract
        assets = address(this).balance;
        // Convert ETH to WETH
        weth.deposit{ value: assets }();
    }

    /***************************************
                    Curve Pool
    ****************************************/

    function _addLiquidityToPool(
        uint256[2] memory _amounts,
        uint256 minMintAmount
    ) internal override returns (uint256 lpDeposited) {
        // Do the deposit to the Curve pool
        // slither-disable-next-line arbitrary-send
        lpDeposited = curvePool.add_liquidity{
            value: _amounts[assetCoinIndex]
        }(_amounts, minMintAmount);
    }

    /***************************************
                    Withdraw
    ****************************************/

    /***************************************
                Asset Balance
    ****************************************/

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(
        address _asset
    ) public view override returns (uint256 balance) {
        require(_asset == address(asset), "Unsupported asset");

        // Eth balance needed here for the balance check that happens from vault during depositing.
        balance = address(this).balance;
        uint256 lpTokens = cvxRewardStaker.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * curvePool.get_virtual_price()) / 1e18;
        }
    }

    /***************************************
                    Approvals
    ****************************************/

    /**
     * @notice Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
    }

    /**
     * @notice Accept unwrapped WETH
     */
    receive() external payable {}

    /**
     * @dev Since we are unwrapping WETH before depositing it to Curve
     *      there is no need to to set an approval for WETH on the Curve
     *      pool
     * @param _asset Address of the asset
     * @param _pToken Address of the Curve LP token
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(
        address _asset,
        address _pToken
    ) internal override {}

    function _approveBase() internal override {
        // Approve Curve pool for OETH (required for adding liquidity)
        // No approval is needed for ETH
        // slither-disable-next-line unused-return
        oeth.approve(platformAddress, type(uint256).max);

        // Approve Convex deposit contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Convex rewards pool
        // slither-disable-next-line unused-return
        lpToken.approve(cvxDepositorAddress, type(uint256).max);
    }
}
