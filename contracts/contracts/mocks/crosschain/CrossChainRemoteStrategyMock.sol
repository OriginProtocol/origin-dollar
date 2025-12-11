// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Remote Strategy Mock - the Mainnet part
 * @author Origin Protocol Inc
 */

contract CrossChainRemoteStrategyMock {
    address public _masterAddress;

    constructor() {}

    function masterAddress() internal override returns (address) {
        return _masterAddress;
    }

    function setMasterAddress(address __masterAddress) public {
        _masterAddress = __masterAddress;
    }
}
