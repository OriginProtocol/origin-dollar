// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Fork_AerodromeAMOStrategy_Withdraw_Test is Fork_AerodromeAMOStrategy_Shared_Test {
    function test_withdraw() public {
        uint256 vaultBalanceBefore = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        uint256 vaultBalanceAfter = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        assertEq(vaultBalanceAfter, vaultBalanceBefore + 1 ether, "Vault should receive exact WETH");

        _verifyEndConditions(true);
    }

    function test_withdraw_burnsOTokens() public {
        uint256 supplyBefore = oethBase.totalSupply();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        uint256 supplyAfter = oethBase.totalSupply();
        assertLt(supplyAfter, supplyBefore, "OETHb supply should decrease after withdraw");

        _verifyEndConditions(true);
    }

    function test_withdraw_noResidualTokensInStrategy() public {
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        // Per Hardhat tolerance: ≤1e6 wei WETH residual
        assertLe(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)), 1e6, "WETH residual should be minimal"
        );

        _verifyEndConditions(true);
    }

    function test_withdraw_fromPoolWithLittleWeth() public {
        // Drain most WETH from pool by swapping OETHb in
        _swapOnPool(3.5 ether, false);

        uint256 vaultBalanceBefore = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        uint256 vaultBalanceAfter = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        assertApproxEqRel(vaultBalanceAfter, vaultBalanceBefore + 1 ether, 0.01 ether, "Vault should receive ~1 WETH");

        // WETH residual may be higher due to rounding, but per Hardhat ≤1e6
        assertLe(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)), 1e6, "WETH residual should be minimal"
        );

        _verifyEndConditions(true);
    }

    function test_withdraw_fromPoolWithLittleOethb() public {
        // Drain most OETHb from pool by swapping WETH in
        _swapOnPool(3.5 ether, true);

        uint256 vaultBalanceBefore = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        uint256 vaultBalanceAfter = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        assertApproxEqRel(vaultBalanceAfter, vaultBalanceBefore + 1 ether, 0.01 ether, "Vault should receive ~1 WETH");

        assertLe(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)), 1e6, "WETH residual should be minimal"
        );

        _verifyEndConditions(true);
    }

    function test_withdrawAll() public {
        uint256 vaultBalanceBefore = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        (uint256 wethInPosition,) = aerodromeAMOStrategy.getPositionPrincipal();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // Pool should be empty
        (uint256 wethAfter, uint256 oethbAfter) = aerodromeAMOStrategy.getPositionPrincipal();
        assertEq(wethAfter, 0, "WETH in position should be 0");
        assertEq(oethbAfter, 0, "OETHb in position should be 0");

        // Vault should have received WETH
        uint256 vaultBalanceAfter = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        assertApproxEqRel(vaultBalanceAfter, vaultBalanceBefore + wethInPosition, 0.01 ether, "Vault should get WETH");
    }

    function test_withdrawAll_noResidualTokensInStrategy() public {
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        assertEq(IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)), 0, "No WETH should remain");
        assertEq(oethBase.balanceOf(address(aerodromeAMOStrategy)), 0, "No OETHb should remain");
    }

    function test_withdrawAll_lpUnstakedWhenZeroLiquidity() public {
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // After withdrawAll removes all liquidity, NFT should be owned by strategy (not gauge)
        _assertLpNotStakedInGauge();
    }

    function test_withdraw_noPriceMovement() public {
        uint160 priceBefore = aerodromeAMOStrategy.getPoolX96Price();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        uint160 priceAfter = aerodromeAMOStrategy.getPoolX96Price();
        assertEq(priceAfter, priceBefore, "Pool price should not change after withdraw");
    }

    function test_withdraw_positionPrincipalDecreasesCorrectly() public {
        (uint256 wethBefore, uint256 oethbBefore) = aerodromeAMOStrategy.getPositionPrincipal();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);

        (uint256 wethAfter, uint256 oethbAfter) = aerodromeAMOStrategy.getPositionPrincipal();

        // WETH in position should decrease by ~1 ether
        assertApproxEqRel(wethBefore - wethAfter, 1 ether, 0.01 ether, "WETH principal should decrease by ~1");

        // OETHb should decrease proportionally (pool is ~80:20 OETHb:WETH, so ~4x OETHb per WETH)
        assertGt(oethbBefore - oethbAfter, 0, "OETHb principal should decrease");
    }

    function test_withdrawAll_oethbSupplyDecreases() public {
        (, uint256 oethbInPosition) = aerodromeAMOStrategy.getPositionPrincipal();
        uint256 supplyBefore = oethBase.totalSupply();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        uint256 supplyAfter = oethBase.totalSupply();
        assertEq(supplyBefore - supplyAfter, oethbInPosition, "Supply should decrease by exact OETHb in position");
    }

    function test_withdrawAll_fromPoolWithLittleWeth() public {
        // Drain most WETH from pool
        _swapOnPool(3.5 ether, false);

        uint256 vaultBalanceBefore = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        (uint256 wethInPosition,) = aerodromeAMOStrategy.getPositionPrincipal();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        assertApproxEqRel(
            vaultBalanceAfter, vaultBalanceBefore + wethInPosition, 0.01 ether, "Vault should get ~WETH from position"
        );

        assertEq(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)), 0, "No WETH residual after withdrawAll"
        );

        _verifyEndConditions(false);
    }

    function test_withdrawAll_fromPoolWithLittleOethb() public {
        // Drain most OETHb from pool
        _swapOnPool(3.5 ether, true);

        uint256 vaultBalanceBefore = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        (uint256 wethInPosition,) = aerodromeAMOStrategy.getPositionPrincipal();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        assertApproxEqRel(
            vaultBalanceAfter, vaultBalanceBefore + wethInPosition, 0.01 ether, "Vault should get ~WETH from position"
        );

        assertEq(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)), 0, "No WETH residual after withdrawAll"
        );

        _verifyEndConditions(false);
    }

    function test_withdraw_RevertWhen_notEnoughWethLiquidity() public {
        // Drain WETH from pool
        _swapOnPool(5 ether, false);

        // Try to withdraw more WETH than available
        vm.prank(address(oethBaseVault));
        // Reverts with NotEnoughWethLiquidity(wethInPool, additionalWethRequired)
        vm.expectRevert();
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1000 ether);
    }
}
