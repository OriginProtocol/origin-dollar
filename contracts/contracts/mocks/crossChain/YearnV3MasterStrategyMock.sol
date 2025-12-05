// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Master Strategy Mock - the Mainnet part
 * @author Origin Protocol Inc
 */

import { YearnV3MasterStrategy } from "../../strategies/crossChain/YearnV3MasterStrategy.sol";
import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";

contract YearnV3MasterStrategyMock is YearnV3MasterStrategy {
    address public _slaveAddress;

    constructor(InitializableAbstractStrategy.BaseStrategyConfig memory _stratConfig) YearnV3MasterStrategy(_stratConfig) {}
    /**
     * @dev Returns the address of the Slave part of the strategy on L2
     */
    function slaveAddress() internal override returns (address) {
        return _slaveAddress;
    }

    function setSlaveAddress(address __slaveAddress) public {
        _slaveAddress = __slaveAddress;
    }
}
