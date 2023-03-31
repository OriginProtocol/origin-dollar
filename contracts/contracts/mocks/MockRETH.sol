// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "./MintableERC20.sol";
import "../interfaces/IExchangeRateToken.sol";

contract MockRETH is MintableERC20, IExchangeRateToken {
    uint256 public override exchangeRate = 12e17;

    constructor() ERC20("Rocket Pool ETH", "rETH") {}

    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }
}
