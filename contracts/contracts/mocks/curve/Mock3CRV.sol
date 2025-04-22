// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ERC20, MintableERC20 } from "../MintableERC20.sol";
import { BurnableERC20 } from "../BurnableERC20.sol";

contract Mock3CRV is MintableERC20, BurnableERC20 {
    constructor() ERC20("Curve.fi DAI/USDC/USDT", "3Crv") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
