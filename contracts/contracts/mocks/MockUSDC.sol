// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockUSDC is MintableERC20 {
    constructor() ERC20("USDC Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
