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

    // TODO need to handle native ETH transfers
}
