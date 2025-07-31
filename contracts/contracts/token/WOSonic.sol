// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { WOETH } from "./WOETH.sol";

/**
 * @title Wrapped Origin Sonic (wOS) token on Sonic
 * @author Origin Protocol Inc
 */
contract WOSonic is WOETH {
    constructor(ERC20 underlying_) WOETH(underlying_) {}

    function name()
        public
        view
        virtual
        override(WOETH)
        returns (string memory)
    {
        return "Wrapped OS";
    }

    function symbol()
        public
        view
        virtual
        override(WOETH)
        returns (string memory)
    {
        return "wOS";
    }
}
