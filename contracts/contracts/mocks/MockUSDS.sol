// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockUSDS is MintableERC20 {
    constructor() ERC20("USDS", "USDS") {}
}
