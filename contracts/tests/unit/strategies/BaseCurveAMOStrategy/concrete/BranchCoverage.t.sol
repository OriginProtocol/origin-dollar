// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Branch Coverage Tests
/// @notice Uses low-level calls to ensure require revert branches are recorded
///         by the coverage tool, and vm.mockCall to test transfer-failure paths.
contract Unit_Concrete_BaseCurveAMOStrategy_BranchCoverage_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    // -------------------------------------------------------
    // onlyStrategist modifier — line 77
    // Branch: require(msg.sender == strategistAddr) true/false
    // -------------------------------------------------------

    function test_branch_onlyStrategist_pass() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_branch_onlyStrategist_fail() public {
        vm.prank(alice);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.mintAndAddOTokens.selector, 10 ether));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // improvePoolBalance modifier — lines 107-118
    // diffBefore == 0: require(diffAfter == 0)
    // diffBefore < 0: require(diffAfter <= 0), require(diffBefore < diffAfter)
    // diffBefore > 0: require(diffAfter >= 0), require(diffAfter < diffBefore)
    // -------------------------------------------------------

    // --- diffBefore == 0 ---

    function test_branch_improvePoolBalance_diffBeforeZero_revert() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(100 ether, 100 ether);

        // mintAndAddOTokens on balanced pool → diffAfter != 0 → revert
        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.mintAndAddOTokens.selector, 10 ether));
        assertFalse(success);
    }

    // --- diffBefore < 0 (pool tilted to OToken) ---

    function test_branch_improvePoolBalance_diffBeforeNeg_success() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool tilted to OToken: diffBefore < 0
        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        // removeAndBurnOTokens improves balance: diffAfter closer to 0
        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_branch_improvePoolBalance_diffBeforeNeg_overshotPeg() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // Pool slightly tilted to OToken
        _setupPoolBalances(99 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 2;

        // Removing lots of OTokens overshoots → diffAfter > 0 → "OTokens overshot peg"
        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.removeAndBurnOTokens.selector, lpToRemove));
        assertFalse(success);
    }

    function test_branch_improvePoolBalance_diffBeforeNeg_balanceWorse() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool tilted to OToken: diffBefore < 0
        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        // removeOnlyAssets on OToken-tilted pool worsens the OToken balance
        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.removeOnlyAssets.selector, lpToRemove));
        assertFalse(success);
    }

    // --- diffBefore > 0 (pool tilted to WETH) ---

    function test_branch_improvePoolBalance_diffBeforePos_success() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        // Pool tilted to WETH: diffBefore > 0
        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        // removeOnlyAssets improves balance
        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_branch_improvePoolBalance_diffBeforePos_overshotPeg() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // Pool slightly tilted to WETH
        _setupPoolBalances(100 ether, 99 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 2;

        // Removing lots of WETH overshoots → diffAfter < 0 → "Assets overshot peg"
        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.removeOnlyAssets.selector, lpToRemove));
        assertFalse(success);
    }

    function test_branch_improvePoolBalance_diffBeforePos_balanceWorse() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        // Pool tilted to WETH: diffBefore > 0
        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        // removeAndBurnOTokens on WETH-tilted pool worsens balance
        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.removeAndBurnOTokens.selector, lpToRemove));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // _deposit — lines 191, 192, 238
    // require(_wethAmount > 0), require(_weth == address(weth)), require(lpDeposited >= minMintAmount)
    // -------------------------------------------------------

    function test_branch_deposit_amountZero() public {
        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.deposit.selector, address(weth), 0));
        assertFalse(success);
    }

    function test_branch_deposit_wrongAsset() public {
        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.deposit.selector, address(oeth), 1 ether));
        assertFalse(success);
    }

    function test_branch_deposit_minLpAmount() public {
        _seedVaultForSolvency(100 ether);
        curvePool.setSlippageBps(500);
        deal(address(weth), address(baseCurveAMOStrategy), 10 ether);

        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.deposit.selector, address(weth), 10 ether));
        assertFalse(success);
    }

    function test_branch_deposit_success() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);
    }

    // -------------------------------------------------------
    // depositAll — line 252
    // if (balance > 0)
    // -------------------------------------------------------

    function test_branch_depositAll_zeroBalance() public {
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.depositAll();
        assertEq(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_branch_depositAll_nonZeroBalance() public {
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(baseCurveAMOStrategy), 10 ether);
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.depositAll();
        assertGt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    // -------------------------------------------------------
    // withdraw — lines 273, 274, 297
    // require(_amount > 0), require(asset), require(weth.transfer)
    // -------------------------------------------------------

    function test_branch_withdraw_amountZero() public {
        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.withdraw.selector, address(oethVault), address(weth), 0));
        assertFalse(success);
    }

    function test_branch_withdraw_wrongAsset() public {
        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(
                abi.encodeWithSelector(
                    baseCurveAMOStrategy.withdraw.selector, address(oethVault), address(oeth), 1 ether
                )
            );
        assertFalse(success);
    }

    function test_branch_withdraw_success() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);
    }

    function test_branch_withdraw_transferFails() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Mock weth.transfer to vault to return false
        vm.mockCall(
            address(weth), abi.encodeWithSelector(IERC20.transfer.selector, address(oethVault)), abi.encode(false)
        );

        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(
                abi.encodeWithSelector(
                    baseCurveAMOStrategy.withdraw.selector, address(oethVault), address(weth), 5 ether
                )
            );
        assertFalse(success);

        vm.clearMockedCalls();
    }

    // -------------------------------------------------------
    // withdrawAll — lines 344, 365
    // if (gaugeTokens == 0) return, require(weth.transfer)
    // -------------------------------------------------------

    function test_branch_withdrawAll_zeroGaugeTokens() public {
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();
    }

    function test_branch_withdrawAll_nonZeroGaugeTokens() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_branch_withdrawAll_transferFails() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Mock weth.transfer to vault to return false
        vm.mockCall(
            address(weth), abi.encodeWithSelector(IERC20.transfer.selector, address(oethVault)), abi.encode(false)
        );

        vm.prank(address(oethVault));
        (bool success,) =
            address(baseCurveAMOStrategy).call(abi.encodeWithSelector(baseCurveAMOStrategy.withdrawAll.selector));
        assertFalse(success);

        vm.clearMockedCalls();
    }

    // -------------------------------------------------------
    // mintAndAddOTokens — line 409
    // require(lpDeposited >= minMintAmount)
    // -------------------------------------------------------

    function test_branch_mintAndAddOTokens_minLpAmount() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(200 ether, 100 ether);

        curvePool.setSlippageBps(500);

        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.mintAndAddOTokens.selector, 10 ether));
        assertFalse(success);
    }

    function test_branch_mintAndAddOTokens_success() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    // -------------------------------------------------------
    // removeOnlyAssets — line 479
    // require(weth.transfer)
    // -------------------------------------------------------

    function test_branch_removeOnlyAssets_transferFails() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);
        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        // Mock weth.transfer to vault to return false
        vm.mockCall(
            address(weth), abi.encodeWithSelector(IERC20.transfer.selector, address(oethVault)), abi.encode(false)
        );

        vm.prank(strategist);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.removeOnlyAssets.selector, lpToRemove));
        assertFalse(success);

        vm.clearMockedCalls();
    }

    // -------------------------------------------------------
    // _solvencyAssert — line 535
    // if (totalVaultValue / totalOethSupply < SOLVENCY_THRESHOLD)
    // -------------------------------------------------------

    function test_branch_solvencyAssert_pass() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);
        // Solvency passes — no revert
    }

    function test_branch_solvencyAssert_fail() public {
        vm.prank(address(oethVault));
        oeth.mint(alice, 1000 ether);

        deal(address(weth), address(baseCurveAMOStrategy), 1 ether);

        vm.prank(address(oethVault));
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.deposit.selector, address(weth), 1 ether));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // checkBalance — lines 588, 593
    // require(_asset == address(weth)), if (lpTokens > 0)
    // -------------------------------------------------------

    function test_branch_checkBalance_wrongAsset() public {
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.checkBalance.selector, address(oeth)));
        assertFalse(success);
    }

    function test_branch_checkBalance_correctAsset() public view {
        baseCurveAMOStrategy.checkBalance(address(weth));
    }

    function test_branch_checkBalance_zeroLpTokens() public view {
        uint256 balance = baseCurveAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 0);
    }

    function test_branch_checkBalance_nonZeroLpTokens() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 balance = baseCurveAMOStrategy.checkBalance(address(weth));
        assertGt(balance, 0);
    }

    // -------------------------------------------------------
    // _setMaxSlippage — line 619
    // require(_maxSlippage <= 5e16)
    // -------------------------------------------------------

    function test_branch_setMaxSlippage_valid() public {
        vm.prank(governor);
        baseCurveAMOStrategy.setMaxSlippage(3e16);
    }

    function test_branch_setMaxSlippage_tooHigh() public {
        vm.prank(governor);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.setMaxSlippage.selector, 5e16 + 1));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // collectRewardTokens — onlyHarvester modifier
    // -------------------------------------------------------

    function test_branch_collectRewardTokens_asHarvester() public {
        vm.prank(harvester);
        baseCurveAMOStrategy.collectRewardTokens();
    }

    function test_branch_collectRewardTokens_notHarvester() public {
        vm.prank(alice);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.collectRewardTokens.selector));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // onlyVault modifier
    // -------------------------------------------------------

    function test_branch_onlyVault_fail() public {
        vm.prank(alice);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.deposit.selector, address(weth), 1 ether));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // onlyVaultOrGovernor modifier (withdrawAll)
    // -------------------------------------------------------

    function test_branch_onlyVaultOrGovernor_asVault() public {
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();
    }

    function test_branch_onlyVaultOrGovernor_asGovernor() public {
        vm.prank(governor);
        baseCurveAMOStrategy.withdrawAll();
    }

    function test_branch_onlyVaultOrGovernor_fail() public {
        vm.prank(alice);
        (bool success,) =
            address(baseCurveAMOStrategy).call(abi.encodeWithSelector(baseCurveAMOStrategy.withdrawAll.selector));
        assertFalse(success);
    }

    // -------------------------------------------------------
    // onlyGovernor modifier (safeApproveAllTokens, setMaxSlippage)
    // -------------------------------------------------------

    function test_branch_onlyGovernor_fail() public {
        vm.prank(alice);
        (bool success,) = address(baseCurveAMOStrategy)
            .call(abi.encodeWithSelector(baseCurveAMOStrategy.safeApproveAllTokens.selector));
        assertFalse(success);
    }
}
