// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Dripper } from "./Dripper.sol";

/**
 * @title OETH Dripper Contract
 * @author Origin Protocol Inc
 */
contract OETHDripper is Dripper {
    constructor(address _vault, address _token) Dripper(_vault, _token) {}
}
