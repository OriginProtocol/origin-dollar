// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { MockCurveAbstractMetapool } from "./MockCurveAbstractMetapool.sol";
import "../MintableERC20.sol";

contract MockCurveFrxEthWethPool is MockCurveAbstractMetapool {
    constructor(address[2] memory _coins)
        ERC20("Curve.fi Factory Plain Pool: frxETH/WETH", "frxeth-ng-f")
    {
        coins = _coins;
    }
}
