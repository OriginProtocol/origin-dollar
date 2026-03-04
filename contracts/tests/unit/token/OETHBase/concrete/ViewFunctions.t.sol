// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.sol";
import {OETHBase} from "contracts/token/OETHBase.sol";

contract Unit_Concrete_OETHBase_ViewFunctions_Test is Base {
    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        oethBase = new OETHBase();
    }

    //////////////////////////////////////////////////////
    /// --- NAME / SYMBOL / DECIMALS
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(oethBase.name(), "Super OETH");
    }

    function test_symbol() public view {
        assertEq(oethBase.symbol(), "superOETHb");
    }

    function test_decimals() public view {
        assertEq(oethBase.decimals(), 18);
    }
}
