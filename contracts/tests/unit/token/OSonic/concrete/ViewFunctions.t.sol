// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";

import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_OSonic_ViewFunctions_Test is Base {
    IOToken internal oSonic;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        oSonic = IOToken(vm.deployCode(Tokens.OS));
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
