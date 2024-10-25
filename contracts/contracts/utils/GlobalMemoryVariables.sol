// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * This contract simulates contract scope globally accessible uint256 variables that behave like memory variables.
 * They do not change the state of the contract and their lifetime cycle starts and stops with the function containing
 * 
 * This is gas efficient since it only consumes 200 gas per the setting of the variable
 */

contract GlobalMemoryVariables {
    // variable not initialized for the scope of the function
    uint256 constant _INACTIVE = 0;
    // variable initialized - its state can be fetched or set 
    uint256 constant _ACTIVATED = 1;

    // keccak256("Origin.memory.variables");
    bytes32 private constant memoryVariablesBaseHash =
        0xed51668ff9046e2d24ea6b21394f5bc87977908d2fa08539e53f875837ccad3a;

    /**
     * @dev unlock variable for the scope of the function execution with the final assertion that must match
     * the state of the variable
     */
    modifier scopeVariableWithAssertion(string memory _variableName, uint256 equalsValue) {
        bytes32 position = _setup(_variableName);
        _;
        uint256 value = _getGlobalVariable(_variableName);
        require(value == equalsValue, "Variable values do not match");
        _tearDown(_variableName, position);
    }

    /**
     * @dev unlock variable for the scope of the function execution
     */
    modifier scopeVariable(string memory _variableName) {
        bytes32 position = _setup(_variableName);
        _;
        _tearDown(_variableName, position);
    }

    function _setGlobalVariable(string memory _variableName, uint256 _newValue) internal {
        bytes32 position = _getPosition(_variableName);
        // will trigger an exception of variable not enabled
        _getGlobalVariable(_variableName);

        require(_newValue != 0 && _newValue != 1, "Variable reserved values");

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(position, _newValue)
        }
    }

    function _getGlobalVariable(string memory _variableName) internal returns(uint256 value) {
        bytes32 position = _getPosition(_variableName);

        // solhint-disable-next-line no-inline-assembly
        assembly {
            value := sload(position)
        }

        require(value != 0, "Variable not enabled");
    }

    /**
     * @dev setup required state for global variable
     */
    function _setup(string memory _variableName) private returns(bytes32 position) {
        position = _getPosition(_variableName);

        uint256 _variableValue;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _variableValue := sload(position)
        }

        // multiple modifiers have initialized this variable
        require(_variableValue == _INACTIVE, "Variable already initialized");

        // from this point forward the state can be updated using `_setGlobalVariable`
        assembly {
            sstore(position, _ACTIVATED)
        }
    }

    /**
     * @dev clean up state so contract storage is not affected and gas is refunded
     */
    function _tearDown(string memory _variableName, bytes32 position) private {
        /* By resetting the original value to 0 most of the gas is refunded. The final gas usage
         * is 200 gas times the amount the variable has been altered 
         * 
         * See https://eips.ethereum.org/EIPS/eip-2200 section "Original Value Being Zero"
         */

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(position, _INACTIVE)
        }
    }

    /**
     * @dev compute variable position in memory
     */
    function _getPosition(string memory _variableName) private returns(bytes32 position) {
        bytes memory variableNameBytes = bytes(_variableName);
        require(variableNameBytes.length > 0, "Can not use empty var names");

        // unique memory position for each variable
        position = keccak256(abi.encodePacked(memoryVariablesBaseHash, _variableName));
    }
}