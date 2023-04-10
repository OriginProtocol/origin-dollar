// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockAAVEToken is MintableERC20 {
    constructor() ERC20("AAVE", "AAVE") {}
}
