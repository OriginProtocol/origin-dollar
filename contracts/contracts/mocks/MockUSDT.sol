pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockUSDT is MintableERC20 {
    constructor() public ERC20("USDT Coin", "USDT") {}

    function decimals() public view override returns (uint8) {
        return 6;
    }
}
