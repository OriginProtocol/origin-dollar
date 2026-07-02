// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title MockReentrantReceiver
 * @notice TEST-ONLY bridge-delivery recipient that attempts to re-enter the strategy from the
 *         post-delivery callback (`_postDeliveryCall`). Used to prove the `nonReentrant` guard on
 *         `_handleInboundBridgeMessage` blocks re-entry while delivery still completes.
 * @dev Uses a low-level call for the re-entry so it records the outcome instead of bubbling the
 *      revert (a bubbled revert would roll back `reentered`, making it unobservable).
 */
contract MockReentrantReceiver {
    address public target;
    bytes public reentryCallData;
    bool public reentered;
    bool public reentrySucceeded;

    /// @notice Configure which contract to re-enter and with what calldata.
    function arm(address _target, bytes calldata _reentryCallData) external {
        target = _target;
        reentryCallData = _reentryCallData;
    }

    /// @notice Invoked by the strategy's post-delivery callback; attempts the re-entry.
    function attack() external {
        reentered = true;
        // slither-disable-next-line low-level-calls
        (bool ok, ) = target.call(reentryCallData);
        reentrySucceeded = ok;
    }
}
