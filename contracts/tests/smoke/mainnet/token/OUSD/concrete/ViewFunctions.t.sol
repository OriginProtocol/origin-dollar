// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/mainnet/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_ViewFunctions_Test is Smoke_OUSD_Shared_Test {
    function test_name() public view {
        assertEq(ousd.name(), "Origin Dollar");
    }

    function test_symbol() public view {
        assertEq(ousd.symbol(), "OUSD");
    }

    function test_decimals() public view {
        assertEq(ousd.decimals(), 18);
    }

    function test_totalSupply_isNonZero() public view {
        assertGt(ousd.totalSupply(), 0);
    }

    function test_vaultAddress_matchesResolver() public view {
        assertEq(ousd.vaultAddress(), address(ousdVault));
    }

    function test_rebasingCreditsPerTokenHighres_isValid() public view {
        uint256 creditsPerToken = ousd.rebasingCreditsPerTokenHighres();
        assertGt(creditsPerToken, 0);
        assertLe(creditsPerToken, 1e27);
    }

    function test_nonRebasingSupply_lessThanTotalSupply() public view {
        assertLt(ousd.nonRebasingSupply(), ousd.totalSupply());
    }

    function test_supplyInvariant() public view {
        _assertSupplyInvariant();
    }
}
