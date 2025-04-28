// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SuperOETHHarvester } from "./SuperOETHHarvester.sol";

contract OSonicHarvester is SuperOETHHarvester {
    /// @param _wrappedNativeToken Address of the native Wrapped S (wS) token
    constructor(address _wrappedNativeToken)
        SuperOETHHarvester(_wrappedNativeToken)
    {}
}
