pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract OUSD is ERC20, ERC20Detailed {

    uint8 private constant DECIMALS = 18;

    constructor () public ERC20Detailed("Origin Dollar", "OUSD", DECIMALS) {
        _mint(msg.sender, 1000);
    }
}
