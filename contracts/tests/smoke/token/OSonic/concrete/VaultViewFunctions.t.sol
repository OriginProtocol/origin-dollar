// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OSonic_Shared_Test} from "tests/smoke/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_VaultViewFunctions_Test is Smoke_OSonic_Shared_Test {
    function test_totalValue_isNonZero() public view {
        assertGt(oSonicVault.totalValue(), 0);
    }

    function test_totalValue_correlatesWithTotalSupply() public view {
        uint256 totalVal = oSonicVault.totalValue();
        uint256 totalSup = oSonic.totalSupply();
        // Within 5% of total supply
        assertApproxEqRel(totalVal, totalSup, 0.05e18);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(oSonicVault.checkBalance(address(wrappedSonic)), 0);
    }

    function test_asset_matchesUnderlying() public view {
        assertEq(oSonicVault.asset(), address(wrappedSonic));
    }

    function test_oToken_matchesToken() public view {
        assertEq(address(oSonicVault.oToken()), address(oSonic));
    }

    function test_getAllAssets_isConsistent() public view {
        assertEq(oSonicVault.getAllAssets().length, oSonicVault.getAssetCount());
    }

    function test_getAllStrategies_isConsistent() public view {
        assertEq(oSonicVault.getAllStrategies().length, oSonicVault.getStrategyCount());
    }

    function test_isSupportedAsset_underlying() public view {
        assertTrue(oSonicVault.isSupportedAsset(address(wrappedSonic)));
    }

    function test_isSupportedAsset_random() public view {
        assertFalse(oSonicVault.isSupportedAsset(address(1)));
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(oSonicVault.rebasePaused());
        assertFalse(oSonicVault.capitalPaused());
    }
}
