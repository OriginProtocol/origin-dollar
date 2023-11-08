// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { MockCurveAbstractMetapool } from "./MockCurveAbstractMetapool.sol";
import "../MintableERC20.sol";

contract MockCurveOethEthPool is MockCurveAbstractMetapool {
    constructor(address[2] memory _coins)
        ERC20("Curve.fi Factory Pool: OETH", "OETHCRV-f")
    {
        coins = _coins;
    }

    // Simulate pool's EMA Oracle price
    uint256 public price_oracle = 9995e14; // 0.9995

    function setOraclePrice(uint256 _price) public {
        price_oracle = _price;
    }
}
