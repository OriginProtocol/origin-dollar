// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {Tokens} from "tests/utils/Artifacts.sol";

import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_OETHBase_ViewFunctions_Test is Base {
    IOToken internal oethBase;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        oethBase = IOToken(vm.deployCode(Tokens.OETH_BASE));
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
