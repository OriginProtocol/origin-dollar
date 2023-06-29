// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockWETH is MintableERC20 {
    constructor() ERC20("WETH", "WETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
    }
}
