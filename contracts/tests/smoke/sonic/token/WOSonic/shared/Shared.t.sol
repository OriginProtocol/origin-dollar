// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OSonic_Shared_Test} from "tests/smoke/sonic/token/OSonic/shared/Shared.t.sol";

import {WOSonic} from "contracts/token/WOSonic.sol";

abstract contract Smoke_WOSonic_Shared_Test is Smoke_OSonic_Shared_Test {
    WOSonic internal woSonic;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function _fetchContracts() internal virtual override {
        super._fetchContracts();
        woSonic = WOSonic(resolver.resolve("WOSONIC_PROXY"));
    }

    function _labelContracts() internal virtual override {
        super._labelContracts();
        vm.label(address(woSonic), "WOSonic");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint OSonic for a user then deposit into WOSonic
    function _mintAndWrap(address user, uint256 wsAmount) internal {
        _mintOSonic(user, wsAmount);
        uint256 oSonicBal = oSonic.balanceOf(user);
        vm.startPrank(user);
        oSonic.approve(address(woSonic), oSonicBal);
        woSonic.deposit(oSonicBal, user);
        vm.stopPrank();
    }
}
