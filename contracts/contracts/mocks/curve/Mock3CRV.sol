pragma solidity ^0.8.0;

import "../MintableERC20.sol";

contract Mock3CRV is MintableERC20 {
    constructor() public ERC20("Curve.fi DAI/USDC/USDT", "3Crv") {}

    function decimals() public view override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 value) public {
        _mint(to, value);
    }

    function burnFrom(address from, uint256 value) public {
        _burn(from, value);
    }
}
