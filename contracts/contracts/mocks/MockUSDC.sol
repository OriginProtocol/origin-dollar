pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockUSDC is MintableERC20 {
    uint256 public constant decimals = 6;
    string public constant symbol = "USDC";
    string public constant name = "USD Coin";
}
