// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title MockBridgeCallTarget
 * @notice TEST-ONLY recipient contract used to exercise the optional `callData` post-delivery
 *         hook on BRIDGE_IN / BRIDGE_OUT. Records successful invocations, can be flipped to
 *         always-revert, and exposes a gas-burning helper.
 */
contract MockBridgeCallTarget {
    bool public alwaysRevert;
    uint256 public callCount;
    bytes32 public lastBridgeId;
    address public lastCaller;
    uint256 public lastValueObserved;
    bytes public lastData;

    event Pinged(
        bytes32 indexed bridgeId,
        address indexed caller,
        uint256 token
    );

    function setAlwaysRevert(bool _r) external {
        alwaysRevert = _r;
    }

    /// @dev Match the kind of post-mint hook a real composing contract would expose.
    function onBridgeDelivered(bytes32 _bridgeId, uint256 _tokenAmount)
        external
    {
        if (alwaysRevert) revert("MockTarget: intentional revert");
        callCount += 1;
        lastBridgeId = _bridgeId;
        lastCaller = msg.sender;
        lastValueObserved = _tokenAmount;
        emit Pinged(_bridgeId, msg.sender, _tokenAmount);
    }

    /// @dev Spin-loop until gas exhaustion. Used to exercise out-of-gas in the post-call hook.
    // solhint-disable-next-line no-empty-blocks
    function burnGas() external {
        while (true) {}
    }

    /// @dev Fallback used by tests that simply want to assert "any call landed".
    fallback() external payable {
        if (alwaysRevert) revert("MockTarget: intentional revert");
        callCount += 1;
        lastCaller = msg.sender;
        lastValueObserved = msg.value;
        lastData = msg.data;
    }

    receive() external payable {
        if (alwaysRevert) revert("MockTarget: intentional revert");
    }
}
