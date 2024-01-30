// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockAura is MintableERC20 {
    constructor() ERC20("Aura", "AURA") {}
}
