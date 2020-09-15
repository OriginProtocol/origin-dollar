pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockWETH is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "WETH";
    string public constant name = "WETH";
}
