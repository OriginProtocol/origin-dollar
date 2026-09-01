// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { CrossChainV3Helper } from "../../strategies/crosschainV3/CrossChainV3Helper.sol";

/**
 * @title MockCrossChainV3HelperHarness
 * @notice TEST-ONLY harness exposing CrossChainV3Helper's internal functions externally
 *         so the JS test suite can validate the codec.
 */
contract MockCrossChainV3HelperHarness {
    function packPayload(
        uint32 msgType,
        uint64 nonce,
        bytes calldata body
    ) external pure returns (bytes memory) {
        return CrossChainV3Helper.packPayload(msgType, nonce, body);
    }

    function unpackPayload(bytes calldata payload)
        external
        pure
        returns (
            uint32,
            uint64,
            bytes memory
        )
    {
        return CrossChainV3Helper.unpackPayload(payload);
    }

    function encodeNewBalancePayload(uint256 newBalance)
        external
        pure
        returns (bytes memory)
    {
        return CrossChainV3Helper.encodeUint256(newBalance);
    }

    function decodeNewBalancePayload(bytes calldata payload)
        external
        pure
        returns (uint256)
    {
        return CrossChainV3Helper.decodeUint256(payload);
    }

    function encodeAmountPayload(uint256 amount)
        external
        pure
        returns (bytes memory)
    {
        return CrossChainV3Helper.encodeUint256(amount);
    }

    function decodeAmountPayload(bytes calldata payload)
        external
        pure
        returns (uint256)
    {
        return CrossChainV3Helper.decodeUint256(payload);
    }

    function encodeWithdrawClaimAckPayload(
        uint256 newBalance,
        bool success,
        uint256 amount
    ) external pure returns (bytes memory) {
        return
            CrossChainV3Helper.encodeWithdrawClaimAckPayload(
                newBalance,
                success,
                amount
            );
    }

    function decodeWithdrawClaimAckPayload(bytes calldata payload)
        external
        pure
        returns (
            uint256,
            bool,
            uint256
        )
    {
        return CrossChainV3Helper.decodeWithdrawClaimAckPayload(payload);
    }

    function encodeBalanceReportPayload(uint256 balance, uint256 timestamp)
        external
        pure
        returns (bytes memory)
    {
        return
            CrossChainV3Helper.encodeBalanceReportPayload(balance, timestamp);
    }

    function decodeBalanceReportPayload(bytes calldata payload)
        external
        pure
        returns (uint256, uint256)
    {
        return CrossChainV3Helper.decodeBalanceReportPayload(payload);
    }
}
