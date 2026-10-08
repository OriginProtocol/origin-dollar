// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

/**
 * @title MockCCIPRouter
 * @notice TEST-ONLY CCIP router stub for fork tests. Records the most recent ccipSend call
 *         so the test can assert encoding, token amounts, and destination. No actual cross-
 *         chain delivery happens; the destination is mocked out separately on the same fork.
 */
contract MockCCIPRouter is IRouterClient {
    using SafeERC20 for IERC20;

    uint256 public sentMessagesLength;

    /// @notice Native fee getFee() reports; ccipSend pulls this in `msg.value`.
    uint256 public mockFee;

    function setFee(uint256 _fee) external {
        mockFee = _fee;
    }

    event MockCcipSend(
        uint64 destinationChainSelector,
        bytes receiver,
        address token,
        uint256 amount,
        uint256 valueReceived
    );

    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage memory message
    ) external payable override returns (bytes32 messageId) {
        // Pull each token in the message from the caller — that's what the real router does.
        for (uint256 i = 0; i < message.tokenAmounts.length; i++) {
            IERC20(message.tokenAmounts[i].token).safeTransferFrom(
                msg.sender,
                address(this),
                message.tokenAmounts[i].amount
            );
            emit MockCcipSend(
                destinationChainSelector,
                message.receiver,
                message.tokenAmounts[i].token,
                message.tokenAmounts[i].amount,
                msg.value
            );
        }
        if (message.tokenAmounts.length == 0) {
            emit MockCcipSend(
                destinationChainSelector,
                message.receiver,
                address(0),
                0,
                msg.value
            );
        }

        sentMessagesLength += 1;
        messageId = keccak256(
            abi.encode(
                destinationChainSelector,
                message.receiver,
                sentMessagesLength
            )
        );
    }

    function getFee(uint64, Client.EVM2AnyMessage memory)
        external
        view
        override
        returns (uint256)
    {
        return mockFee;
    }

    function getSupportedTokens(uint64)
        external
        pure
        override
        returns (address[] memory)
    {
        return new address[](0);
    }

    function isChainSupported(uint64) external pure override returns (bool) {
        return true;
    }
}
