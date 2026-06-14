// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSonic_Shared_Test} from "tests/smoke/sonic/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_ViewFunctions_Test is Smoke_OSonic_Shared_Test {
    function test_name() public view {
        assertEq(oSonic.name(), "Origin Sonic");
    }

    function test_symbol() public view {
        assertEq(oSonic.symbol(), "OS");
    }

    function test_decimals() public view {
        assertEq(oSonic.decimals(), 18);
    }

    function test_totalSupply_isNonZero() public view {
        assertGt(oSonic.totalSupply(), 0);
    }

    function test_vaultAddress_matchesResolver() public view {
        assertEq(oSonic.vaultAddress(), address(oSonicVault));
    }

    function test_rebasingCreditsPerTokenHighres_isValid() public view {
        uint256 creditsPerToken = oSonic.rebasingCreditsPerTokenHighres();
        assertGt(creditsPerToken, 0);
        assertLe(creditsPerToken, 1e27);
    }

    function test_nonRebasingSupply_lessThanTotalSupply() public view {
        assertLt(oSonic.nonRebasingSupply(), oSonic.totalSupply());
    }

    function test_supplyInvariant() public view {
        _assertSupplyInvariant();
    }
}
