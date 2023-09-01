// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/ETH pool
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { BaseConvexAMOStrategy } from "./BaseConvexAMOStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";

contract ConvexEthMetaStrategy is BaseConvexAMOStrategy {
    using SafeERC20 for IERC20;

    // Added for backward compatibility
    address public immutable oeth;
    address public immutable weth;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexAMOConfig memory _convexConfig
    ) BaseConvexAMOStrategy(_baseConfig, _convexConfig) {
        oeth = _convexConfig.oTokenAddress;
        weth = _convexConfig.assetAddress;
    }

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev Unwraps the ETH from WETH using WETH withdraw
    function _toPoolAsset(address, uint256 amount)
        internal
        override
        returns (uint256 poolAssets)
    {
        IWETH9(address(asset)).withdraw(amount);
        poolAssets = amount;
    }

    /// @dev Converts ETH pool assets to WETH vault assets
    function _toVaultAsset(address, uint256 amount) internal override {
        // Convert ETH to WETH
        IWETH9(address(asset)).deposit{ value: amount }();
    }

    /// @dev Gets the ETH balance of this strategy contract
    /// and then converts all the ETH to WETH
    function _toVaultAsset() internal override returns (uint256 assets) {
        // Get ETH balance of this strategy contract
        assets = address(this).balance;
        // Convert ETH to WETH
        IWETH9(address(asset)).deposit{ value: assets }();
    }

    /***************************************
                    Curve Pool
    ****************************************/

    /// @dev Adds OETH and/or ETH to the Curve pool
    /// @param amounts The amount of ETH and OETH to add to the pool
    function _addLiquidityToPool(
        uint256[2] memory amounts,
        uint256 minMintAmount
    ) internal override returns (uint256 lpDeposited) {
        // slither-disable-next-line arbitrary-send
        lpDeposited = curvePool.add_liquidity{ value: amounts[assetCoinIndex] }(
            amounts,
            minMintAmount
        );
    }

    /***************************************
                Asset Balance
    ****************************************/

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
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
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal override {
        // Approve Curve pool for OETH (required for adding liquidity)
        // No approval is needed for ETH
        // slither-disable-next-line unused-return
        oToken.approve(platformAddress, type(uint256).max);

        // Approve Convex deposit contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Convex rewards pool
        // slither-disable-next-line unused-return
        lpToken.approve(cvxDepositorAddress, type(uint256).max);
    }
}
