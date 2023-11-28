// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IUniswapUniversalRouter } from "../interfaces/uniswap/IUniswapUniversalRouter.sol";
import { ICVXLocker } from "../interfaces/ICVXLocker.sol";

import { Initializable } from "../utils/Initializable.sol";

abstract contract BaseBuyback is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    event UniswapUniversalRouterUpdated(address indexed _address);

    event RewardsSourceUpdated(address indexed _address);
    event TreasuryManagerUpdated(address indexed _address);

    // Emitted whenever OUSD/OETH is swapped for OGV/CVX or any other token
    event OTokenBuyback(
        address indexed oToken,
        address indexed swappedFor,
        uint256 swapAmountIn,
        uint256 minExpected
    );

    // Address of Uniswap Universal Router
    address public universalRouter;

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

    // Ref: https://docs.uniswap.org/contracts/universal-router/technical-reference#command-structure
    bytes private constant swapCommand = hex"0000";

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
     * @param _uniswapUniversalRouter Address of Uniswap V3 Router
     * @param _strategistAddr Address of Strategist multi-sig wallet
     * @param _treasuryManagerAddr Address that receives the treasury's share of OUSD
     * @param _rewardsSource Address of RewardsSource contract
     */
    function initialize(
        address _uniswapUniversalRouter,
        address _strategistAddr,
        address _treasuryManagerAddr,
        address _rewardsSource
    ) external onlyGovernor initializer {
        _setStrategistAddr(_strategistAddr);

        _setUniswapUniversalRouter(_uniswapUniversalRouter);
        _setRewardsSource(_rewardsSource);

        _setTreasuryManager(_treasuryManagerAddr);
    }

    /**
     * @dev Set address of Uniswap Universal Router for performing liquidation
     * of platform fee tokens. Setting to 0x0 will pause swaps.
     *
     * @param _router Address of the Uniswap Universal router
     */
    function setUniswapUniversalRouter(address _router) external onlyGovernor {
        _setUniswapUniversalRouter(_router);
    }

    function _setUniswapUniversalRouter(address _router) internal {
        universalRouter = _router;

        emit UniswapUniversalRouterUpdated(_router);
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
     * @dev Swaps half of `oTokenAmount` to OGV
     *      and the rest to CVX and finally lock up CVX
     * @param oTokenAmount Amount of OUSD/OETH to swap
     * @param minOGV Minimum OGV to receive for oTokenAmount/2
     * @param minCVX Minimum CVX to receive for oTokenAmount/2
     */
    function swap(
        uint256 oTokenAmount,
        uint256 minOGV,
        uint256 minCVX
    ) external onlyGovernorOrStrategist nonReentrant {
        require(oTokenAmount > 0, "Invalid Swap Amount");
        require(universalRouter != address(0), "Uniswap Router not set");
        require(rewardsSource != address(0), "RewardsSource contract not set");
        require(minOGV > 0, "Invalid minAmount for OGV");
        require(minCVX > 0, "Invalid minAmount for CVX");

        uint256 ogvBalanceBefore = IERC20(ogv).balanceOf(rewardsSource);
        uint256 cvxBalanceBefore = IERC20(cvx).balanceOf(address(this));

        uint256 amountInForOGV = oTokenAmount / 2;
        uint256 amountInForCVX = oTokenAmount - amountInForOGV;

        // Build swap input
        bytes[] memory inputs = new bytes[](2);

        inputs[0] = abi.encode(
            // Send swapped OGV directly to RewardsSource contract
            rewardsSource,
            amountInForOGV,
            minOGV,
            _getSwapPath(ogv),
            false
        );

        inputs[1] = abi.encode(
            // Buyback contract receives the CVX to lock it on
            // behalf of Strategist after the swap
            address(this),
            amountInForCVX,
            minCVX,
            _getSwapPath(cvx),
            false
        );

        // Transfer OToken to UniversalRouter for swapping
        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(oToken).transfer(universalRouter, oTokenAmount);

        // Execute the swap
        IUniswapUniversalRouter(universalRouter).execute(
            swapCommand,
            inputs,
            block.timestamp
        );

        // Uniswap's Universal Router doesn't return the `amountOut` values/
        // So, the events just calculate the tokens received by doing a balance diff
        emit OTokenBuyback(
            oToken,
            ogv,
            amountInForOGV,
            IERC20(ogv).balanceOf(rewardsSource) - ogvBalanceBefore
        );
        emit OTokenBuyback(
            oToken,
            cvx,
            amountInForCVX,
            IERC20(cvx).balanceOf(address(this)) - cvxBalanceBefore
        );

        // Lock all CVX
        _lockAllCVX();
    }

    /**
     * @dev Locks all CVX held by the contract on behalf of the Treasury Manager
     */
    function lockAllCVX() external onlyGovernorOrStrategist {
        _lockAllCVX();
    }

    function _lockAllCVX() internal {
        require(
            treasuryManager != address(0),
            "Treasury manager address not set"
        );

        // Lock all available CVX on behalf of `treasuryManager`
        ICVXLocker(cvxLocker).lock(
            treasuryManager,
            IERC20(cvx).balanceOf(address(this)),
            0
        );
    }

    /**
     * @dev Approve CVX Locker to move CVX held by this contract
     */
    function safeApproveAllTokens() external onlyGovernorOrStrategist {
        IERC20(cvx).safeApprove(cvxLocker, type(uint256).max);
        // Remove Router's allowance if any
        // slither-disable-next-line unused-return
        IERC20(oToken).approve(universalRouter, 0);
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

    /**
     * @notice Returns the Swap path to use on Uniswap from oToken to `toToken`
     * @param toToken Target token
     */
    function _getSwapPath(address toToken)
        internal
        view
        virtual
        returns (bytes memory);
}
