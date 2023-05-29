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
    address public constant EXECUTER =
        0x1136B25047E142Fa3018184793aEc68fBB173cE4;

    /**
     * @notice Strategist swaps assets sitting in the contract of the `assetHolder`.
     * @param _fromAsset The token address of the asset being sold by the vault.
     * @param _toAsset The token address of the asset being purchased by the vault.
     * @param _fromAssetAmount The amount of assets being sold by the vault.
     * @param _minToAssetAmount The minimum amount of assets to be purchased.
     * @param _data tx.data returned from 1Inch's /v5.0/1/swap API
     */
    function swap(
        address _fromAsset,
        address _toAsset,
        uint256 _fromAssetAmount,
        uint256 _minToAssetAmount,
        bytes calldata _data
    ) external override returns (uint256 toAssetAmount) {
        require(
            IERC20(_fromAsset).balanceOf(msg.sender) >= _fromAssetAmount,
            "Insufficient balance"
        );
        require(
            IERC20(_fromAsset).allowance(address(this), SWAP_ROUTER) >=
                _fromAssetAmount,
            "Insufficient allowance"
        );

        (
            address executer,
            SwapDescription memory decodedDesc,
            ,
            bytes memory executerData
        ) = abi.decode(_data[4:], (address, SwapDescription, bytes, bytes));

        require(
            decodedDesc.srcToken == IERC20(_fromAsset),
            "fromAsset missmatch"
        );
        require(decodedDesc.dstToken == IERC20(_toAsset), "toAsset missmatch");
        require(
            decodedDesc.amount == _fromAssetAmount,
            "fromAssetAmount missmatch"
        );
        require(
            decodedDesc.minReturnAmount == _minToAssetAmount,
            "minToAssetAmount missmatch"
        );

        SwapDescription memory swapDesc = SwapDescription({
            srcToken: IERC20(_fromAsset),
            dstToken: IERC20(_toAsset),
            srcReceiver: payable(executer),
            dstReceiver: payable(msg.sender),
            amount: _fromAssetAmount,
            minReturnAmount: _minToAssetAmount,
            flags: 4 // _REQUIRES_EXTRA_ETH is second bit. _PARTIAL_FILL is first bit
        });
        (toAssetAmount, ) = IOneInchRouter(SWAP_ROUTER).swap(
            IAggregationExecutor(executer),
            swapDesc,
            hex"",
            executerData
        );
    }

    function approveAssets(address[] memory _assets) external {
        for (uint256 i = 0; i < _assets.length; ++i) {
            IERC20(_assets[i]).safeApprove(SWAP_ROUTER, type(uint256).max);
        }
    }
}
