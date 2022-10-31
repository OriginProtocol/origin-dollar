// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "openzeppelin-4.6.0/token/ERC20/ERC20.sol";
import "openzeppelin-4.6.0/token/ERC20/extensions/ERC20Burnable.sol";
import "openzeppelin-4.6.0/access/Ownable.sol";

contract NonUUPSToken is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("TestToken", "TST") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
