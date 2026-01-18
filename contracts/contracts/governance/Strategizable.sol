// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Governable } from "./Governable.sol";

contract Strategizable is Governable {
    event StrategistUpdated(address _address);

    // Address of strategist
    address public strategistAddr;

    // For future use
    uint256[50] private __gap;

    /**
     * @dev Verifies that the caller is either Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() virtual {
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    /**
     * @dev Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        _setStrategistAddr(_address);
    }

    /**
     * @dev Set address of Strategist
     * @param _address Address of Strategist
     */
    function _setStrategistAddr(address _address) internal {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }
}
