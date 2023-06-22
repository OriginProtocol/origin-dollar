// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { UniswapV3Router } from "../interfaces/UniswapV3Router.sol";

import { Initializable } from "../utils/Initializable.sol";

contract Buyback is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    event UniswapUpdated(address indexed _address);
    event RewardsSourceUpdated(address indexed _address);
    event TreasuryManagerUpdated(address indexed _address);
    event TreasuryBpsUpdated(uint256 _bps);
    event OUSDSwapped(
        address indexed token,
        uint256 swapAmountIn,
        uint256 swapAmountOut
    );
    event OUSDTransferred(address indexed receiver, uint256 amountSent);

    // Address of Uniswap
    address public uniswapAddr;

    // Swap from OUSD
    IERC20 public ousd;

    // Swap to OGV
    IERC20 public ogv;

    // USDT for Uniswap path
    IERC20 public usdt;

    // WETH for Uniswap path
    IERC20 public weth9;

    // Address that receives rewards
    address public rewardsSource;

    // Address that receives the treasury's share of OUSD
    address public treasuryManager;

    // Treasury's share of OUSD fee
    uint256 public treasuryBps;

    constructor() {
        // Make sure nobody owns the implementation contract
        _setGovernor(address(0));
    }

    /**
     * @param _uniswapAddr Address of Uniswap
     * @param _strategistAddr Address of Strategist multi-sig wallet
     * @param _treasuryManagerAddr Address that receives the treasury's share of OUSD
     * @param _ousd OUSD Proxy Contract Address
     * @param _ogv OGV Proxy Contract Address
     * @param _usdt USDT Address
     * @param _weth9 WETH Address
     * @param _rewardsSource Address of RewardsSource contract
     * @param _treasuryBps Percentage of OUSD balance to be sent to treasury
     */
    function initialize(
        address _uniswapAddr,
        address _strategistAddr,
        address _treasuryManagerAddr,
        address _ousd,
        address _ogv,
        address _usdt,
        address _weth9,
        address _rewardsSource,
        uint256 _treasuryBps
    ) external onlyGovernor initializer {
        ousd = IERC20(_ousd);
        ogv = IERC20(_ogv);
        usdt = IERC20(_usdt);
        weth9 = IERC20(_weth9);

        _setStrategistAddr(_strategistAddr);

        _setUniswapAddr(_uniswapAddr);
        _setRewardsSource(_rewardsSource);

        _setTreasuryManager(_treasuryManagerAddr);
        _setTreasuryBps(_treasuryBps);
    }

    /**
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens. Setting to 0x0 will pause swaps.
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        _setUniswapAddr(_address);
    }

    function _setUniswapAddr(address _address) internal {
        uniswapAddr = _address;

        if (uniswapAddr != address(0)) {
            // Give Uniswap unlimited OUSD allowance
            ousd.safeApprove(uniswapAddr, type(uint256).max);
        }

        emit UniswapUpdated(_address);
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
     * @dev Set the Treasury's share of OUSD
     * @param _bps Percentage of OUSD balance to be sent to treasury
     */
    function setTreasuryBps(uint256 _bps) external onlyGovernor {
        _setTreasuryBps(_bps);
    }

    function _setTreasuryBps(uint256 _bps) internal {
        require(_bps <= 10000, "Invalid treasury bips value");
        treasuryBps = _bps;
        emit TreasuryBpsUpdated(_bps);
    }

    /**
     * @dev Execute a swap of OGV for OUSD via Uniswap or Uniswap compatible
     * protocol (e.g. Sushiswap)
     **/
    function swap() external {
        // Disabled for now, will be manually swapped by
        // `strategistAddr` using `distributeAndSwap()` method
        return;
    }

    /**
     * @dev Computes the split of OUSD for treasury and transfers it. And
     *      then execute a swap of OUSD for OGV with the remaining amount
     *      via Uniswap or Uniswap compatible protocol (e.g. Sushiswap).
     *
     * @param ousdAmount OUSD Amount to use from the balance
     * @param minOGVExpected Mininum amount of OGV to receive when swapping
     **/
    function distributeAndSwap(uint256 ousdAmount, uint256 minOGVExpected)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        require(uniswapAddr != address(0), "Exchange address not set");

        uint256 amountToTransfer = (ousdAmount * treasuryBps) / 10000;
        uint256 swapAmountIn = ousdAmount - amountToTransfer;

        if (swapAmountIn > 0) {
            require(minOGVExpected > 0, "Invalid minOGVExpected value");

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
                    amountIn: swapAmountIn,
                    amountOutMinimum: minOGVExpected
                });

            uint256 amountOut = UniswapV3Router(uniswapAddr).exactInput(params);

            emit OUSDSwapped(address(ogv), swapAmountIn, amountOut);
        }

        if (amountToTransfer > 0) {
            ousd.safeTransfer(treasuryManager, amountToTransfer);
            emit OUSDTransferred(treasuryManager, amountToTransfer);
        }
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
