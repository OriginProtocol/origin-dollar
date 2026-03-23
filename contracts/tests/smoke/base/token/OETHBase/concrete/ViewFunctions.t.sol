// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_ViewFunctions_Test is Smoke_OETHBase_Shared_Test {
    function test_name() public view {
        assertEq(oethBase.name(), "Super OETH");
    }

    function test_symbol() public view {
        assertEq(oethBase.symbol(), "superOETHb");
    }

    function test_decimals() public view {
        assertEq(oethBase.decimals(), 18);
    }

    function test_totalSupply_isNonZero() public view {
        assertGt(oethBase.totalSupply(), 0);
    }

    function test_vaultAddress_matchesResolver() public view {
        assertEq(oethBase.vaultAddress(), address(oethBaseVault));
    }

    function test_rebasingCreditsPerTokenHighres_isValid() public view {
        uint256 creditsPerToken = oethBase.rebasingCreditsPerTokenHighres();
        assertGt(creditsPerToken, 0);
        assertLe(creditsPerToken, 1e27);
    }

    function test_nonRebasingSupply_lessThanTotalSupply() public view {
        assertLt(oethBase.nonRebasingSupply(), oethBase.totalSupply());
    }

    function test_supplyInvariant() public view {
        _assertSupplyInvariant();
    }
}
