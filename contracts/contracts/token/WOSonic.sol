// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WOETH } from "./WOETH.sol";

/**
 * @title Wrapped Origin Sonic (wOS) token on Sonic
 * @author Origin Protocol Inc
 */
contract WOSonic is WOETH {
    constructor(address underlying_, address vault_)
        WOETH(underlying_, vault_)
    {}

    function name() public view virtual override returns (string memory) {
        return "Wrapped OS";
    }

    function symbol() public view virtual override returns (string memory) {
        return "wOS";
    }
}
