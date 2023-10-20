// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IUniswapUniversalRouter } from "../interfaces/IUniswapUniversalRouter.sol";
import { ICVXLocker } from "../interfaces/ICVXLocker.sol";

import { Initializable } from "../utils/Initializable.sol";

contract Buyback is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    event UniswapUniversalRouterUpdated(address indexed _address);

    event RewardsSourceUpdated(address indexed _address);
    event TreasuryManagerUpdated(address indexed _address);

    // Deprecated in favour of `OTokenBuyback` but not removed as to not break analytics backend
    event OUSDSwapped(
        address indexed token,
        uint256 swapAmountIn,
        uint256 swapAmountOut
    );

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

    address public immutable oeth;
    address public immutable ousd;
    address public immutable ogv;
    address public immutable usdt;
    address public immutable weth9;
    address public immutable cvx;
    address public immutable cvxLocker;

    constructor(
        address _oeth,
        address _ousd,
        address _ogv,
        address _usdt,
        address _weth,
        address _cvx,
        address _cvxLocker
    ) {
        // Make sure nobody owns the implementation contract
        _setGovernor(address(0));

        oeth = _oeth;
        ousd = _ousd;
        ogv = _ogv;
        usdt = _usdt;
        weth9 = _weth;
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
        if (universalRouter != address(0)) {
            // Remove previous router's allowance
            IERC20(ousd).approve(universalRouter, 0);
            IERC20(oeth).approve(universalRouter, 0);
        }

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
     * @dev Swaps half of `oethAmount` to OGV
     *      and the rest to CVX and finally lock CVX up
     * @param oethAmount Amount of OETH to swap
     * @param minOGV Minimum OGV to receive for oethAmount/2
     * @param minCVX Minimum CVX to receive for oethAmount/2
     */
    function swapOETH(
        uint256 oethAmount,
        uint256 minOGV,
        uint256 minCVX
    ) external onlyGovernorOrStrategist nonReentrant {
        require(oethAmount > 0, "Invalid Swap Amount");
        _swap(oethAmount, minOGV, minCVX, 0, 0, 0);
    }

    /**
     * @dev Swaps half of `ousdAmount` to OGV
     *      and the rest to CVX and finally lock CVX up
     * @param ousdAmount Amount of OUSD to swap
     * @param minOGV Minimum OGV to receive for ousdAmount/2
     * @param minCVX Minimum CVX to receive for ousdAmount/2
     */
    function swapOUSD(
        uint256 ousdAmount,
        uint256 minOGV,
        uint256 minCVX
    ) external onlyGovernorOrStrategist nonReentrant {
        require(ousdAmount > 0, "Invalid Swap Amount");
        _swap(0, 0, 0, ousdAmount, minOGV, minCVX);
    }

    /**
     * @dev Swaps half of `oethAmount` to OGV
     *      and the rest to CVX and finally lock up CVX
     * @param oethAmount Amount of OETH to swap
     * @param minOGVForOETH Minimum OGV to receive for oethAmount/2
     * @param minCVXForOETH Minimum CVX to receive for oethAmount/2
     * @param ousdAmount Amount of OUSD to swap
     * @param minOGVForOUSD Minimum OGV to receive for ousdAmount/2
     * @param minCVXForOUSD Minimum CVX to receive for ousdAmount/2
     */
    function swap(
        uint256 oethAmount,
        uint256 minOGVForOETH,
        uint256 minCVXForOETH,
        uint256 ousdAmount,
        uint256 minOGVForOUSD,
        uint256 minCVXForOUSD
    ) external onlyGovernorOrStrategist nonReentrant {
        require(oethAmount > 0 && ousdAmount > 0, "Invalid Swap Amounts");
        _swap(
            oethAmount,
            minOGVForOETH,
            minCVXForOETH,
            ousdAmount,
            minOGVForOUSD,
            minCVXForOUSD
        );
    }

    function _swap(
        uint256 oethAmount,
        uint256 minOGVForOETH,
        uint256 minCVXForOETH,
        uint256 ousdAmount,
        uint256 minOGVForOUSD,
        uint256 minCVXForOUSD
    ) internal {
        require(universalRouter != address(0), "Uniswap Router not set");
        require(rewardsSource != address(0), "RewardsSource contract not set");

        bool swapAll = oethAmount > 0 && ousdAmount > 0;
        uint256 swapCount;
        bytes memory commands;

        if (swapAll) {
            commands = hex"00000000";
            swapCount = 4;
        } else {
            commands = hex"0000";
            swapCount = 2;
        }

        bytes[] memory inputs = new bytes[](swapCount);

        if (oethAmount > 0) {
            require(minOGVForOETH > 0, "Invalid minAmount for OETH>OGV");
            require(minCVXForOETH > 0, "Invalid minAmount for OETH>CVX");

            // OETH to OGV
            inputs[0] = abi.encode(
                rewardsSource,
                oethAmount / 2,
                minOGVForOETH,
                abi.encodePacked(
                    oeth,
                    uint24(500), // 0.05% Pool fee, oeth -> weth9
                    weth9,
                    uint24(3000), // 0.3% Pool fee, weth9 -> ogv
                    ogv
                ),
                false
            );

            // OETH to CVX
            inputs[1] = abi.encode(
                address(this),
                oethAmount / 2,
                minCVXForOETH,
                abi.encodePacked(
                    oeth,
                    uint24(500), // 0.05% Pool fee, oeth -> weth9
                    weth9,
                    uint24(10000), // 1% Pool fee, weth9 -> CVX
                    cvx
                ),
                false
            );

            // Transfer OETH to UniversalRouter for swapping
            IERC20(oeth).safeTransfer(universalRouter, oethAmount);

            // Uniswap's Universal Router doesn't return the `amountOut` values
            // So, the events just emit the minExpected param
            emit OTokenBuyback(oeth, ogv, oethAmount / 2, minOGVForOETH);
            emit OTokenBuyback(oeth, cvx, oethAmount / 2, minCVXForOETH);
        }

        if (ousdAmount > 0) {
            require(minOGVForOUSD > 0, "Invalid minAmount for OUSD>OGV");
            require(minCVXForOUSD > 0, "Invalid minAmount for OUSD>CVX");

            // OUSD to OGV
            inputs[swapCount - 2] = abi.encode(
                rewardsSource,
                ousdAmount / 2,
                minOGVForOUSD,
                abi.encodePacked(
                    ousd,
                    uint24(500), // 0.05% Pool fee, ousd -> usdt
                    usdt,
                    uint24(500), // 0.05% Pool fee, usdt -> weth9
                    weth9,
                    uint24(3000), // 0.3% Pool fee, weth9 -> ogv
                    ogv
                ),
                false
            );

            // OUSD to CVX
            inputs[swapCount - 1] = abi.encode(
                address(this),
                ousdAmount / 2,
                minCVXForOUSD,
                abi.encodePacked(
                    ousd,
                    uint24(500), // 0.05% Pool fee, ousd -> usdt
                    usdt,
                    uint24(500), // 0.05% Pool fee, usdt -> weth9
                    weth9,
                    uint24(10000), // 1% Pool fee, weth9 -> CVX
                    cvx
                ),
                false
            );

            // Transfer OUSD to UniversalRouter for swapping
            IERC20(ousd).safeTransfer(universalRouter, ousdAmount);

            // Uniswap's Universal Router doesn't return the `amountOut` values
            // So, the events just emit the minExpected param
            emit OTokenBuyback(ousd, ogv, ousdAmount / 2, minOGVForOUSD);
            emit OTokenBuyback(ousd, cvx, ousdAmount / 2, minCVXForOUSD);
        }

        // Execute the swap
        IUniswapUniversalRouter(universalRouter).execute(
            commands,
            inputs,
            block.timestamp
        );

        // Lock all CVX
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
