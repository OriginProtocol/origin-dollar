// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Master Strategy Mock - the Mainnet part
 * @author Origin Protocol Inc
 */

contract CrossChainMasterStrategyMock {
    address public _remoteAddress;

    constructor() {}

    function remoteAddress() public view returns (address) {
        return _remoteAddress;
    }

    function setRemoteAddress(address __remoteAddress) public {
        _remoteAddress = __remoteAddress;
    }
}
