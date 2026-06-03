// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// solhint-disable-next-line max-line-length
import { IAny2EVMMessageReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { AbstractInboundAdapter } from "./AbstractInboundAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";

/**
 * @title CCIPInboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic inbound adapter over Chainlink CCIP. Implements
 *         `IAny2EVMMessageReceiver`; CCIP Router calls into `ccipReceive` after delivery.
 *         We resolve the destination strategy from the (sourceChainSelector, sender) pair,
 *         unwrap the envelope, and forward.
 */
contract CCIPInboundAdapter is
    AbstractInboundAdapter,
    IAny2EVMMessageReceiver,
    IERC165
{
    /// @notice CCIP Router authorised to call `ccipReceive`.
    address public immutable ccipRouter;

    constructor(address _ccipRouter) {
        require(_ccipRouter != address(0), "CCIPIn: zero router");
        ccipRouter = _ccipRouter;
    }

    modifier onlyRouter() {
        require(msg.sender == ccipRouter, "CCIPIn: not router");
        _;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId)
        external
        pure
        override
        returns (bool)
    {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /// @inheritdoc IAny2EVMMessageReceiver
    function ccipReceive(Client.Any2EVMMessage calldata message)
        external
        override
        onlyRouter
    {
        address sender = abi.decode(message.sender, (address));
        address strategy = strategyFor[message.sourceChainSelector][sender];
        require(strategy != address(0), "CCIPIn: unknown peer");

        (
            uint32 version,
            uint32 msgType,
            uint64 nonce,
            bytes memory payload
        ) = CrossChainV3Helper.unwrap(message.data);
        require(
            version == CrossChainV3Helper.ORIGIN_V3_MESSAGE_VERSION,
            "CCIPIn: bad version"
        );

        // CCIP delivers any token transfers to this adapter alongside `ccipReceive`.
        // Single-token transfers expected for V3.
        uint256 amount = 0;
        address token = address(0);
        if (message.destTokenAmounts.length > 0) {
            token = message.destTokenAmounts[0].token;
            amount = message.destTokenAmounts[0].amount;
        }

        _deliverAtomic(strategy, nonce, amount, uint8(msgType), payload, token);
    }
}
