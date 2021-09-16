// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { UniswapV3Router } from "../interfaces/UniswapV3Router.sol";

contract Buyback is Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event UniswapUpdated(address _address);
    event BuybackFailed(bytes data);

    // Address of Uniswap
    address public uniswapAddr;

    // Address of OUSD Vault
    address public immutable vaultAddr;

    // Swap from OUSD
    IERC20 immutable ousd;

    // Swap to OGN
    IERC20 immutable ogn;

    // USDT for Uniswap path
    IERC20 immutable usdt;

    // WETH for Uniswap path
    IERC20 immutable weth9;

    // Oracles
    address immutable ognEthOracle;
    address immutable ethUsdOracle;

    constructor(
        address _uniswapAddr,
        address _vaultAddr,
        address _ousd,
        address _ogn,
        address _usdt,
        address _weth9,
        address _ognEthOracle,
        address _ethUsdOracle
    ) {
        uniswapAddr = _uniswapAddr;
        vaultAddr = _vaultAddr;
        ousd = IERC20(_ousd);
        ogn = IERC20(_ogn);
        usdt = IERC20(_usdt);
        weth9 = IERC20(_weth9);
        ognEthOracle = _ognEthOracle;
        ethUsdOracle = _ethUsdOracle;
        // Give approval to Uniswap router for OUSD, this is handled
        // by setUniswapAddr in the production contract
        IERC20(_ousd).safeApprove(uniswapAddr, 0);
        IERC20(_ousd).safeApprove(uniswapAddr, type(uint256).max);
    }

    /**
     * @dev Verifies that the caller is the OUSD Vault.
     */
    modifier onlyVault() {
        require(vaultAddr == msg.sender, "Caller is not the Vault");
        _;
    }

    /**
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens. Setting to 0x0 will pause swaps.
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        uniswapAddr = _address;
        if (uniswapAddr == address(0)) return;
        // Give Uniswap unlimited OUSD allowance
        ousd.safeApprove(uniswapAddr, 0);
        ousd.safeApprove(uniswapAddr, type(uint256).max);
        emit UniswapUpdated(_address);
    }

    /**
     * @dev Execute a swap of OGN for OUSD via Uniswap or Uniswap compatible
     * protocol (e.g. Sushiswap)
     **/
    function swap() external onlyVault nonReentrant {
        uint256 sourceAmount = ousd.balanceOf(address(this));
        if (sourceAmount < 1000 * 1e18) return;
        if (uniswapAddr == address(0)) return;
        // 97% should be the limits of our oracle errors.
        // If this swap sometimes skips when it should succeed, that’s okay,
        // the amounts will get get sold the next time this runs,
        // when presumably the oracles are more accurate.
        uint256 minExpected = expectedOgnPerOUSD(sourceAmount).mul(97).div(100);

        UniswapV3Router.ExactInputParams memory params = UniswapV3Router
            .ExactInputParams({
                path: abi.encodePacked(
                    ousd,
                    uint24(500), // Pool fee, ousd -> usdt
                    usdt,
                    uint24(3000), // Pool fee, usdt -> weth9
                    weth9,
                    uint24(3000), // Pool fee, weth9 -> ogn
                    ogn
                ),
                recipient: address(this),
                deadline: uint256(block.timestamp.add(1000)),
                amountIn: sourceAmount,
                amountOutMinimum: minExpected
            });

        // Don't revert everything, even if the buyback fails.
        // We want the overall transaction to continue regardless.
        // We don't need to look at the return data, since the amount will
        // be above the minExpected.
        (bool success, bytes memory data) = uniswapAddr.call(
            abi.encodeWithSignature(
                "exactInput((bytes,address,uint256,uint256,uint256))",
                params
            )
        );
        if (!success) {
            emit BuybackFailed(data);
        }
    }

    function expectedOgnPerOUSD(uint256 ousdAmount)
        public
        view
        returns (uint256)
    {
        return
            ousdAmount.mul(uint256(1e26)).div( // ognEth is 18 decimal. ethUsd is 8 decimal.
                _price(ognEthOracle).mul(_price(ethUsdOracle))
            );
    }

    function _price(address _feed) internal view returns (uint256) {
        require(_feed != address(0), "Asset not available");
        (, int256 _iprice, , , ) = AggregatorV3Interface(_feed)
            .latestRoundData();
        require(_iprice > 0, "Price must be greater than zero");
        return uint256(_iprice);
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
