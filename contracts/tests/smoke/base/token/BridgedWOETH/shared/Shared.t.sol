// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

import {IBridgedWOETH} from "contracts/interfaces/IBridgedWOETH.sol";

abstract contract Smoke_Base_BridgedWOETH_Shared_Test is BaseSmoke {
    IBridgedWOETH internal bridgedWOETH;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        bridgedWOETH = IBridgedWOETH(resolver.resolve("BRIDGED_WOETH"));
        vm.label(address(bridgedWOETH), "BridgedWOETH");
    }
}
