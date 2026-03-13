// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Sonic} from "tests/utils/Addresses.sol";
import {Fork_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/fork/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicSwapXAMOStrategy_FrontRunning_Test is Fork_SonicSwapXAMOStrategy_Shared_Test {
    uint256 internal constant DEPOSIT_AMOUNT = 100_000 ether;

    function setUp() public override {
        super.setUp();
        // Deposit to strategy
        _depositAsVault(DEPOSIT_AMOUNT);
    }

    //////////////////////////////////////////////////////
    /// --- FRONT-RUN DEPOSIT
    //////////////////////////////////////////////////////

    function test_frontRunDeposit_withinRange() public {
        // Attacker swaps 20K wS into pool (within range)
        uint256 wsAmountIn = 20_000 ether;
        uint256 osAmountOut = _swapTokensInPool(Sonic.wS, wsAmountIn);

        // Deposit should still succeed (within maxDepeg range)
        uint256 depositAmount = 200_000 ether;
        _depositAsVault(depositAmount);

        // Attacker swaps OS back for wS
        _swapTokensInPool(address(oSonic), osAmountOut);

        // Strategy should still have balance
        assertGt(sonicSwapXAMOStrategy.checkBalance(Sonic.wS), 0);
    }

    function test_deposit_RevertWhen_attackerTiltsPoolWithWS() public {
        // Attacker swaps massive amount of wS into pool
        uint256 wsAmountIn = 10_000_000 ether;
        _swapTokensInPool(Sonic.wS, wsAmountIn);

        // Deposit should fail (price out of range)
        uint256 depositAmount = 5000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), depositAmount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.deposit(Sonic.wS, depositAmount);
    }

    function test_depositAll_RevertWhen_attackerTiltsPoolWithWS() public {
        // Attacker swaps massive amount of wS into pool
        uint256 wsAmountIn = 10_000_000 ether;
        _swapTokensInPool(Sonic.wS, wsAmountIn);

        // DepositAll should fail (price out of range)
        uint256 depositAmount = 5000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), depositAmount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.depositAll();
    }

    function test_deposit_RevertWhen_attackerTiltsPoolWithOS() public {
        // Attacker gets OS by minting via vault
        _mintOSForClement(10_000_000 ether);

        // Attacker swaps massive amount of OS into pool
        uint256 osAmountIn = 10_000_000 ether;
        _swapTokensInPool(address(oSonic), osAmountIn);

        // Deposit should fail (price out of range)
        uint256 depositAmount = 5000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), depositAmount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.deposit(Sonic.wS, depositAmount);
    }

    function test_depositAll_RevertWhen_attackerTiltsPoolWithOS() public {
        // Attacker gets OS by minting via vault
        _mintOSForClement(10_000_000 ether);

        // Attacker swaps massive amount of OS into pool
        uint256 osAmountIn = 10_000_000 ether;
        _swapTokensInPool(address(oSonic), osAmountIn);

        // DepositAll should fail
        uint256 depositAmount = 5000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), depositAmount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.depositAll();
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAW PROFIT AFTER ATTACKER TILT
    //////////////////////////////////////////////////////

    function test_withdraw_profitAfterAttackerTiltWS() public {
        // Snapshot before attack
        uint256 vaultValueBefore = oSonicVault.totalValue();
        uint256 osSupplyBefore = oSonic.totalSupply();

        // Attacker swaps massive wS into pool
        uint256 wsAmountIn = 10_000_000 ether;
        uint256 osAmountOut = _swapTokensInPool(Sonic.wS, wsAmountIn);

        // Strategist withdraws some wS
        uint256 withdrawAmount = 4000 ether;
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, withdrawAmount);

        // Attacker swaps OS back
        _swapTokensInPool(address(oSonic), osAmountOut);

        // Calculate profit: change in vault value + burnt OS
        uint256 vaultValueAfter = oSonicVault.totalValue();
        uint256 osSupplyAfter = oSonic.totalSupply();
        int256 profit =
            int256(vaultValueAfter) - int256(vaultValueBefore) + int256(osSupplyBefore) - int256(osSupplyAfter);

        // Vault should have positive profit (attacker lost, protocol gained)
        assertGt(profit, 0, "Vault should profit from attacker's tilt");
    }

    function test_withdraw_profitAfterAttackerTiltOS() public {
        // Attacker gets OS — seed vault with extra backing to maintain solvency
        _seedVaultForSolvency(10_000_000 ether);
        _mintOSForClement(10_000_000 ether);

        // Snapshot after attacker has OS
        uint256 vaultValueBefore = oSonicVault.totalValue();
        uint256 osSupplyBefore = oSonic.totalSupply();

        // Attacker swaps massive OS into pool
        uint256 osAmountIn = 10_000_000 ether;
        uint256 wsAmountOut = _swapTokensInPool(address(oSonic), osAmountIn);

        // Strategist withdraws some wS (small amount due to pool tilt)
        uint256 withdrawAmount = 10 ether;
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, withdrawAmount);

        // Attacker swaps wS back
        _swapTokensInPool(Sonic.wS, wsAmountOut);

        // Calculate profit
        uint256 vaultValueAfter = oSonicVault.totalValue();
        uint256 osSupplyAfter = oSonic.totalSupply();
        int256 profit =
            int256(vaultValueAfter) - int256(vaultValueBefore) + int256(osSupplyBefore) - int256(osSupplyAfter);

        assertGt(profit, 0, "Vault should profit from attacker's tilt");
    }

    //////////////////////////////////////////////////////
    /// --- CHECK BALANCE STABILITY
    //////////////////////////////////////////////////////

    function test_checkBalance_stableAfterLargeOSSwap() public {
        // Add large additional liquidity to pool so strategy owns small percentage
        uint256 bigAmount = 1_000_000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(swapXPool), bigAmount);
        _mintOSForClement(bigAmount);
        vm.prank(clement);
        oSonic.transfer(address(swapXPool), bigAmount);
        swapXPool.mint(clement);

        uint256 checkBalBefore = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);

        // Large OS swap into the pool
        _mintOSForClement(1_005_000 ether);
        _swapTokensInPool(address(oSonic), 1_005_000 ether);

        // checkBalance should remain approximately the same (resistant to manipulation)
        uint256 checkBalAfter = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);
        assertApproxEqAbs(checkBalAfter, checkBalBefore, 1);

        // Large wS swap back
        _swapTokensInPool(Sonic.wS, 2_000_000 ether);

        // checkBalance should still be stable
        uint256 checkBalFinal = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);
        assertApproxEqAbs(checkBalFinal, checkBalBefore, 1);
    }

    function test_checkBalance_stableAfterLargeWSSwap() public {
        // Add large additional liquidity to pool
        uint256 bigAmount = 1_000_000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(swapXPool), bigAmount);
        _mintOSForClement(bigAmount);
        vm.prank(clement);
        oSonic.transfer(address(swapXPool), bigAmount);
        swapXPool.mint(clement);

        uint256 checkBalBefore = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);

        // Large wS swap into the pool
        _swapTokensInPool(Sonic.wS, 1_006_000 ether);

        // checkBalance should remain approximately the same
        uint256 checkBalAfter = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);
        assertApproxEqAbs(checkBalAfter, checkBalBefore, 1);

        // Large OS swap back
        _mintOSForClement(1_005_000 ether);
        _swapTokensInPool(address(oSonic), 1_005_000 ether);

        // checkBalance should still be stable
        uint256 checkBalFinal = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);
        assertApproxEqAbs(checkBalFinal, checkBalBefore, 1);
    }
}
