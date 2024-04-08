// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { MockCurveAbstractMetapool } from "./MockCurveAbstractMetapool.sol";
import "../MintableERC20.sol";

contract MockCurveLUSDMetapool is MockCurveAbstractMetapool {
    constructor(address[2] memory _coins)
        ERC20("Curve.fi Factory USD Metapool: LUSD", "LUSD3CRV-f")
    {
        coins = _coins;
    }
}
