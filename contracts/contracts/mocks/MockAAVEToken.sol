pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockAAVEToken is MintableERC20 {
    constructor() public ERC20("AAVE", "AAVE") {}
}
