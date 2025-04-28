// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @notice 1Inch Pathfinder V5 implementation of the general ISwapper interface.
 * @author Origin Protocol Inc
 * @dev It is possible that dust token amounts are left in this contract after a swap.
 * This can happen with some tokens that don't send the full transfer amount.
 * These dust amounts can build up over time and be used by anyone who calls the `swap` function.
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

    // swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
    bytes4 internal constant SWAP_SELECTOR = 0x12aa3caf;
    // unoswapTo(address,address,uint256,uint256,uint256[])
    bytes4 internal constant UNISWAP_SELECTOR = 0xf78dc253;
    // uniswapV3SwapTo(address,uint256,uint256,uint256[])
    bytes4 internal constant UNISWAPV3_SELECTOR = 0xbc80f1a8;

    /**
     * @notice Strategist swaps assets sitting in the contract of the `assetHolder`.
     * @param _fromAsset The token address of the asset being sold by the vault.
     * @param _toAsset The token address of the asset being purchased by the vault.
     * @param _fromAssetAmount The amount of assets being sold by the vault.
     * @param _minToAssetAmount The minimum amount of assets to be purchased.
     * @param _data RLP encoded executer address and bytes data. This is re-encoded tx.data from 1Inch swap API
     */
    function swap(
        address _fromAsset,
        address _toAsset,
        uint256 _fromAssetAmount,
        uint256 _minToAssetAmount,
        bytes calldata _data
    ) external override returns (uint256 toAssetAmount) {
        // Decode the function selector from the RLP encoded _data param
        bytes4 swapSelector = bytes4(_data[:4]);

        if (swapSelector == SWAP_SELECTOR) {
            // Decode the executer address and data from the RLP encoded _data param
            (, address executer, bytes memory executerData) = abi.decode(
                _data,
                (bytes4, address, bytes)
            );
            SwapDescription memory swapDesc = SwapDescription({
                srcToken: IERC20(_fromAsset),
                dstToken: IERC20(_toAsset),
                srcReceiver: payable(executer),
                dstReceiver: payable(msg.sender),
                amount: _fromAssetAmount,
                minReturnAmount: _minToAssetAmount,
                flags: 4 // 1st bit _PARTIAL_FILL, 2nd bit _REQUIRES_EXTRA_ETH, 3rd bit _SHOULD_CLAIM
            });
            (toAssetAmount, ) = IOneInchRouter(SWAP_ROUTER).swap(
                IAggregationExecutor(executer),
                swapDesc,
                hex"",
                executerData
            );
        } else if (swapSelector == UNISWAP_SELECTOR) {
            // Need to get the Uniswap pools data from the _data param
            (, uint256[] memory pools) = abi.decode(_data, (bytes4, uint256[]));
            toAssetAmount = IOneInchRouter(SWAP_ROUTER).unoswapTo(
                payable(msg.sender),
                IERC20(_fromAsset),
                _fromAssetAmount,
                _minToAssetAmount,
                pools
            );
        } else if (swapSelector == UNISWAPV3_SELECTOR) {
            // Need to get the Uniswap pools data from the _data param
            // slither-disable-next-line uninitialized-storage
            (, uint256[] memory pools) = abi.decode(_data, (bytes4, uint256[]));
            toAssetAmount = IOneInchRouter(SWAP_ROUTER).uniswapV3SwapTo(
                payable(msg.sender),
                _fromAssetAmount,
                _minToAssetAmount,
                pools
            );
        } else {
            revert("Unsupported swap function");
        }
    }

    /**
     * @notice Approve assets for swapping.
     * @param _assets Array of token addresses to approve.
     * @dev unlimited approval is used as no tokens sit in this contract outside a transaction.
     */
    function approveAssets(address[] memory _assets) external {
        for (uint256 i = 0; i < _assets.length; ++i) {
            // Give the 1Inch router approval to transfer unlimited assets
            IERC20(_assets[i]).safeApprove(SWAP_ROUTER, type(uint256).max);
        }
    }
}
