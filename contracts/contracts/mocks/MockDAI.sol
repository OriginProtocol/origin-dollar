pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockDAI is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "DAI";
    string public constant name = "DAI";
}
