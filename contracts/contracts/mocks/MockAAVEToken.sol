pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockAAVEToken is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "AAVE";
    string public constant name = "AAVE";
}
