// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CurveAMOStrategy_ViewFunctions_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_checkBalance_returnsDirectPlusLPValue() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Should include LP value from gauge
        uint256 balance = curveAMOStrategy.checkBalance(address(weth));
        assertGt(balance, 0);
    }

    function test_checkBalance_returnsZeroWithNoDeposit() public view {
        uint256 balance = curveAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 0);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unsupported asset");
        curveAMOStrategy.checkBalance(address(oeth));
    }

    function test_supportsAsset_trueForHardAsset() public view {
        assertTrue(curveAMOStrategy.supportsAsset(address(weth)));
    }

    function test_supportsAsset_falseForOtherAssets() public view {
        assertFalse(curveAMOStrategy.supportsAsset(address(oeth)));
        assertFalse(curveAMOStrategy.supportsAsset(alice));
    }

    function test_checkBalance_includesDirectWethBalance() public {
        // Deal WETH directly to strategy (not deposited to pool)
        deal(address(weth), address(curveAMOStrategy), 5 ether);

        uint256 balance = curveAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 5 ether);
    }

    function test_checkBalance_scalesByVirtualPrice() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(weth));

        // Increase virtual price by 10%
        curvePool.setVirtualPrice(1.1e18);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(weth));

        // Balance should increase proportionally
        assertGt(balanceAfter, balanceBefore);
    }

    function test_checkBalance_zeroGaugeBalanceNoLpContribution() public {
        // Only direct balance, no gauge balance
        deal(address(weth), address(curveAMOStrategy), 3 ether);

        uint256 balance = curveAMOStrategy.checkBalance(address(weth));
        // Should equal just the direct balance with no LP contribution
        assertEq(balance, 3 ether);
    }

    function test_solvencyThreshold_constant() public view {
        assertEq(curveAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
    }
}
