// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_AerodromeAMOStrategy_WithdrawAll_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_withdrawAll() public {
        _depositAsVault(10 ether);

        uint256 vaultBalBefore = weth.balanceOf(address(oethBaseVault));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // Vault should have received WETH back
        assertGt(weth.balanceOf(address(oethBaseVault)) - vaultBalBefore, 0);
        // Strategy should have no WETH left
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), 0);
    }

    function test_withdrawAll_noTokenId() public {
        // No deposit, tokenId == 0
        // Deal some WETH directly to strategy
        deal(address(weth), address(aerodromeAMOStrategy), 5 ether);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // Should still withdraw the WETH on the contract
        assertEq(weth.balanceOf(address(oethBaseVault)), 5 ether);
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), 0);
    }

    function test_withdrawAll_noBalance() public {
        // No deposit, no balance - should not revert
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        assertEq(weth.balanceOf(address(oethBaseVault)), 0);
    }

    function test_withdrawAll_RevertWhen_notVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        aerodromeAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_positionNFTNotRestaked_whenLiquidityZero() public {
        // Create a position and stake it in the gauge
        _depositAsVault(10 ether);

        uint256 tid = aerodromeAMOStrategy.tokenId();
        assertGt(tid, 0);
        // NFT is staked in gauge after deposit
        assertEq(mockPositionManager.ownerOf(tid), address(mockCLGauge));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // tokenId still set – NFT is not burned
        assertEq(aerodromeAMOStrategy.tokenId(), tid);
        // NFT is owned by strategy, NOT re-staked in gauge (liquidity is 0 after full removal)
        assertEq(mockPositionManager.ownerOf(tid), address(aerodromeAMOStrategy));
    }
}
