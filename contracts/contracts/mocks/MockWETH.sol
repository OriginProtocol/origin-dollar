pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockWETH is MintableERC20 {
    constructor() public ERC20("WETH", "WETH") {}
}
