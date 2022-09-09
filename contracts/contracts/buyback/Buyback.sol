// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { UniswapV3Router } from "../interfaces/UniswapV3Router.sol";

contract Buyback is Strategizable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event UniswapUpdated(address _address);

    // Address of Uniswap
    address public uniswapAddr;

    // Swap from OUSD
    IERC20 immutable ousd;

    // Swap to OGV
    IERC20 immutable ogv;

    // USDT for Uniswap path
    IERC20 immutable usdt;

    // WETH for Uniswap path
    IERC20 immutable weth9;

    // Address that receives rewards
    address public immutable rewardsSource;

    /**
     * @param _uniswapAddr Address of Uniswap
     * @param _strategistAddr Address of Strategist multi-sig wallet
     * @param _ousd OUSD Proxy Contract Address
     * @param _ogv OGV Proxy Contract Address
     * @param _usdt USDT Address
     * @param _weth9 WETH Address
     * @param _rewardsSource Address of RewardsSource contract
     */
    constructor(
        address _uniswapAddr,
        address _strategistAddr,
        address _ousd,
        address _ogv,
        address _usdt,
        address _weth9,
        address _rewardsSource
    ) {
        uniswapAddr = _uniswapAddr;
        _setStrategistAddr(_strategistAddr);
        ousd = IERC20(_ousd);
        ogv = IERC20(_ogv);
        usdt = IERC20(_usdt);
        weth9 = IERC20(_weth9);
        rewardsSource = _rewardsSource;

        // Give approval to Uniswap router for OUSD, this is handled
        // by setUniswapAddr in the production contract
        IERC20(_ousd).safeApprove(uniswapAddr, type(uint256).max);
        emit UniswapUpdated(_uniswapAddr);
    }

    /**
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens. Setting to 0x0 will pause swaps.
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        uniswapAddr = _address;

        if (uniswapAddr != address(0)) {
            // OUSD doesn't allow changing allowances.
            // You have to reset it to zero before you
            // can give it a different allowance.
            ousd.safeApprove(uniswapAddr, 0);

            // Give Uniswap unlimited OUSD allowance
            ousd.safeApprove(uniswapAddr, type(uint256).max);
        }

        emit UniswapUpdated(_address);
    }

    /**
     * @dev Execute a swap of OGV for OUSD via Uniswap or Uniswap compatible
     * protocol (e.g. Sushiswap)
     **/
    function swap() external {
        // Disabled for now, will be manually swapped by
        // `strategistAddr` using `swapNow()` method
        return;
    }

    /**
     * @dev Execute a swap of OGV for OUSD via Uniswap or Uniswap compatible
     * protocol (e.g. Sushiswap)
     * @param ousdAmount OUSD to sell
     * @param minExpected mininum amount of OGV to receive
     **/
    function swapNow(uint256 ousdAmount, uint256 minExpected)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        require(uniswapAddr != address(0), "Exchange address not set");
        require(minExpected > 0, "Invalid minExpected value");

        UniswapV3Router.ExactInputParams memory params = UniswapV3Router
            .ExactInputParams({
                path: abi.encodePacked(
                    ousd,
                    uint24(500), // Pool fee, ousd -> usdt
                    usdt,
                    uint24(500), // Pool fee, usdt -> weth9
                    weth9,
                    uint24(3000), // Pool fee, weth9 -> ogv
                    ogv
                ),
                recipient: rewardsSource,
                deadline: block.timestamp,
                amountIn: ousdAmount,
                amountOutMinimum: minExpected
            });

        UniswapV3Router.exactInput(params);
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
