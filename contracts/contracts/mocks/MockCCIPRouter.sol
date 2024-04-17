// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCCIPRouter {
    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage calldata message
    ) external payable returns (bytes32) {
        // Make sure tokens can be pulled from the zapper contract
        IERC20(message.tokenAmounts[0].token).transferFrom(
            msg.sender,
            address(this),
            message.tokenAmounts[0].amount
        );

        return bytes32(hex"deadfeed");
    }
}
