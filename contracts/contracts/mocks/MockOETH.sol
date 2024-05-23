// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";
import "./BurnableERC20.sol";

contract MockOETH is MintableERC20, BurnableERC20 {
    constructor() ERC20("WOETH", "WOETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
    }
}