// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockSSV is MintableERC20 {
    constructor() ERC20("SSV Token", "SSV") {}
}
