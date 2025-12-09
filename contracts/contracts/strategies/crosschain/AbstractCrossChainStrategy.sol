// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {ExecutorSendReceive} from "wormhole-solidity-sdk/Executor/Integration.sol";
import {SequenceReplayProtectionLib} from "wormhole-solidity-sdk/libraries/ReplayProtection.sol";
import {CONSISTENCY_LEVEL_INSTANT} from "wormhole-solidity-sdk/constants/ConsistencyLevel.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";

bytes2 public constant MSG_TYPE_DEPOSIT = bytes2(0x01);
bytes2 public constant MSG_TYPE_WITHDRAW = bytes2(0x02);
bytes2 public constant MSG_TYPE_BALANCE_UPDATE = bytes2(0x03);

contract AbstractCrossChainStrategy is InitializableAbstractStrategy, ExecutorSendReceive {
    using SequenceReplayProtectionLib for *;

    address public immutable baseAsset;

    mapping(uint16 => bytes32) public peers;

    constructor(BaseStrategyConfig memory _baseConfig, address coreBridge, address executor) InitializableAbstractStrategy(_baseConfig) ExecutorSendReceive(coreBridge, executor) {}

    // event GreetingSent(string greeting, uint16 targetChain, uint64 sequence);
    event WormholeMessageSent(uint16 targetChain, uint64 sequence);

    error NoValueAllowed();

    constructor(BaseStrategyConfig memory _baseConfig, address _baseAsset, address coreBridge, address executor) InitializableAbstractStrategy(_baseConfig) ExecutorSendReceive(coreBridge, executor) {
        baseAsset = _baseAsset;
    }

    function _getPeer(uint16 chainId) internal view override returns (bytes32) {
        return peers[chainId];
    }

    function setPeer(uint16 chainId, bytes32 peerAddress) external onlyGovernor {
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
        uint64, /* sequence */
        uint8 /* consistencyLevel */
    )
        internal
        override
    {
        if (msg.value > 0) {
            revert NoValueAllowed();
        }

        _onPayloadReceived(payload);
    }

    function _onPayloadReceived(bytes memory payload) internal virtual {}

    function _sendMessage(
        bytes memory payload,
        uint16 targetChain,
        uint128 gasLimit,
        uint256 totalCost,
        bytes calldata signedQuote
    ) internal virtual returns (uint64 sequence) {
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

        emit WormholeMessageSent(targetChain, sequence);
    }

    function _sendTokensWithMessage() internal virtual {
        //
    }

    // function sendGreeting(
    //     string calldata greeting,
    //     uint16 targetChain,
    //     uint128 gasLimit,
    //     uint256 totalCost,
    //     bytes calldata signedQuote
    // ) external payable returns (uint64 sequence) {
    //     // Encode the greeting as bytes
    //     bytes memory payload = bytes(greeting);

    //     // Publish and relay the message to the target chain
    //     sequence = _publishAndRelay(
    //         payload,
    //         CONSISTENCY_LEVEL_INSTANT, // choose safe or finalized based on your needs
    //         totalCost,
    //         targetChain,
    //         msg.sender, // refund address
    //         signedQuote,
    //         gasLimit,
    //         0, // no msg.value forwarding
    //         "" // no extra relay instructions
    //     );

    //     emit GreetingSent(greeting, targetChain, sequence);
    // }

    function initialize() onlyGovernor initializer {
        // No reward tokens since all yields will be in base asset 
        // (as Yearn V3 Vault will take care of the harvesting)
        InitializableAbstractStrategy._initialize(
            new address[](0), // rewardTokenAddresses
            new address[](0), // assets
            new address[](0) // pTokens
        );
    }

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function _abstractSetPToken(address, address) internal override {}

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // No reward tokens since all yields will be in base asset 
        // (as Yearn V3 Vault will take care of the harvesting)
    }

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
    }

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == baseAsset;
    }

}