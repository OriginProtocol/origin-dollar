// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title MockImplementation
 * @dev Simple mock contract used as a proxy implementation target in tests.
 */
contract MockImplementation {
    uint256 private _value;
    bool private _initialized;

    event Initialized();

    function initialize() external {
        require(!_initialized, "Already initialized");
        _initialized = true;
        emit Initialized();
    }

    function setValue(uint256 newValue) external {
        _value = newValue;
    }

    function getValue() external view returns (uint256) {
        return _value;
    }

    function revertingFunction() external pure {
        revert("MockImplementation: reverted");
    }

    receive() external payable {}
}

/**
 * @title MockImplementationV2
 * @dev Second version of mock implementation for testing upgrades.
 */
contract MockImplementationV2 {
    uint256 private _value;
    bool private _initialized;
    uint256 private _version;

    function setValue(uint256 newValue) external {
        _value = newValue;
    }

    function getValue() external view returns (uint256) {
        return _value;
    }

    function setVersion(uint256 newVersion) external payable {
        _version = newVersion;
    }

    function getVersion() external view returns (uint256) {
        return _version;
    }

    receive() external payable {}
}
