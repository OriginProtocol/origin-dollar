// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_Deposit_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_deposit_depositsToPoolAndGauge() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(baseCurveAMOStrategy), amount);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.deposit(address(weth), amount);

        // LP tokens should be staked in gauge
        assertGt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
        // No LP tokens left in strategy
        assertEq(curvePool.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_deposit_mintsOTokens() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethSupplyAfter = oeth.totalSupply();

        assertGt(oethSupplyAfter, oethSupplyBefore);
    }

    function test_deposit_oTokenAmount_poolBalanced() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(100 ether, 100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        assertEq(oethMinted, amount);
    }

    function test_deposit_oTokenAmount_poolTiltedToWeth() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        assertGt(oethMinted, amount);
    }

    function test_deposit_oTokenAmount_capsAt2x() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(1000 ether, 1 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        assertEq(oethMinted, amount * 2);
    }

    function test_deposit_oTokenAmount_poolTiltedToOeth() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 200 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        assertEq(oethMinted, amount);
    }

    function test_deposit_emitsDepositEvents() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(baseCurveAMOStrategy), amount);

        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(weth), address(curvePool), amount);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.deposit(address(weth), amount);
    }

    function test_deposit_emitsOethDepositEvent() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(baseCurveAMOStrategy), amount);

        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Deposit(address(oeth), address(curvePool), 0);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.deposit(address(weth), amount);
    }

    function test_deposit_assertsSolvency() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        assertGe(totalValue * 1e18 / totalSupply, 0.998 ether);
    }

    function test_deposit_RevertWhen_amountIsZero() public {
        deal(address(weth), address(baseCurveAMOStrategy), 0);

        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        baseCurveAMOStrategy.deposit(address(weth), 0);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Can only deposit WETH");
        baseCurveAMOStrategy.deposit(address(oeth), 1 ether);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        baseCurveAMOStrategy.deposit(address(weth), 1 ether);
    }

    function test_deposit_RevertWhen_minLpAmountError() public {
        _seedVaultForSolvency(100 ether);

        curvePool.setSlippageBps(500);

        deal(address(weth), address(baseCurveAMOStrategy), 10 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Min LP amount error");
        baseCurveAMOStrategy.deposit(address(weth), 10 ether);
    }

    function test_deposit_RevertWhen_protocolInsolvent() public {
        vm.prank(address(oethVault));
        oeth.mint(alice, 1000 ether);

        deal(address(weth), address(baseCurveAMOStrategy), 1 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        baseCurveAMOStrategy.deposit(address(weth), 1 ether);
    }
}
