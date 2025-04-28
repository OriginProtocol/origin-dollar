// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockUSDT is MintableERC20 {
    constructor() ERC20("USDT Coin", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
