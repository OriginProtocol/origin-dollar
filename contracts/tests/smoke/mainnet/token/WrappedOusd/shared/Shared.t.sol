// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/mainnet/token/OUSD/shared/Shared.t.sol";

import {IWOToken} from "contracts/interfaces/IWOToken.sol";

abstract contract Smoke_WrappedOusd_Shared_Test is Smoke_OUSD_Shared_Test {
    IWOToken internal wrappedOusd;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function _fetchContracts() internal virtual override {
        super._fetchContracts();
        wrappedOusd = IWOToken(resolver.resolve("WRAPPED_OUSD_PROXY"));
    }

    function _labelContracts() internal virtual override {
        super._labelContracts();
        vm.label(address(wrappedOusd), "WrappedOusd");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint OUSD for a user then deposit into WrappedOusd
    function _mintAndWrap(address user, uint256 usdcAmount) internal {
        _mintOUSD(user, usdcAmount);
        uint256 ousdBal = ousd.balanceOf(user);
        vm.startPrank(user);
        ousd.approve(address(wrappedOusd), ousdBal);
        wrappedOusd.deposit(ousdBal, user);
        vm.stopPrank();
    }
}
