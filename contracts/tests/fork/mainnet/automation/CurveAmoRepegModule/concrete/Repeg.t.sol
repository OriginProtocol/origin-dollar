// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurveAmoRepegModule_Base_Test} from "tests/fork/CurveAmoRepegModuleBase.t.sol";

contract Fork_Mainnet_CurveAmoRepegModule_Repeg_Test is Fork_CurveAmoRepegModule_Base_Test {
    function setUp() public override {
        super.setUp();
        _createAndSelectForkMainnet();
    }

    function test_RepegOUSDThroughRealSafe() external {
        _runRepeg(
            Profile({
                vault: 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70,
                token: 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86,
                amo: 0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11,
                checker: 0x25041Ccb8352b9BA65883a94685aeF07a5aD8739,
                tokenIndex: 0,
                varianceCap: 1e18
            })
        );
    }

    function test_RepegOETHThroughRealSafe() external {
        _runRepeg(
            Profile({
                vault: 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab,
                token: 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3,
                amo: 0xba0e352AB5c13861C26e4E773e7a833C3A223FE6,
                checker: 0x31FD8618379D8e473Ec2B1540B906E8e11D2A99b,
                tokenIndex: 0,
                varianceCap: 1e14
            })
        );
    }
}
