// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_Deposit_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_deposit_depositsToPoolAndGauge() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(curveAMOStrategy), amount);

        vm.prank(address(oethVault));
        curveAMOStrategy.deposit(address(weth), amount);

        // LP tokens should be staked in gauge
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        // No LP tokens left in strategy
        assertEq(curvePool.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_deposit_mintsOTokens() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethSupplyAfter = oeth.totalSupply();

        // OTokens should have been minted (at least amount worth, some burned as LP)
        assertGt(oethSupplyAfter, oethSupplyBefore);
    }

    function test_deposit_oTokenAmount_poolBalanced() public {
        // When pool is balanced, oTokenToAdd == scaledAmount (1x)
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(100 ether, 100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Pool was balanced, so should mint exactly `amount` worth of OTokens
        // The deposit adds both hardAsset and oToken to pool, minted = amount (1x)
        assertEq(oethMinted, amount);
    }

    function test_deposit_oTokenAmount_poolTiltedToHardAsset() public {
        // Pool has more hardAsset than oToken → oTokenToAdd > scaledAmount
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Should mint more than 1x to rebalance
        assertGt(oethMinted, amount);
    }

    function test_deposit_oTokenAmount_capsAt2x() public {
        // Extreme tilt: pool has lots of hardAsset, very little oToken
        uint256 amount = 10 ether;
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(1000 ether, 1 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Capped at 2x
        assertEq(oethMinted, amount * 2);
    }

    function test_deposit_oTokenAmount_poolTiltedToOToken() public {
        // Pool has more oToken than hardAsset → oTokenToAdd stays at minimum (1x)
        uint256 amount = 10 ether;
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 200 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Minimum of 1x
        assertEq(oethMinted, amount);
    }

    function test_deposit_emitsDepositEvents() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(curveAMOStrategy), amount);

        // Expect two Deposit events: one for hardAsset, one for oToken
        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(weth), address(curvePool), amount);

        vm.prank(address(oethVault));
        curveAMOStrategy.deposit(address(weth), amount);
    }

    function test_deposit_RevertWhen_amountIsZero() public {
        deal(address(weth), address(curveAMOStrategy), 0);

        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        curveAMOStrategy.deposit(address(weth), 0);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        curveAMOStrategy.deposit(address(oeth), 1 ether);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        curveAMOStrategy.deposit(address(weth), 1 ether);
    }

    function test_deposit_RevertWhen_minLpAmountError() public {
        _seedVaultForSolvency(100 ether);

        // Set high slippage on mock pool (5%) exceeding strategy tolerance (1%)
        curvePool.setSlippageBps(500);

        deal(address(weth), address(curveAMOStrategy), 10 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Min LP amount error");
        curveAMOStrategy.deposit(address(weth), 10 ether);
    }

    function test_deposit_RevertWhen_protocolInsolvent() public {
        // No vault WETH seeding — protocol starts barely solvent
        // Mint a large amount of OETH externally to inflate supply
        vm.prank(address(oethVault));
        oeth.mint(alice, 1000 ether);

        deal(address(weth), address(curveAMOStrategy), 1 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.deposit(address(weth), 1 ether);
    }

    function test_deposit_emitsOTokenDepositEvent() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(curveAMOStrategy), amount);

        // Expect second Deposit event for OToken
        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Deposit(address(oeth), address(curvePool), 0);

        vm.prank(address(oethVault));
        curveAMOStrategy.deposit(address(weth), amount);
    }

    function test_deposit_assertsSolvency() public {
        // Normal deposit with solvency passes
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Verify solvency is maintained (totalValue / totalSupply >= 0.998)
        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
    }
}
