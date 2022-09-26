// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { MockCurveAbstractMetapool } from "./MockCurveAbstractMetapool.sol";
import "../MintableERC20.sol";

contract MockCurvealUSDMetapool is MockCurveAbstractMetapool {
    constructor(address[2] memory _coins)
        ERC20("Curve.fi Factory USD Metapool: alUSD", "ALUSD3CRV-f")
    {
        coins = _coins;
    }
}
