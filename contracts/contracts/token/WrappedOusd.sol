// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WOETH } from "./WOETH.sol";

contract WrappedOusd is WOETH {
    constructor(address underlying_, address vault_)
        WOETH(underlying_, vault_)
    {}

    function name() public view override returns (string memory) {
        return "Wrapped OUSD";
    }

    function symbol() public view override returns (string memory) {
        return "WOUSD";
    }
}
