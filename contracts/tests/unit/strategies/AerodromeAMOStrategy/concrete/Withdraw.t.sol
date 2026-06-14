// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {IAerodromeAMOStrategy} from "contracts/interfaces/strategies/IAerodromeAMOStrategy.sol";

contract Unit_Concrete_AerodromeAMOStrategy_Withdraw_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_withdraw() public {
        // First deposit to create position
        _depositAsVault(10 ether);

        uint256 vaultBalBefore = weth.balanceOf(address(oethBaseVault));

        // Set principal so _ensureWETHBalance can check available WETH
        mockSugarHelper.setPrincipal(5 ether, 5 ether);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 3 ether);

        assertEq(weth.balanceOf(address(oethBaseVault)) - vaultBalBefore, 3 ether);
    }

    function test_withdraw_emitsWithdrawal() public {
        _depositAsVault(10 ether);
        mockSugarHelper.setPrincipal(5 ether, 5 ether);

        vm.expectEmit(true, true, true, true);
        emit IAerodromeAMOStrategy.Withdrawal(address(weth), address(0), 3 ether);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 3 ether);
    }

    function test_withdraw_fromWethBalanceOnContract() public {
        // Deal WETH directly to strategy (no liquidity position needed)
        deal(address(weth), address(aerodromeAMOStrategy), 5 ether);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 3 ether);

        assertEq(weth.balanceOf(address(oethBaseVault)), 3 ether);
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), 2 ether);
    }

    function test_withdraw_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oethBaseVault));
        vm.expectRevert("Unsupported asset");
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(oethBase), 1 ether);
    }

    function test_withdraw_RevertWhen_notVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 1 ether);
    }

    function test_withdraw_RevertWhen_notToVault() public {
        deal(address(weth), address(aerodromeAMOStrategy), 5 ether);

        vm.prank(address(oethBaseVault));
        vm.expectRevert("Only withdraw to vault allowed");
        aerodromeAMOStrategy.withdraw(alice, address(weth), 1 ether);
    }

    function test_withdraw_RevertWhen_noLiquidityAvailable() public {
        // Strategy has some WETH (1 ether) but not enough to cover the 5 ether request,
        // and no LP position exists (tokenId == 0).
        deal(address(weth), address(aerodromeAMOStrategy), 1 ether);

        vm.prank(address(oethBaseVault));
        vm.expectRevert("No liquidity available");
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 5 ether);
    }

    function test_withdraw_RevertWhen_notEnoughWethLiquidity() public {
        // Create position with 10 ether WETH
        _depositAsVault(10 ether);

        // Pool has very little WETH (0.1 ether) – not enough to cover the 5 ether withdrawal
        mockSugarHelper.setPrincipal(0.1 ether, 9.9 ether);

        // Strategy has no WETH on hand (all in position)
        vm.prank(address(oethBaseVault));
        vm.expectRevert(
            abi.encodeWithSelector(IAerodromeAMOStrategy.NotEnoughWethLiquidity.selector, 0.1 ether, 5 ether)
        );
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 5 ether);
    }
}
