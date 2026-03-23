// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/mainnet/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_VaultViewFunctions_Test is Smoke_OUSD_Shared_Test {
    function test_totalValue_isNonZero() public view {
        assertGt(ousdVault.totalValue(), 0);
    }

    function test_totalValue_correlatesWithTotalSupply() public view {
        uint256 totalVal = ousdVault.totalValue();
        uint256 totalSup = ousd.totalSupply();
        // Within 5% of total supply
        assertApproxEqRel(totalVal, totalSup, 0.05e18);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(ousdVault.checkBalance(address(usdc)), 0);
    }

    function test_asset_matchesUnderlying() public view {
        assertEq(ousdVault.asset(), address(usdc));
    }

    function test_oToken_matchesToken() public view {
        assertEq(address(ousdVault.oToken()), address(ousd));
    }

    function test_getAllAssets_isConsistent() public view {
        assertEq(ousdVault.getAllAssets().length, ousdVault.getAssetCount());
    }

    function test_getAllStrategies_isConsistent() public view {
        assertEq(ousdVault.getAllStrategies().length, ousdVault.getStrategyCount());
    }

    function test_isSupportedAsset_underlying() public view {
        assertTrue(ousdVault.isSupportedAsset(address(usdc)));
    }

    function test_isSupportedAsset_random() public view {
        assertFalse(ousdVault.isSupportedAsset(address(1)));
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(ousdVault.rebasePaused());
        assertFalse(ousdVault.capitalPaused());
    }
}
