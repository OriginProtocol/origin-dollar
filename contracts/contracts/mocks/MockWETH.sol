// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockWETH is MintableERC20 {
    constructor() ERC20("WETH", "WETH") {}
}
