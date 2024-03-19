// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ICVXLocker } from "../interfaces/ICVXLocker.sol";
import { ISwapper } from "../interfaces/ISwapper.sol";

import { Initializable } from "../utils/Initializable.sol";

abstract contract BaseBuyback is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    event SwapRouterUpdated(address indexed _address);

    event RewardsSourceUpdated(address indexed _address);
    event TreasuryManagerUpdated(address indexed _address);

    // Emitted whenever OUSD/OETH is swapped for OGV/CVX or any other token
    event OTokenBuyback(
        address indexed oToken,
        address indexed swappedFor,
        uint256 swapAmountIn,
        uint256 minExpected
    );

    // Address of 1-inch Swap Router
    address public swapRouter;

    // slither-disable-next-line constable-states
    address private __deprecated_ousd;
    // slither-disable-next-line constable-states
    address private __deprecated_ogv;
    // slither-disable-next-line constable-states
    address private __deprecated_usdt;
    // slither-disable-next-line constable-states
    address private __deprecated_weth9;

    // Address that receives OGV after swaps
    address public rewardsSource;

    // Address that receives all other tokens after swaps
    address public treasuryManager;

    // slither-disable-next-line constable-states
    uint256 private __deprecated_treasuryBps;

    address public immutable oToken;
    address public immutable ogv;
    address public immutable cvx;
    address public immutable cvxLocker;

    // Amount of `oTokens` to use for OGV buyback
    uint256 public ogvShare;

    // Amount of `oTokens` to use for CVX buyback
    uint256 public cvxShare;

    constructor(
        address _oToken,
        address _ogv,
        address _cvx,
        address _cvxLocker
    ) {
        // Make sure nobody owns the implementation contract
        _setGovernor(address(0));

        oToken = _oToken;
        ogv = _ogv;
        cvx = _cvx;
        cvxLocker = _cvxLocker;
    }

    /**
     * @param _swapRouter Address of Uniswap V3 Router
     * @param _strategistAddr Address of Strategist multi-sig wallet
     * @param _treasuryManagerAddr Address that receives the treasury's share of OUSD
     * @param _rewardsSource Address of RewardsSource contract
     */
    function initialize(
        address _swapRouter,
        address _strategistAddr,
        address _treasuryManagerAddr,
        address _rewardsSource
    ) external onlyGovernor initializer {
        _setStrategistAddr(_strategistAddr);

        _setSwapRouter(_swapRouter);
        _setRewardsSource(_rewardsSource);

        _setTreasuryManager(_treasuryManagerAddr);
    }

    /**
     * @dev Set address of Uniswap Universal Router for performing liquidation
     * of platform fee tokens. Setting to 0x0 will pause swaps.
     *
     * @param _router Address of the Uniswap Universal router
     */
    function setSwapRouter(address _router) external onlyGovernor {
        _setSwapRouter(_router);
    }

    function _setSwapRouter(address _router) internal {
        address oldRouter = swapRouter;
        swapRouter = _router;

        if (oldRouter != address(0)) {
            // Remove allowance of old router, if any

            if (IERC20(ogv).allowance(address(this), oldRouter) > 0) {
                // slither-disable-next-line unused-return
                IERC20(ogv).safeApprove(oldRouter, 0);
            }

            if (IERC20(cvx).allowance(address(this), oldRouter) > 0) {
                // slither-disable-next-line unused-return
                IERC20(cvx).safeApprove(oldRouter, 0);
            }
        }

        emit SwapRouterUpdated(_router);
    }

    /**
     * @dev Sets the address that receives the OGV buyback rewards
     * @param _address Address
     */
    function setRewardsSource(address _address) external onlyGovernor {
        _setRewardsSource(_address);
    }

    function _setRewardsSource(address _address) internal {
        require(_address != address(0), "Address not set");
        rewardsSource = _address;
        emit RewardsSourceUpdated(_address);
    }

    /**
     * @dev Sets the address that can receive and manage the funds for Treasury
     * @param _address Address
     */
    function setTreasuryManager(address _address) external onlyGovernor {
        _setTreasuryManager(_address);
    }

    function _setTreasuryManager(address _address) internal {
        require(_address != address(0), "Address not set");
        treasuryManager = _address;
        emit TreasuryManagerUpdated(_address);
    }

    /**
     * @dev Computes the split of oToken balance that can be
     *      used for OGV and CVX buybacks.
     */
    function _updateBuybackSplits()
        internal
        returns (uint256 _ogvShare, uint256 _cvxShare)
    {
        _ogvShare = ogvShare;
        _cvxShare = cvxShare;

        uint256 totalBalance = IERC20(oToken).balanceOf(address(this));
        uint256 unsplitBalance = totalBalance - _ogvShare - _cvxShare;

        // Check if all balance is accounted for
        if (unsplitBalance > 0) {
            // If not, split unaccounted balance 50:50
            uint256 halfBalance = unsplitBalance / 2;
            _cvxShare = _cvxShare + halfBalance;
            _ogvShare = _ogvShare + unsplitBalance - halfBalance;

            // Update storage
            ogvShare = _ogvShare;
            cvxShare = _cvxShare;
        }
    }

    function updateBuybackSplits() external onlyGovernor {
        // slither-disable-next-line unused-return
        _updateBuybackSplits();
    }

    function _swapToken(
        address tokenOut,
        uint256 oTokenAmount,
        uint256 minAmountOut,
        bytes calldata swapData
    ) internal returns (uint256 amountOut) {
        require(oTokenAmount > 0, "Invalid Swap Amount");
        require(swapRouter != address(0), "Swap Router not set");
        require(minAmountOut > 0, "Invalid minAmount");

        // Transfer OToken to Swapper for swapping
        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(oToken).transfer(swapRouter, oTokenAmount);

        // Swap
        amountOut = ISwapper(swapRouter).swap(
            oToken,
            tokenOut,
            oTokenAmount,
            minAmountOut,
            swapData
        );

        require(amountOut >= minAmountOut, "Higher Slippage");

        emit OTokenBuyback(oToken, tokenOut, minAmountOut, amountOut);
    }

    /**
     * @dev Swaps `oTokenAmount` to OGV
     * @param oTokenAmount Amount of OUSD/OETH to swap
     * @param minOGV Minimum OGV to receive for oTokenAmount
     * @param swapData 1inch Swap Data
     */
    function swapForOGV(
        uint256 oTokenAmount,
        uint256 minOGV,
        bytes calldata swapData
    ) external onlyGovernorOrStrategist nonReentrant {
        (uint256 _ogvAmount, ) = _updateBuybackSplits();
        require(_ogvAmount >= oTokenAmount, "Balance underflow");
        require(rewardsSource != address(0), "RewardsSource contract not set");

        // Subtract the amount to swap from net balance
        ogvShare = _ogvAmount - oTokenAmount;

        uint256 ogvReceived = _swapToken(ogv, oTokenAmount, minOGV, swapData);

        // Transfer OGV received to RewardsSource contract
        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(ogv).transfer(rewardsSource, ogvReceived);
    }

    /**
     * @dev Swaps `oTokenAmount` to CVX
     * @param oTokenAmount Amount of OUSD/OETH to swap
     * @param minCVX Minimum CVX to receive for oTokenAmount
     * @param swapData 1inch Swap Data
     */
    function swapForCVX(
        uint256 oTokenAmount,
        uint256 minCVX,
        bytes calldata swapData
    ) external onlyGovernorOrStrategist nonReentrant {
        (, uint256 _cvxAmount) = _updateBuybackSplits();
        require(_cvxAmount >= oTokenAmount, "Balance underflow");

        // Subtract the amount to swap from net balance
        cvxShare = _cvxAmount - oTokenAmount;

        uint256 cvxReceived = _swapToken(cvx, oTokenAmount, minCVX, swapData);

        // Lock all CVX
        _lockAllCVX(cvxReceived);
    }

    /**
     * @dev Locks all CVX held by the contract on behalf of the Treasury Manager
     */
    function lockAllCVX() external onlyGovernorOrStrategist {
        _lockAllCVX(IERC20(cvx).balanceOf(address(this)));
    }

    function _lockAllCVX(uint256 cvxAmount) internal {
        require(
            treasuryManager != address(0),
            "Treasury manager address not set"
        );

        // Lock all available CVX on behalf of `treasuryManager`
        ICVXLocker(cvxLocker).lock(treasuryManager, cvxAmount, 0);
    }

    /**
     * @dev Approve CVX Locker to move CVX held by this contract
     */
    function safeApproveAllTokens() external onlyGovernorOrStrategist {
        IERC20(cvx).safeApprove(cvxLocker, type(uint256).max);
    }

    /**
     * @notice Owner function to withdraw a specific amount of a token
     * @param token token to be transferered
     * @param amount amount of the token to be transferred
     */
    function transferToken(address token, uint256 amount)
        external
        onlyGovernor
        nonReentrant
    {
        IERC20(token).safeTransfer(_governor(), amount);
    }
}
