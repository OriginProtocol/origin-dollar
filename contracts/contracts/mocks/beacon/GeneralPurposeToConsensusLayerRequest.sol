// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

abstract contract GeneralPurposeToConsensusLayerRequest {
    // solhint-disable no-complex-fallback
    fallback() external payable {
        // fee requested
        if (msg.data.length == 0) {
            uint256 fee = _fee();
            // solhint-disable-next-line no-inline-assembly
            assembly {
                // Return a uint256 value
                mstore(0, fee)
                return(0, 32) // Return 32 bytes from memory
            }
        }

        // else handle request
        handleRequest(msg.data);
    }

    /***************************************
                 Abstract
    ****************************************/

    function _fee() internal virtual returns (uint256) {
        return 1;
    }

    function handleRequest(bytes calldata data) internal virtual;
}
