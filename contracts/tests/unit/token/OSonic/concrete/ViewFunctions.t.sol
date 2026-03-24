// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {OSonic} from "contracts/token/OSonic.sol";

contract Unit_Concrete_OSonic_ViewFunctions_Test is Base {
    OSonic internal oSonic;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        oSonic = new OSonic();
    }

    //////////////////////////////////////////////////////
    /// --- NAME / SYMBOL / DECIMALS
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(oSonic.name(), "Origin Sonic");
    }

    function test_symbol() public view {
        assertEq(oSonic.symbol(), "OS");
    }

    function test_decimals() public view {
        assertEq(oSonic.decimals(), 18);
    }
}
