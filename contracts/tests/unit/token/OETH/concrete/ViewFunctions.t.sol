// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";

import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_OETH_ViewFunctions_Test is Base {
    IOToken internal oeth;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        oeth = IOToken(vm.deployCode(Tokens.OETH));
    }

    //////////////////////////////////////////////////////
    /// --- NAME / SYMBOL / DECIMALS
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(oeth.name(), "Origin Ether");
    }

    function test_symbol() public view {
        assertEq(oeth.symbol(), "OETH");
    }

    function test_decimals() public view {
        assertEq(oeth.decimals(), 18);
    }
}
