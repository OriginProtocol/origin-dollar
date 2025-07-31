// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBalancerVault } from "../interfaces/balancer/IBalancerVault.sol";
import { MintableERC20 } from "./MintableERC20.sol";
import { StableMath } from "../utils/StableMath.sol";

// import "hardhat/console.sol";

contract MockBalancerVault {
    using StableMath for uint256;
    uint256 public slippage = 1 ether;
    bool public transferDisabled = false;
    bool public slippageErrorDisabled = false;

    function swap(
        IBalancerVault.SingleSwap calldata singleSwap,
        IBalancerVault.FundManagement calldata funds,
        uint256 minAmountOut,
        uint256
    ) external returns (uint256 amountCalculated) {
        amountCalculated = (minAmountOut * slippage) / 1 ether;
        if (!slippageErrorDisabled) {
            require(amountCalculated >= minAmountOut, "Slippage error");
        }
        IERC20(singleSwap.assetIn).transferFrom(
            funds.sender,
            address(this),
            singleSwap.amount
        );
        if (!transferDisabled) {
            MintableERC20(singleSwap.assetOut).mintTo(
                funds.recipient,
                amountCalculated
            );
        }
    }

    function setSlippage(uint256 _slippage) external {
        slippage = _slippage;
    }

    function getPoolTokenInfo(bytes32 poolId, address token)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            address
        )
    {}

    function disableTransfer() external {
        transferDisabled = true;
    }

    function disableSlippageError() external {
        slippageErrorDisabled = true;
    }
}
