// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @notice 1Inch Pathfinder V5 implementation of the general ISwapper interface.
 * @author Origin Protocol Inc
 */

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IAggregationExecutor, IOneInchRouter, SwapDescription } from "../interfaces/IOneInch.sol";
import { ISwapper } from "../interfaces/ISwapper.sol";

contract Swapper1InchV5 is ISwapper {
    using SafeERC20 for IERC20;

    /// @notice 1Inch router contract to give allowance to perform swaps
    address public constant SWAP_ROUTER =
        0x1111111254EEB25477B68fb85Ed929f73A960582;

    /**
     * @notice Strategist swaps assets sitting in the contract of the `assetHolder`.
     * @param fromAsset The token address of the asset being sold by the vault.
     * @param toAsset The token address of the asset being purchased by the vault.
     * @param fromAssetAmount The amount of assets being sold by the vault.
     * @param minToAssetAmmount The minimum amount of assets to be purchased.
     * @param data tx.data returned from 1Inch's /v5.0/1/swap API
     */
    function swap(
        address fromAsset,
        address toAsset,
        uint256 fromAssetAmount,
        uint256 minToAssetAmmount,
        bytes calldata data
    ) external override returns (uint256 toAssetAmount) {
        SwapDescription memory swapDesc = SwapDescription({
            srcToken: IERC20(fromAsset),
            dstToken: IERC20(toAsset),
            // TODO could set to caller (Vault) to save transfer to this Swapper contract
            srcReceiver: payable(address(this)),
            dstReceiver: payable(msg.sender),
            amount: fromAssetAmount,
            minReturnAmount: minToAssetAmmount,
            flags: 0 // no special swaps needed
        });
        (toAssetAmount, ) = IOneInchRouter(SWAP_ROUTER).swap(
            IAggregationExecutor(address(this)),
            swapDesc,
            "0x", // we are not approving tx via signatures so it is not necessary
            data
        );
    }

    function approveAssets(address[] memory _assets) external {
        for (uint256 i = 0; i < _assets.length; ++i) {
            IERC20(_assets[i]).safeApprove(SWAP_ROUTER, type(uint256).max);
        }
    }
}
