// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WOETH } from "./WOETH.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title wOETH (Plume) Token Contract
 * @author Origin Protocol Inc
 */

contract WOETHPlume is WOETH {
    constructor(ERC20 underlying_) WOETH(underlying_) {}

    function name() public view virtual override returns (string memory) {
        return "Wrapped Super OETH";
    }

    function symbol() public view virtual override returns (string memory) {
        return "wsuperOETHp";
    }
}
