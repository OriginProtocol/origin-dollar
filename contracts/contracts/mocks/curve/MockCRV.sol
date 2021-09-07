pragma solidity ^0.8.0;

import "../MintableERC20.sol";

contract MockCRV is MintableERC20 {
    constructor() public ERC20("Curve DAO Token", "CRV") {}

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
