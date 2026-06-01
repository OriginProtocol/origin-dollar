// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// solhint-disable-next-line max-line-length
import { IAny2EVMMessageReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { AbstractReceiverAdapter } from "./AbstractReceiverAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";

/**
 * @title SuperbridgeCCIPReceiverAdapter
 * @author Origin Protocol Inc
 *
 * @notice Split-delivery inbound adapter for OP-Stack-L2 leg of the Ethereum → L2 flow.
 *         Receives the CCIP message and stores it in the pending slot; tokens arrive
 *         separately via the OP Stack canonical bridge (which simply transfers them
 *         to this adapter address with no callback). Off-chain automation calls
 *         `processStoredMessage()` once both legs have landed.
 *
 *         Designed to live behind a transparent proxy so its implementation can be
 *         upgraded without losing the pending slot during a security patch.
 */
contract SuperbridgeCCIPReceiverAdapter is
    AbstractReceiverAdapter,
    IAny2EVMMessageReceiver,
    IERC165
{
    address public immutable ccipRouter;
    /// @notice Token expected to arrive via the canonical bridge. Configured once at deploy.
    address public immutable expectedToken;

    constructor(address _ccipRouter, address _expectedToken) {
        require(_ccipRouter != address(0), "SuperRx: zero CCIP");
        require(_expectedToken != address(0), "SuperRx: zero token");
        ccipRouter = _ccipRouter;
        expectedToken = _expectedToken;
    }

    modifier onlyRouter() {
        require(msg.sender == ccipRouter, "SuperRx: not router");
        _;
    }

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
        require(
            message.sourceChainSelector == peerChainSelector,
            "SuperRx: bad source chain"
        );
        address sender = abi.decode(message.sender, (address));
        require(sender == peerOutbound, "SuperRx: bad sender");

        (
            uint32 version,
            uint32 msgType,
            uint64 nonce,
            bytes memory payload
        ) = CrossChainV3Helper.unwrap(message.data);
        require(
            version == CrossChainV3Helper.ORIGIN_V3_MESSAGE_VERSION,
            "SuperRx: bad version"
        );

        // Determine the token amount the message expects to find on this adapter once the
        // canonical bridge tokens land. For message-only types, expectedAmount = 0.
        uint256 expectedAmount = _expectedAmountFor(uint8(msgType), payload);

        if (
            expectedAmount == 0 ||
            IERC20(expectedToken).balanceOf(address(this)) >= expectedAmount
        ) {
            // Tokens already here (or none required). Deliver immediately.
            _deliverAtomic(
                nonce,
                expectedAmount,
                uint8(msgType),
                payload,
                expectedAmount > 0 ? expectedToken : address(0)
            );
        } else {
            _storePending(
                nonce,
                expectedAmount,
                uint8(msgType),
                payload,
                expectedToken
            );
        }
    }

    /**
     * @dev Of all yield-channel messages that travel R→M (Remote on Ethereum → Master on
     *      an OP-Stack L2), only `WITHDRAW_CLAIM_ACK` carries the bridgeAsset back to
     *      Master — Remote delivers the user's withdrawn assets alongside the ack.
     *      Other R→M messages (yield-deposit-ack, balance-check-response, settle-ack) are
     *      message-only.
     *
     *      The exact delivered amount is encoded inside the `WITHDRAW_CLAIM_ACK` payload
     *      (`abi.encode(newBalance, success, amount)`), so the receiver pins `expectedAmount`
     *      to it. Tokens arrive separately via the OP Stack canonical bridge and are matched
     *      by `processStoredMessage` (inherited from `AbstractReceiverAdapter`) before
     *      delivery.
     */
    function _expectedAmountFor(uint8 msgType, bytes memory payload)
        internal
        pure
        returns (uint256)
    {
        if (msgType == uint8(CrossChainV3Helper.WITHDRAW_CLAIM_ACK)) {
            (, bool success, uint256 amount) = CrossChainV3Helper
                .decodeWithdrawClaimAckPayload(payload);
            return success ? amount : 0;
        }
        return 0;
    }
}
