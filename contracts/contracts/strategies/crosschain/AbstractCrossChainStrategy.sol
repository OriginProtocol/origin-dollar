// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {ExecutorSendReceive} from "wormhole-solidity-sdk/Executor/Integration.sol";
import {SequenceReplayProtectionLib} from "wormhole-solidity-sdk/libraries/ReplayProtection.sol";
import {CONSISTENCY_LEVEL_INSTANT} from "wormhole-solidity-sdk/constants/ConsistencyLevel.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";

contract AbstractCrossChainStrategy is InitializableAbstractStrategy, ExecutorSendReceive {
    using SequenceReplayProtectionLib for *;

    mapping(uint16 => bytes32) public peers;

    constructor(BaseStrategyConfig memory _baseConfig, address coreBridge, address executor) InitializableAbstractStrategy(_baseConfig) ExecutorSendReceive(coreBridge, executor) {}

    event GreetingReceived(string greeting, uint16 senderChain, bytes32 sender);
    event GreetingSent(string greeting, uint16 targetChain, uint64 sequence);

    error NoValueAllowed();

    function _getPeer(uint16 chainId) internal view override returns (bytes32) {
        return peers[chainId];
    }

    function setPeer(uint16 chainId, bytes32 peerAddress) external {
        peers[chainId] = peerAddress;
    }

    function _replayProtect(
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence,
        bytes calldata /* encodedVaa */
    )
        internal
        override
    {
        SequenceReplayProtectionLib.replayProtect(emitterChainId, emitterAddress, sequence);
    }

    function _executeVaa(
        bytes calldata payload,
        uint32,
        /* timestamp */
        uint16 peerChain,
        bytes32 peerAddress,
        uint64,
        /* sequence */
        uint8 /* consistencyLevel */
    )
        internal
        override
    {
        if (msg.value > 0) {
            revert NoValueAllowed();
        }
        // Decode the payload to extract the greeting message
        string memory greeting = string(payload);

        // Emit an event with the greeting message and sender details
        emit GreetingReceived(greeting, peerChain, peerAddress);
    }

    function sendGreeting(
        string calldata greeting,
        uint16 targetChain,
        uint128 gasLimit,
        uint256 totalCost,
        bytes calldata signedQuote
    ) external payable returns (uint64 sequence) {
        // Encode the greeting as bytes
        bytes memory payload = bytes(greeting);

        // Publish and relay the message to the target chain
        sequence = _publishAndRelay(
            payload,
            CONSISTENCY_LEVEL_INSTANT, // choose safe or finalized based on your needs
            totalCost,
            targetChain,
            msg.sender, // refund address
            signedQuote,
            gasLimit,
            0, // no msg.value forwarding
            "" // no extra relay instructions
        );

        emit GreetingSent(greeting, targetChain, sequence);
    }
}