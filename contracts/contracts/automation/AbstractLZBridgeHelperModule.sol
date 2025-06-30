// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IOFT, SendParam } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract AbstractLZBridgeHelperModule is AbstractSafeModule {
    using OptionsBuilder for bytes;

    /**
     * @dev Bridges token using LayerZero.
     * @param lzEndpointId LayerZero endpoint id.
     * @param token Token to bridge.
     * @param lzAdapter LZ Adapter to use.
     * @param amount Amount of token to bridge.
     * @param slippageBps Slippage in 10^4 basis points.
     * @param isNativeToken Whether the token is native token.
     */
    function _bridgeTokenWithLz(
        uint32 lzEndpointId,
        IERC20 token,
        IOFT lzAdapter,
        uint256 amount,
        uint256 slippageBps,
        bool isNativeToken
    ) internal {
        bool success;

        if (!isNativeToken) {
            // Approve LZ Adapter to move the token
            success = safeContract.execTransactionFromModule(
                address(token),
                0, // Value
                abi.encodeWithSelector(
                    token.approve.selector,
                    address(lzAdapter),
                    amount
                ),
                0 // Call
            );
            require(success, "Failed to approve token");
        }

        // Calculate minimum amount to receive
        uint256 minAmount = (amount * (10000 - slippageBps)) / 10000;

        // Hardcoded gaslimit of 400k
        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(400000, 0);

        // Build send param
        SendParam memory sendParam = SendParam({
            dstEid: lzEndpointId,
            to: bytes32(uint256(uint160(address(safeContract)))),
            amountLD: amount,
            minAmountLD: minAmount,
            extraOptions: options,
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        // Compute fees
        MessagingFee memory msgFee = lzAdapter.quoteSend(sendParam, false);

        uint256 value = isNativeToken
            ? amount + msgFee.nativeFee
            : msgFee.nativeFee;

        // Execute transaction
        success = safeContract.execTransactionFromModule(
            address(lzAdapter),
            value,
            abi.encodeWithSelector(
                lzAdapter.send.selector,
                sendParam,
                msgFee,
                address(safeContract)
            ),
            0
        );
        require(success, "Failed to bridge token");
    }
}
