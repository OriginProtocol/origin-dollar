// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Cross-chain Master Strategy Mock - the Mainnet part
 * @author Origin Protocol Inc
 */

import { CrossChainMasterStrategy } from "../../strategies/crossChain/CrossChainMasterStrategy.sol";
import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";

contract CrossChainMasterStrategyMock is CrossChainMasterStrategy {
    address public _remoteAddress;

    constructor(
        InitializableAbstractStrategy.BaseStrategyConfig memory _stratConfig
    ) CrossChainMasterStrategy(_stratConfig) {}

    /**
     * @dev Returns the address of the Remote part of the strategy on L2
     */
    function remoteAddress() internal override returns (address) {
        return _remoteAddress;
    }

    function setRemoteAddress(address __remoteAddress) public {
        _remoteAddress = __remoteAddress;
    }
}
