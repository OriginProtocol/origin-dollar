// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_ViewFunctions_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_checkBalance_returnsDirectPlusLPValue() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 balance = baseCurveAMOStrategy.checkBalance(address(weth));
        assertGt(balance, 0);
    }

    function test_checkBalance_returnsZeroWithNoDeposit() public view {
        uint256 balance = baseCurveAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 0);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unsupported asset");
        baseCurveAMOStrategy.checkBalance(address(oeth));
    }

    function test_supportsAsset_trueForWeth() public view {
        assertTrue(baseCurveAMOStrategy.supportsAsset(address(weth)));
    }

    function test_supportsAsset_falseForOtherAssets() public view {
        assertFalse(baseCurveAMOStrategy.supportsAsset(address(oeth)));
        assertFalse(baseCurveAMOStrategy.supportsAsset(alice));
    }

    function test_checkBalance_includesDirectWethBalance() public {
        deal(address(weth), address(baseCurveAMOStrategy), 5 ether);

        uint256 balance = baseCurveAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 5 ether);
    }

    function test_checkBalance_scalesByVirtualPrice() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 balanceBefore = baseCurveAMOStrategy.checkBalance(address(weth));

        curvePool.setVirtualPrice(1.1e18);

        uint256 balanceAfter = baseCurveAMOStrategy.checkBalance(address(weth));

        assertGt(balanceAfter, balanceBefore);
    }

    function test_checkBalance_zeroGaugeBalanceNoLpContribution() public {
        deal(address(weth), address(baseCurveAMOStrategy), 3 ether);

        uint256 balance = baseCurveAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 3 ether);
    }

    function test_solvencyThreshold_constant() public view {
        assertEq(baseCurveAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
    }
}
