// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../MintableERC20.sol";

contract MockFrax is MintableERC20 {
    constructor() ERC20("FRAX", "FRAX Token") {}
}
