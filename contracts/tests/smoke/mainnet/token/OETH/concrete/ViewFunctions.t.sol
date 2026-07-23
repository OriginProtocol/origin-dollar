// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETH_Shared_Test} from "tests/smoke/mainnet/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_ViewFunctions_Test is Smoke_OETH_Shared_Test {
    function test_name() public view {
        assertEq(oeth.name(), "Origin Ether");
    }

    function test_symbol() public view {
        assertEq(oeth.symbol(), "OETH");
    }

    function test_decimals() public view {
        assertEq(oeth.decimals(), 18);
    }

    function test_totalSupply_isNonZero() public view {
        assertGt(oeth.totalSupply(), 0);
    }

    function test_vaultAddress_matchesResolver() public view {
        assertEq(oeth.vaultAddress(), address(oethVault));
    }

    function test_rebasingCreditsPerTokenHighres_isValid() public view {
        uint256 creditsPerToken = oeth.rebasingCreditsPerTokenHighres();
        assertGt(creditsPerToken, 0);
        assertLe(creditsPerToken, 1e27);
    }

    function test_nonRebasingSupply_lessThanTotalSupply() public view {
        assertLt(oeth.nonRebasingSupply(), oeth.totalSupply());
    }

    function test_supplyInvariant() public view {
        _assertSupplyInvariant();
    }
}
