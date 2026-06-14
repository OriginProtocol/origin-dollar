// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETH_Shared_Test} from "tests/smoke/mainnet/token/OETH/shared/Shared.t.sol";

// --- Project imports
import {IWOToken} from "contracts/interfaces/IWOToken.sol";

abstract contract Smoke_WOETH_Shared_Test is Smoke_OETH_Shared_Test {
    IWOToken internal woeth;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function _fetchContracts() internal virtual override {
        super._fetchContracts();
        woeth = IWOToken(resolver.resolve("WOETH_PROXY"));
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
