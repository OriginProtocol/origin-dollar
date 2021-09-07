pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockUSDC is MintableERC20 {
    constructor() public ERC20("USDC Coin", "USDC") {}

    function decimals() public view override returns (uint8) {
        return 6;
    }
}
