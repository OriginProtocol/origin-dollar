// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WOETH } from "./WOETH.sol";

/**
 * @title Wapped Token Contract
 * @author Origin Protocol Inc
 */

contract WOETHBase is WOETH {
    constructor(address underlying_, address vault_)
        WOETH(underlying_, vault_)
    {}

    function name() public view virtual override returns (string memory) {
        return "Wrapped Super OETH";
    }

    function symbol() public view virtual override returns (string memory) {
        return "wsuperOETHb";
    }
}
