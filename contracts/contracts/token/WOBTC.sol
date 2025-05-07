// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { WOETH } from "./WOETH.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Wrapped OBTC Token Contract
 * @author Origin Protocol Inc
 */

contract WOBTC is WOETH {
    constructor(ERC20 underlying_) WOETH(underlying_) {}

    function name() public view virtual override returns (string memory) {
        return "Wrapped OBTC";
    }

    function symbol() public view virtual override returns (string memory) {
        return "wOBTC";
    }
}
