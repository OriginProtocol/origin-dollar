// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Cross-chain Remote Strategy Mock - the L2 chain part
 * @author Origin Protocol Inc
 */

import { CrossChainRemoteStrategy } from "../../strategies/crossChain/CrossChainRemoteStrategy.sol";

contract CrossChainRemoteStrategyMock is CrossChainRemoteStrategy {
    address public _masterAddress;

    constructor() CrossChainRemoteStrategy() {}

    /**
     * @dev Returns the address of the Master Strategy on the other chain
     */
    function masterAddress() internal override returns (address) {
        return _masterAddress;
    }

    function setMasterAddress(address __masterAddress) public {
        _masterAddress = __masterAddress;
    }
}
