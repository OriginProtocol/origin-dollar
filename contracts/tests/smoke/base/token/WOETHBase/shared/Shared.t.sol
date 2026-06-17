// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

// --- Project imports
import {IWOToken} from "contracts/interfaces/IWOToken.sol";

abstract contract Smoke_WOETHBase_Shared_Test is Smoke_OETHBase_Shared_Test {
    IWOToken internal woethBase;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function _fetchContracts() internal virtual override {
        super._fetchContracts();
        woethBase = IWOToken(resolver.resolve("WOETHBASE_PROXY"));
    }

    function _labelContracts() internal virtual override {
        super._labelContracts();
        vm.label(address(woethBase), "WOETHBase");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint OETHBase for a user then deposit into WOETHBase
    function _mintAndWrap(address user, uint256 wethAmount) internal {
        _mintOETHBase(user, wethAmount);
        uint256 oethBaseBal = oethBase.balanceOf(user);
        vm.startPrank(user);
        oethBase.approve(address(woethBase), oethBaseBal);
        woethBase.deposit(oethBaseBal, user);
        vm.stopPrank();
    }
}
