pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockUSDT is MintableERC20 {
    uint256 public constant decimals = 6;
    string public constant symbol = "USDT";
    string public constant name = "USDT Coin";
}
