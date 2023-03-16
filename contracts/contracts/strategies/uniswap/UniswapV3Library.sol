pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IUniswapV3Strategy } from "../../interfaces/IUniswapV3Strategy.sol";
import { IVault } from "../../interfaces/IVault.sol";

library UniswapV3Library {
    function depositAll(
        address token0,
        address token1,
        address vaultAddress,
        uint256 minDepositThreshold0,
        uint256 minDepositThreshold1
    ) external {
        IUniswapV3Strategy strat = IUniswapV3Strategy(msg.sender);

        uint256 token0Bal = IERC20(token0).balanceOf(address(this));
        uint256 token1Bal = IERC20(token1).balanceOf(address(this));
        IVault vault = IVault(vaultAddress);

        if (
            token0Bal > 0 &&
            (minDepositThreshold0 == 0 || token0Bal >= minDepositThreshold0)
        ) {
            vault.depositToUniswapV3Reserve(token0, token0Bal);
        }
        if (
            token1Bal > 0 &&
            (minDepositThreshold1 == 0 || token1Bal >= minDepositThreshold1)
        ) {
            vault.depositToUniswapV3Reserve(token1, token1Bal);
        }
        // Not emitting Deposit events since the Reserve strategies would do so
    }

    // function closePosition(uint256 tokenId, uint256 minAmount0, uint256 minAmount1) external {
    //     (bool success, bytes memory data) = address(this).delegatecall(
    //         abi.encodeWithSignature("closePosition(uint256,uint256,uint256)", activeTokenId, 0, 0)
    //     );

    //     require(success, "Failed to close active position");
    // }

    // function withdrawAssetFromActivePosition(
    //     address asset,
    //     uint256 amount
    // ) external {
    //     (bool success, bytes memory data) = address(this).delegatecall(
    //         abi.encodeWithSignature("withdrawAssetFromActivePosition(asset,uint256)", asset, amount)
    //     );

    //     require(success, "Failed to liquidate active position");
    // }
}
