pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockTUSD is MintableERC20 {
    constructor() public ERC20("TrueUSD", "TUSD") {}

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
