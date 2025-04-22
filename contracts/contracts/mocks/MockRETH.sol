// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./MintableERC20.sol";
import "../interfaces/IGetExchangeRateToken.sol";

contract MockRETH is MintableERC20, IGetExchangeRateToken {
    uint256 private exchangeRate = 12e17;

    constructor() ERC20("Rocket Pool ETH", "rETH") {}

    function getExchangeRate() external view override returns (uint256) {
        return exchangeRate;
    }

    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }
}
