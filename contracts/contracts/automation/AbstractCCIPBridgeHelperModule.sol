// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

abstract contract AbstractCCIPBridgeHelperModule is AbstractSafeModule {
    /**
     * @notice Bridges a token from the source chain to the destination chain using CCIP
     * @param ccipRouter The CCIP router contract
     * @param destinationChainSelector The selector for the destination chain
     * @param token The token to bridge
     * @param amount The amount of token to bridge
     */
    function _bridgeTokenWithCCIP(
        IRouterClient ccipRouter,
        uint64 destinationChainSelector,
        IERC20 token,
        uint256 amount
    ) internal {
        bool success;

        // Approve CCIP Router to move the token
        success = safeContract.execTransactionFromModule(
            address(token),
            0, // Value
            abi.encodeWithSelector(token.approve.selector, ccipRouter, amount),
            0 // Call
        );
        require(success, "Failed to approve token");

        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        Client.EVMTokenAmount memory tokenAmount = Client.EVMTokenAmount({
            token: address(token),
            amount: amount
        });
        tokenAmounts[0] = tokenAmount;

        Client.EVM2AnyMessage memory ccipMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(address(safeContract)), // ABI-encoded receiver address
            data: abi.encode(""),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({ gasLimit: 0 })
            ),
            feeToken: address(0)
        });

        // Get CCIP fee
        uint256 ccipFee = ccipRouter.getFee(
            destinationChainSelector,
            ccipMessage
        );

        // Send CCIP message
        success = safeContract.execTransactionFromModule(
            address(ccipRouter),
            ccipFee, // Value
            abi.encodeWithSelector(
                ccipRouter.ccipSend.selector,
                destinationChainSelector,
                ccipMessage
            ),
            0 // Call
        );
        require(success, "Failed to send CCIP message");
    }
}
