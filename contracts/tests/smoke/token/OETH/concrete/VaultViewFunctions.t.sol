// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETH_Shared_Test} from "tests/smoke/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_VaultViewFunctions_Test is Smoke_OETH_Shared_Test {
    function test_totalValue_isNonZero() public view {
        assertGt(oethVault.totalValue(), 0);
    }

    function test_totalValue_correlatesWithTotalSupply() public view {
        uint256 totalVal = oethVault.totalValue();
        uint256 totalSup = oeth.totalSupply();
        // Within 5% of total supply
        assertApproxEqRel(totalVal, totalSup, 0.05e18);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(oethVault.checkBalance(address(weth)), 0);
    }

    function test_asset_matchesUnderlying() public view {
        assertEq(oethVault.asset(), address(weth));
    }

    function test_oToken_matchesToken() public view {
        assertEq(address(oethVault.oToken()), address(oeth));
    }

    function test_getAllAssets_isConsistent() public view {
        assertEq(oethVault.getAllAssets().length, oethVault.getAssetCount());
    }

    function test_getAllStrategies_isConsistent() public view {
        assertEq(oethVault.getAllStrategies().length, oethVault.getStrategyCount());
    }

    function test_isSupportedAsset_underlying() public view {
        assertTrue(oethVault.isSupportedAsset(address(weth)));
    }

    function test_isSupportedAsset_random() public view {
        assertFalse(oethVault.isSupportedAsset(address(1)));
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(oethVault.rebasePaused());
        assertFalse(oethVault.capitalPaused());
    }
}
