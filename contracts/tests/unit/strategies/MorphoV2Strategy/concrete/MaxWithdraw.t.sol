// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_MorphoV2Strategy_Shared_Test} from "tests/unit/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Unit_Concrete_MorphoV2Strategy_MaxWithdraw_Test is Unit_MorphoV2Strategy_Shared_Test {
    function test_maxWithdraw_returnsAvailableLiquidity() public {
        _depositAsVault(100e18);

        // _maxWithdraw = asset.balanceOf(shareVault) + underlyingV1Vault.maxWithdraw(adapter)
        //              = 100e18 + 0 = 100e18
        uint256 maxW = strategy.maxWithdraw();
        assertEq(maxW, 100e18);
    }

    function test_maxWithdraw_returnsZeroWithNoDeposit() public view {
        uint256 maxW = strategy.maxWithdraw();
        assertEq(maxW, 0);
    }

    function test_maxWithdraw_reflectsReducedLiquidity() public {
        _depositAsVault(100e18);

        // Reduce vault's asset balance to simulate limited liquidity
        deal(address(asset), address(shareVault), 40e18);

        uint256 maxW = strategy.maxWithdraw();
        assertEq(maxW, 40e18);
    }

    function test_maxWithdraw_anyoneCanCall() public {
        _depositAsVault(100e18);

        // alice can call maxWithdraw (it's a view function)
        vm.prank(alice);
        uint256 maxW = strategy.maxWithdraw();
        assertEq(maxW, 100e18);
    }
}
