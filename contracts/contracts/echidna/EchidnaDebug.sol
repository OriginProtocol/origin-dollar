// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import "./EchidnaHelper.sol";
import "./Debugger.sol";

import "../token/OUSD.sol";

/**
 * @title Room for random debugging functions
 * @author Rappie
 */
contract EchidnaDebug is EchidnaHelper {
    function debugOUSD() public pure {
        // assert(ousd.balanceOf(ADDRESS_USER0) == 1000);
        // assert(ousd.rebaseState(ADDRESS_USER0) != OUSD.RebaseOptions.OptIn);
        // assert(Address.isContract(ADDRESS_CONTRACT0));
        // Debugger.log("nonRebasingSupply", ousd.nonRebasingSupply());
        // assert(false);
    }
}
