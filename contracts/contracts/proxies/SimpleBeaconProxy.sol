// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBeaconProxy {
    function beaconImplementation() external view returns (address);
}

contract SimpleBeaconProxy {
    address public immutable beacon;

    constructor(address _beacon) {
        beacon = _beacon;
    }

    function _delegate(address _impl) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), _impl, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    fallback() external payable {
        _delegate(IBeaconProxy(beacon).beaconImplementation());
    }

    receive() external payable {}
}
