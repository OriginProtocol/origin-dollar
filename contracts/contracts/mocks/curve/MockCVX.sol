// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../MintableERC20.sol";

contract MockCVX is MintableERC20 {
    constructor() ERC20("CVX", "CVX DAO Token") {}
}
