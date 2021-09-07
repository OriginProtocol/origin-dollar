pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockCOMP is MintableERC20 {
    constructor() public ERC20("COMP", "COMP", 18) {}
}
