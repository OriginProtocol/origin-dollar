// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD Vault Contract
 * @notice The Vault contract stores assets. On a deposit, OUSD will be minted
           and sent to the depositor. On a withdrawal, OUSD will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of OUSD.
 * @author Origin Protocol Inc
 */

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IOracle } from "../interfaces/IOracle.sol";
import { IGetExchangeRateToken } from "../interfaces/IGetExchangeRateToken.sol";
import { Strategizable } from "../governance/Strategizable.sol";
import { IAggregationExecutor, IOneInchRouter, SwapDescription } from "../interfaces/IOneInch.sol";
import { ISwapExecuter } from "../interfaces/ISwapExecuter.sol";
import { ISwapAssetHolder } from "../interfaces/ISwapAssetHolder.sol";

contract Swapper1InchV5 is ISwapExecuter, Strategizable {
    using SafeERC20 for IERC20;

    struct Swap {
        address assetHolder;
        address fromAsset;
        address toAsset;
        uint128 fromAssetAmount;
        uint128 minToAssetAmmount;
        bytes data;
    }

    /// @notice 1Inch router contract to give allowance to perform swaps
    address public constant SWAP_ROUTER =
        0x1111111254EEB25477B68fb85Ed929f73A960582;

    Swap internal swapTxData;

    constructor(address[] memory _assets) {
        _approveAssets(_assets);
    }

    /**
     * @notice Strategist swaps assets sitting in the contract of the `assetHolder`.
     */
    function swap(
        address assetHolder,
        address fromAsset,
        address toAsset,
        uint256 fromAssetAmount,
        uint256 minToAssetAmmount,
        bytes calldata data
    ) external onlyGovernorOrStrategist {
        // this is effectively a reentrancy guard
        require(
            swapTxData.assetHolder == address(0),
            "Swap already in progress"
        );

        // Save swap data to storage for the duration of this transaction
        // This will be reverted if the `prepareSwap` and then `executeSwap` calls fail
        swapTxData = Swap({
            assetHolder: assetHolder,
            fromAsset: fromAsset,
            toAsset: toAsset,
            fromAssetAmount: SafeCast.toUint128(fromAssetAmount),
            minToAssetAmmount: SafeCast.toUint128(minToAssetAmmount),
            data: data
        });

        // Call the contract that is holding the assets to be swapped.
        // They will transfer the `fromAsset` to this swapper contract
        // and then call `executeSwap`
        ISwapAssetHolder(assetHolder).prepareSwap(fromAsset, toAsset, toAsset);

        // Clear the swap tx data from storage
        delete swapTxData;
    }

    /**
     * @notice Strategist swaps collateral assets sitting in the vault.
     * @return toAssetAmount The amount of toAssets that was received from the swap
     */
    function executeSwap()
        external
        override
        onlyGovernorOrStrategist
        returns (uint256 toAssetAmount)
    {
        // Load the swap tx data from storage
        // this was saved in the prior call to the swap() function
        Swap memory swapData = swapTxData;

        // validate from asset holder is the one calling back to this contract
        require(
            swapData.assetHolder == msg.sender,
            "Caller is not assetHolder"
        );

        SwapDescription memory swapDesc = SwapDescription({
            srcToken: IERC20(swapData.fromAsset),
            dstToken: IERC20(swapData.toAsset),
            srcReceiver: payable(address(this)),
            dstReceiver: payable(swapData.assetHolder),
            amount: swapData.fromAssetAmount,
            minReturnAmount: swapData.minToAssetAmmount,
            flags: 0 // no special swaps needed
        });
        (toAssetAmount, ) = IOneInchRouter(SWAP_ROUTER).swap(
            IAggregationExecutor(address(this)),
            swapDesc,
            "0x", // we are not approving tx via signatures so it is not necessary
            swapData.data
        );

        // Check the to assets returns is above slippage amount specified by the strategist
        require(
            toAssetAmount >= swapData.minToAssetAmmount,
            "Strategist slippage limit exceeded"
        );
    }

    function approveAssets(address[] memory _assets) external onlyGovernor {
        _approveAssets(_assets);
    }

    function _approveAssets(address[] memory _assets) internal {
        for (uint256 i = 0; i < _assets.length; ++i) {
            IERC20(_assets[i]).safeApprove(SWAP_ROUTER, type(uint256).max);
        }
    }

    function revokeAsset(address _asset) external onlyGovernor {
        IERC20(_asset).safeApprove(SWAP_ROUTER, 0);
    }
}
