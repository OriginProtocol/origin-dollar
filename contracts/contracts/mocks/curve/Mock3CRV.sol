// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../MintableERC20.sol";

contract Mock3CRV is MintableERC20 {
    constructor() ERC20("Curve.fi DAI/USDC/USDT", "3Crv") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function burnFrom(address from, uint256 value) public {
        _burn(from, value);
    }
}
