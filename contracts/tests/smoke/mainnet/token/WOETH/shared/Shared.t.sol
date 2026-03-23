// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETH_Shared_Test} from "tests/smoke/mainnet/token/OETH/shared/Shared.t.sol";

import {WOETH} from "contracts/token/WOETH.sol";

abstract contract Smoke_WOETH_Shared_Test is Smoke_OETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function _fetchContracts() internal virtual override {
        super._fetchContracts();
        woeth = WOETH(resolver.resolve("WOETH_PROXY"));
    }

    function _labelContracts() internal virtual override {
        super._labelContracts();
        vm.label(address(woeth), "WOETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint OETH for a user then deposit into WOETH
    function _mintAndWrap(address user, uint256 wethAmount) internal {
        _mintOETH(user, wethAmount);
        uint256 oethBal = oeth.balanceOf(user);
        vm.startPrank(user);
        oeth.approve(address(woeth), oethBal);
        woeth.deposit(oethBal, user);
        vm.stopPrank();
    }
}
