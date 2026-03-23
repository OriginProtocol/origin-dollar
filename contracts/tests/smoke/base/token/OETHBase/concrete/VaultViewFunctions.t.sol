// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_VaultViewFunctions_Test is Smoke_OETHBase_Shared_Test {
    function test_totalValue_isNonZero() public view {
        assertGt(oethBaseVault.totalValue(), 0);
    }

    function test_totalValue_correlatesWithTotalSupply() public view {
        uint256 totalVal = oethBaseVault.totalValue();
        uint256 totalSup = oethBase.totalSupply();
        // Within 5% of total supply
        assertApproxEqRel(totalVal, totalSup, 0.05e18);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(oethBaseVault.checkBalance(address(weth)), 0);
    }

    function test_asset_matchesUnderlying() public view {
        assertEq(oethBaseVault.asset(), address(weth));
    }

    function test_oToken_matchesToken() public view {
        assertEq(address(oethBaseVault.oToken()), address(oethBase));
    }

    function test_getAllAssets_isConsistent() public view {
        assertEq(oethBaseVault.getAllAssets().length, oethBaseVault.getAssetCount());
    }

    function test_getAllStrategies_isConsistent() public view {
        assertEq(oethBaseVault.getAllStrategies().length, oethBaseVault.getStrategyCount());
    }

    function test_isSupportedAsset_underlying() public view {
        assertTrue(oethBaseVault.isSupportedAsset(address(weth)));
    }

    function test_isSupportedAsset_random() public view {
        assertFalse(oethBaseVault.isSupportedAsset(address(1)));
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(oethBaseVault.rebasePaused());
        assertFalse(oethBaseVault.capitalPaused());
    }
}
