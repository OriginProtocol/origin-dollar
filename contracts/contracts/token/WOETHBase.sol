// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WOETH } from "./WOETH.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 */

contract WOETHBase is WOETH {
    constructor(
        ERC20 underlying_,
        string memory name_,
        string memory symbol_
    ) WOETH(underlying_, name_, symbol_) {}

    function name() public view virtual override returns (string memory) {
        return "Wrapped OETH Base";
    }

    function symbol() public view virtual override returns (string memory) {
        return "wOETHb";
    }
}
