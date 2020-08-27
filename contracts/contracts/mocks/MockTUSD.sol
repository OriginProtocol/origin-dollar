pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockTUSD is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "TUSD";
    string public constant name = "TrueUSD";
}
