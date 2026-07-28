// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Base} from "tests/utils/Addresses.sol";

import {IBridgedWOETH} from "contracts/interfaces/IBridgedWOETH.sol";

contract Fork_Concrete_Base_BridgedWOETH_Test is BaseFork {
    IBridgedWOETH internal bridgedWOETH;
    address internal roleMinter;
    address internal roleBurner;

    function setUp() public override {
        super.setUp();
        _createAndSelectForkBase();
        bridgedWOETH = IBridgedWOETH(Base.BridgedWOETH);
        roleMinter = makeAddr("RoleMinter");
        roleBurner = makeAddr("RoleBurner");
    }

    function test_minterAndBurnerRoles_workOnDeployedProxy() public {
        address tokenGovernor = bridgedWOETH.governor();

        vm.startPrank(tokenGovernor);
        bridgedWOETH.grantRole(bridgedWOETH.MINTER_ROLE(), roleMinter);
        bridgedWOETH.grantRole(bridgedWOETH.BURNER_ROLE(), roleBurner);
        vm.stopPrank();

        vm.prank(roleMinter);
        bridgedWOETH.mint(alice, 1 ether);

        vm.prank(roleBurner);
        bridgedWOETH.burn(alice, 0.4 ether);

        assertEq(bridgedWOETH.balanceOf(alice), 0.6 ether);
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.MINTER_ROLE(), roleMinter));
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.BURNER_ROLE(), roleBurner));
    }
}
