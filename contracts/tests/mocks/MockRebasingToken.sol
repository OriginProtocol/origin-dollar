// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @notice ERC20 with the OToken `rebaseOptIn()` surface.
/// @dev Mirrors the production rule that an account may only opt in once, so a
///      caller cannot paper over a mis-sequenced deploy by calling it twice.
contract MockRebasingToken is MockERC20 {
    mapping(address => bool) public isRebasing;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) MockERC20(_name, _symbol, _decimals) {}

    function rebaseOptIn() external {
        require(!isRebasing[msg.sender], "Account must be non-rebasing");
        isRebasing[msg.sender] = true;
    }
}
