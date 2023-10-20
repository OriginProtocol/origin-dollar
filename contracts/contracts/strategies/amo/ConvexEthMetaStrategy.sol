// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/ETH pool
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BaseConvexAMOStrategy } from "./BaseConvexAMOStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";

contract ConvexEthMetaStrategy is BaseConvexAMOStrategy {
    // The following slots have been deprecated with immutable variables
    // slither-disable-next-line constable-states
    address private _deprecated_cvxDepositorAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_cvxRewardStaker;
    // slither-disable-next-line constable-states
    uint256 private _deprecated_cvxDepositorPTokenId;
    // slither-disable-next-line constable-states
    address private _deprecated_curvePool;
    // slither-disable-next-line constable-states
    address private _deprecated_lpToken;
    // slither-disable-next-line constable-states
    address private _deprecated_oeth;
    // slither-disable-next-line constable-states
    address private _deprecated_weth;

    // Ordered list of pool assets
    // slither-disable-next-line constable-states
    uint128 private _deprecated_oethCoinIndex = 1;
    // slither-disable-next-line constable-states
    uint128 private _deprecated_ethCoinIndex = 0;

    // Added for backward compatibility
    address public immutable oeth;
    address public immutable weth;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        AMOConfig memory _amoConfig,
        ConvexConfig memory _convexConfig
    ) BaseConvexAMOStrategy(_baseConfig, _amoConfig, _convexConfig) {
        oeth = _amoConfig.oTokenAddress;
        weth = _amoConfig.assetAddress;
    }

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev Unwraps the ETH from WETH using WETH withdraw
    function _toPoolAsset(address, uint256 wethAmount)
        internal
        override
        returns (uint256 ethAmount)
    {
        IWETH9(address(asset)).withdraw(wethAmount);
        ethAmount = wethAmount;
    }

    function _calcPoolAsset(address, uint256 wethAmount)
        internal
        pure
        override
        returns (uint256 ethAmount)
    {
        ethAmount = wethAmount;
    }

    /// @dev The OETH OToken is 1:1 to ETH so return the ETH amount
    function _toOTokens(uint256 ethAmount)
        internal
        pure
        override
        returns (uint256 oethAmount)
    {
        oethAmount = ethAmount;
    }

    /***************************************
            Curve Pool Withdrawals
    ****************************************/

    function _withdrawAsset(
        address,
        uint256 vaultAssetAmount,
        address recipient
    ) internal override {
        // Convert ETH to WETH
        IWETH9(address(asset)).deposit{ value: vaultAssetAmount }();

        // Transfer the WETH to the Vault
        require(
            asset.transfer(recipient, vaultAssetAmount),
            "WETH transfer failed"
        );

        emit Withdrawal(address(asset), address(lpToken), vaultAssetAmount);
    }

    /// @dev Gets the ETH balance of this strategy contract
    /// and then converts all the ETH to WETH
    function _withdrawAllAsset(address recipient) internal override {
        // Get ETH balance of this strategy contract
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            _withdrawAsset(address(asset), ethBalance, recipient);
        }
    }

    /***************************************
                Asset Balance
    ****************************************/

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    ETH value of both OETH and ETH in the Curve pool
     */
    function checkBalance(address _asset)
        public
        view
        override
        onlyAsset(_asset)
        returns (uint256 balance)
    {
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
