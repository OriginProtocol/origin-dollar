// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";

import {IBridgedWOETH} from "contracts/interfaces/IBridgedWOETH.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";

abstract contract Unit_BridgedWOETH_Shared_Test is Base {
    IBridgedWOETH internal bridgedWOETH;
    IProxy internal bridgedWOETHProxy;

    address internal minter;
    address internal burner;

    function setUp() public virtual override {
        super.setUp();

        minter = makeAddr("Minter");
        burner = makeAddr("Burner");

        vm.startPrank(deployer);
        address implementation = vm.deployCode(Tokens.BRIDGED_WOETH);
        bridgedWOETHProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        bridgedWOETHProxy.initialize(implementation, governor, "");
        vm.stopPrank();

        bridgedWOETH = IBridgedWOETH(address(bridgedWOETHProxy));

        vm.startPrank(governor);
        bridgedWOETH.initialize();
        bridgedWOETH.grantRole(bridgedWOETH.MINTER_ROLE(), minter);
        bridgedWOETH.grantRole(bridgedWOETH.BURNER_ROLE(), burner);
        vm.stopPrank();

        vm.label(address(bridgedWOETH), "BridgedWOETH");
        vm.label(minter, "Minter");
        vm.label(burner, "Burner");
    }
}
