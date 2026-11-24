// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurveAmoRepegModule_Base_Test} from "tests/fork/CurveAmoRepegModuleBase.t.sol";

contract Fork_Base_CurveAmoRepegModule_Repeg_Test is Fork_CurveAmoRepegModule_Base_Test {
    function setUp() public override {
        super.setUp();
        _createAndSelectForkBase();
    }

    function test_RepegSuperOETHThroughRealSafe() external {
        _runRepeg(
            Profile({
                vault: 0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93,
                token: 0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3,
                amo: 0x9cfcAF81600155e01c63e4D2993A8A81A8205829,
                checker: 0x9D98Cf85B65Fa1ACef5e9AAA2300753aDF7bcf6A,
                tokenIndex: 1,
                varianceCap: 1e14
            })
        );
    }
}
