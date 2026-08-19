// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @notice Minimal stand-in for `AbstractARM`'s pause surface, mirroring the split
///         introduced in arm-oeth PR #337: `pause()` accepts the guardian (the Safe
///         that hosts the pause module), `unpause()` accepts only the admin multisig.
///         Enough to prove the module can trip an ARM-shaped target and cannot lift it.
contract MockPausableARM {
    bool public paused;

    address public guardian;
    address public adminMultisig;

    error OnlyPauser();
    error OnlyUnpauser();

    constructor(address _guardian, address _adminMultisig) {
        guardian = _guardian;
        adminMultisig = _adminMultisig;
    }

    function pause() external {
        if (msg.sender != guardian && msg.sender != adminMultisig) {
            revert OnlyPauser();
        }
        paused = true;
    }

    function unpause() external {
        if (msg.sender != adminMultisig) revert OnlyUnpauser();
        paused = false;
    }
}
