// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_AerodromeAMOStrategy_Deposit_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_deposit() public {
        uint256 amount = 10 ether;
        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        // Strategy should have created a liquidity position (tokenId > 0)
        // since pool price is in range, deposit triggers _rebalance
        assertGt(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_deposit_emitsDeposit() public {
        uint256 amount = 10 ether;
        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(weth), address(0), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);
    }

    function test_deposit_leavesWethWhenPoolOutOfRange() public {
        uint256 amount = 10 ether;
        // Set pool price out of range
        _setPoolPriceOutOfRange();

        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        // WETH should still be on the strategy (no rebalance triggered)
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), amount);
        // No position created
        assertEq(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_deposit_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oethBaseVault));
        vm.expectRevert("Unsupported asset");
        aerodromeAMOStrategy.deposit(address(oethBase), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethBaseVault));
        vm.expectRevert("Must deposit something");
        aerodromeAMOStrategy.deposit(address(weth), 0);
    }

    function test_deposit_RevertWhen_notVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        aerodromeAMOStrategy.deposit(address(weth), 1 ether);
    }

    function test_deposit_RevertWhen_nonZeroWethAmount() public {
        // When getAmountsForLiquidity returns a non-zero WETH amount,
        // _updateUnderlyingAssets reverts with "Non zero wethAmount".
        mockSugarHelper.setAmountsForLiquidity(1, 1 ether);

        deal(address(weth), address(aerodromeAMOStrategy), 5 ether);

        vm.prank(address(oethBaseVault));
        vm.expectRevert("Non zero wethAmount");
        aerodromeAMOStrategy.deposit(address(weth), 5 ether);
    }

    function test_deposit_leavesWethWhenWethShareOutOfBounds() public {
        // Tick is in range but WETH share is below allowedWethShareStart (0.02 ether).
        // estimateAmount1 = 100 ether → share = 1/(1+100) ≈ 0.0099 < 0.02
        // _checkForExpectedPoolPrice(false) returns (false, 0.0099) → deposit skips rebalance.
        mockSugarHelper.setEstimateAmount1(100 ether);

        uint256 amount = 10 ether;
        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        // WETH stays on the contract – no position created
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), amount);
        assertEq(aerodromeAMOStrategy.tokenId(), 0);
    }
}
