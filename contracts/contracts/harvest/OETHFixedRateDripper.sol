// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { FixedRateDripper } from "./FixedRateDripper.sol";

/**
 * @title OETH FixedRateDripper Contract
 * @author Origin Protocol Inc
 */
contract OETHFixedRateDripper is FixedRateDripper {
    constructor(address _vault, address _token)
        FixedRateDripper(_vault, _token)
    {}
}
