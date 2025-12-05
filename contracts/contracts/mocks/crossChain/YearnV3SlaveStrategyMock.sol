// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Master Strategy Mock - the Mainnet part
 * @author Origin Protocol Inc
 */

import { YearnV3SlaveStrategy } from "../../strategies/crossChain/YearnV3SlaveStrategy.sol";

contract YearnV3SlaveStrategyMock is YearnV3SlaveStrategy {
    address public _masterAddress;

    constructor() YearnV3SlaveStrategy() {}

    /**
     * @dev Returns the address of the Slave part of the strategy on L2
     */
    function masterAddress() internal override returns (address) {
        return _masterAddress;
    }

    function setMasterAddress(address __masterAddress) public {
        _masterAddress = __masterAddress;
    }
}
