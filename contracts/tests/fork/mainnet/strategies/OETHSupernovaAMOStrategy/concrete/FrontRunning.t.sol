// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {
    Fork_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_OETHSupernovaAMOStrategy_FrontRunning_Test is Fork_OETHSupernovaAMOStrategy_Shared_Test {
    uint256 internal constant DEPOSIT_AMOUNT = 200_000 ether;

    function setUp() public override {
        super.setUp();
        // Deposit to strategy
        _depositAsVault(DEPOSIT_AMOUNT);
    }

    //////////////////////////////////////////////////////
    /// --- FRONT-RUN DEPOSIT
    //////////////////////////////////////////////////////

    function test_frontRunDeposit_withinRange() public {
        // Attacker swaps moderate amount into pool (within range)
        uint256 wethAmountIn = 20_000 ether;
        uint256 oethAmountOut = _swapTokensInPool(Mainnet.WETH, wethAmountIn);

        // Deposit should still succeed (within maxDepeg range)
        uint256 depositAmount = 200_000 ether;
        _depositAsVault(depositAmount);

        // Attacker swaps OETH back for WETH
        _swapTokensInPool(address(oeth), oethAmountOut);

        // Strategy should still have balance
        assertGt(oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH), 0);
    }

    function test_deposit_RevertWhen_attackerTiltsPoolWithWETH() public {
        // Attacker swaps massive amount of WETH into 1.2M ETH pool
        uint256 wethAmountIn = 10_000_000 ether;
        _swapTokensInPool(Mainnet.WETH, wethAmountIn);

        // Deposit should fail (price out of range)
        uint256 depositAmount = 5_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), depositAmount);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, depositAmount);
    }

    function test_depositAll_RevertWhen_attackerTiltsPoolWithWETH() public {
        // Attacker swaps massive amount of WETH into 1.2M ETH pool
        uint256 wethAmountIn = 10_000_000 ether;
        _swapTokensInPool(Mainnet.WETH, wethAmountIn);

        // DepositAll should fail (price out of range)
        uint256 depositAmount = 5_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), depositAmount);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.depositAll();
    }

    function test_deposit_RevertWhen_attackerTiltsPoolWithOETH() public {
        // Attacker gets OETH by minting via vault
        _mintOETHForClement(10_000_000 ether);

        // Attacker swaps massive amount of OETH into 1.2M ETH pool
        uint256 oethAmountIn = 10_000_000 ether;
        _swapTokensInPool(address(oeth), oethAmountIn);

        // Deposit should fail (price out of range)
        uint256 depositAmount = 5_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), depositAmount);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, depositAmount);
    }

    function test_depositAll_RevertWhen_attackerTiltsPoolWithOETH() public {
        // Attacker gets OETH by minting via vault
        _mintOETHForClement(10_000_000 ether);

        // Attacker swaps massive amount of OETH into 1.2M ETH pool
        uint256 oethAmountIn = 10_000_000 ether;
        _swapTokensInPool(address(oeth), oethAmountIn);

        // DepositAll should fail
        uint256 depositAmount = 5_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), depositAmount);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.depositAll();
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAW PROFIT AFTER ATTACKER TILT
    //////////////////////////////////////////////////////

    function test_withdraw_profitAfterAttackerTiltWETH() public {
        // Snapshot before attack
        uint256 vaultValueBefore = oethVault.totalValue();
        uint256 oethSupplyBefore = oeth.totalSupply();

        // Attacker swaps massive WETH into pool (1.2M per side)
        uint256 wethAmountIn = 10_000_000 ether;
        uint256 oethAmountOut = _swapTokensInPool(Mainnet.WETH, wethAmountIn);

        // Strategist withdraws some WETH
        uint256 withdrawAmount = 4_000 ether;
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, withdrawAmount);

        // Attacker swaps OETH back
        _swapTokensInPool(address(oeth), oethAmountOut);

        // Calculate profit: change in vault value + burnt OETH
        uint256 vaultValueAfter = oethVault.totalValue();
        uint256 oethSupplyAfter = oeth.totalSupply();
        int256 profit =
            int256(vaultValueAfter) - int256(vaultValueBefore) + int256(oethSupplyBefore) - int256(oethSupplyAfter);

        // Vault should have positive profit (attacker lost, protocol gained)
        assertGt(profit, 0, "Vault should profit from attacker's tilt");
    }

    function test_withdraw_profitAfterAttackerTiltOETH() public {
        // Attacker gets OETH -- seed vault with extra backing to maintain solvency
        _seedVaultForSolvency(10_000_000 ether);
        _mintOETHForClement(10_000_000 ether);

        // Snapshot after attacker has OETH
        uint256 vaultValueBefore = oethVault.totalValue();
        uint256 oethSupplyBefore = oeth.totalSupply();

        // Attacker swaps massive OETH into pool
        uint256 oethAmountIn = 10_000_000 ether;
        uint256 wethAmountOut = _swapTokensInPool(address(oeth), oethAmountIn);

        // Strategist withdraws some WETH
        uint256 withdrawAmount = 200 ether;
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, withdrawAmount);

        // Attacker swaps WETH back
        _swapTokensInPool(Mainnet.WETH, wethAmountOut);

        // Calculate profit
        uint256 vaultValueAfter = oethVault.totalValue();
        uint256 oethSupplyAfter = oeth.totalSupply();
        int256 profit =
            int256(vaultValueAfter) - int256(vaultValueBefore) + int256(oethSupplyBefore) - int256(oethSupplyAfter);

        assertGt(profit, 0, "Vault should profit from attacker's tilt");
    }

    //////////////////////////////////////////////////////
    /// --- CHECK BALANCE STABILITY
    //////////////////////////////////////////////////////

    function test_checkBalance_stableAfterLargeOETHSwap() public {
        // Add large additional liquidity to pool so strategy owns small percentage
        uint256 bigAmount = 1_000_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(supernovaPool), bigAmount);
        _mintOETHForClement(bigAmount);
        vm.prank(clement);
        oeth.transfer(address(supernovaPool), bigAmount);
        supernovaPool.mint(clement);

        uint256 checkBalBefore = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);

        // Large OETH swap into the pool
        _mintOETHForClement(1_005_000 ether);
        _swapTokensInPool(address(oeth), 1_005_000 ether);

        // checkBalance should remain approximately the same (resistant to manipulation)
        uint256 checkBalAfter = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);
        assertApproxEqAbs(checkBalAfter, checkBalBefore, 1);

        // Large WETH swap back
        _swapTokensInPool(Mainnet.WETH, 2_000_000 ether);

        // checkBalance should still be stable
        uint256 checkBalFinal = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);
        assertApproxEqAbs(checkBalFinal, checkBalBefore, 1);
    }

    function test_checkBalance_stableAfterLargeWETHSwap() public {
        // Add large additional liquidity to pool
        uint256 bigAmount = 1_000_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(supernovaPool), bigAmount);
        _mintOETHForClement(bigAmount);
        vm.prank(clement);
        oeth.transfer(address(supernovaPool), bigAmount);
        supernovaPool.mint(clement);

        uint256 checkBalBefore = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);

        // Large WETH swap into the pool
        _swapTokensInPool(Mainnet.WETH, 1_006_000 ether);

        // checkBalance should remain approximately the same
        uint256 checkBalAfter = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);
        assertApproxEqAbs(checkBalAfter, checkBalBefore, 1);

        // Large OETH swap back
        _mintOETHForClement(1_005_000 ether);
        _swapTokensInPool(address(oeth), 1_005_000 ether);

        // checkBalance should still be stable
        uint256 checkBalFinal = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);
        assertApproxEqAbs(checkBalFinal, checkBalBefore, 1);
    }
}
