// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";

contract Unit_Concrete_OUSDVault_Rebase_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE PAUSING — BEHAVIOR
    //////////////////////////////////////////////////////

    function test_rebase_RevertWhen_paused() public {
        vm.prank(governor);
        ousdVault.pauseRebase();

        vm.expectRevert("Rebasing paused");
        ousdVault.rebase();
    }

    function test_rebase_worksWhenUnpaused() public {
        vm.prank(governor);
        ousdVault.pauseRebase();
        vm.prank(governor);
        ousdVault.unpauseRebase();

        ousdVault.rebase(); // Should not revert
    }

    function test_rebase_anyoneCanCall() public {
        vm.prank(alice);
        ousdVault.rebase(); // Should not revert
    }

    //////////////////////////////////////////////////////
    /// --- YIELD DISTRIBUTION
    //////////////////////////////////////////////////////

    function test_rebase_distributesYieldToRebasingAccounts() public {
        // Matt and Josh each have ~100 OUSD. Transfer USDC to vault to simulate yield.
        _dealUSDC(address(this), 2e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 2e6);

        uint256 mattBefore = ousd.balanceOf(matt);
        uint256 joshBefore = ousd.balanceOf(josh);
        assertApproxEqAbs(mattBefore, 100e18, 1e12);
        assertApproxEqAbs(joshBefore, 100e18, 1e12);

        ousdVault.rebase();

        // Each should get ~1 OUSD of yield (2 OUSD total yield / 2 rebasing users)
        assertApproxEqAbs(ousd.balanceOf(matt), 101e18, 1e15, "Matt yield mismatch");
        assertApproxEqAbs(ousd.balanceOf(josh), 101e18, 1e15, "Josh yield mismatch");
    }

    function test_rebase_nonRebasingExcludedFromYield() public {
        // Transfer Josh's OUSD to the MockNonRebasing contract (a contract, so auto non-rebasing)
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 100e18);

        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 100e18, 1e12);

        // Simulate yield
        _dealUSDC(address(this), 2e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 2e6);
        ousdVault.rebase();

        // Matt (rebasing) gets all the yield. MockNonRebasing gets none.
        assertApproxEqAbs(ousd.balanceOf(matt), 102e18, 1e15, "Matt should get all yield");
        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 100e18, 1e12, "NonRebasing should not get yield");
    }

    //////////////////////////////////////////////////////
    /// --- NO ALLOCATION WITHOUT STRATEGY
    //////////////////////////////////////////////////////

    function test_allocate_doesNothingWithoutStrategy() public {
        // Send extra USDC to vault
        _dealUSDC(address(this), 100e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 100e6);

        assertEq(ousdVault.getStrategyCount(), 0);

        vm.prank(governor);
        ousdVault.allocate();

        // All USDC should still be in the vault (200 initial + 100 extra)
        assertEq(usdc.balanceOf(address(ousdVault)), 300e6, "USDC should remain in vault");
    }

    //////////////////////////////////////////////////////
    /// --- USDC 6-DECIMAL DEPOSIT
    //////////////////////////////////////////////////////

    function test_mint_correctlyHandles6Decimals() public {
        assertEq(ousd.balanceOf(alice), 0);

        _dealUSDC(alice, 50e6);
        vm.startPrank(alice);
        usdc.approve(address(ousdVault), 50e6);
        ousdVault.mint(50e6);
        vm.stopPrank();

        assertEq(ousd.balanceOf(alice), 50e18, "50 USDC should mint 50 OUSD");
    }

    //////////////////////////////////////////////////////
    /// --- TRUSTEE YIELD ACCRUAL
    //////////////////////////////////////////////////////

    function test_trustee_collectsFeeOnRebase_100bp_1yield() public {
        _testTrusteeFee(1e6, 100, 0.01e18);
    }

    function test_trustee_collectsFeeOnRebase_5000bp_1yield() public {
        _testTrusteeFee(1e6, 5000, 0.5e18);
    }

    function test_trustee_collectsFeeOnRebase_900bp_1_523yield() public {
        _testTrusteeFee(1.523e6, 900, 0.13707e18);
    }

    function test_trustee_collectsFeeOnRebase_10bp_0_000001yield() public {
        // Expected fee = 0.000001 * 10/10000 = 0.000000001 OUSD = 1e9
        _testTrusteeFee(1, 10, 1e9);
    }

    function test_trustee_collectsZeroFeeOnZeroYield() public {
        _testTrusteeFee(0, 1000, 0);
    }

    function _testTrusteeFee(uint256 yieldUSDC, uint256 basisPoints, uint256 expectedFee) internal {
        // Use MockNonRebasing as trustee (non-rebasing so balance stays fixed)
        vm.startPrank(governor);
        ousdVault.setTrusteeAddress(address(mockNonRebasing));
        ousdVault.setTrusteeFeeBps(basisPoints);
        vm.stopPrank();

        assertEq(ousd.balanceOf(address(mockNonRebasing)), 0, "Trustee should start with 0");

        if (yieldUSDC > 0) {
            _dealUSDC(matt, yieldUSDC);
            vm.prank(matt);
            usdc.transfer(address(ousdVault), yieldUSDC);
        }

        uint256 supplyBefore = ousd.totalSupply();
        ousdVault.rebase();

        // Total supply should increase by yield amount
        uint256 scaledYield = uint256(yieldUSDC) * 1e12; // scale 6 → 18 decimals
        assertApproxEqAbs(ousd.totalSupply(), supplyBefore + scaledYield, 1e12, "Supply increase mismatch");

        // Trustee should receive the expected fee
        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), expectedFee, 1e12, "Trustee fee mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- PREVIEWYIELD
    //////////////////////////////////////////////////////

    function test_previewYield_returnsExpectedValue() public {
        // Simulate 2 USDC yield
        _dealUSDC(address(this), 2e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 2e6);

        uint256 yield = ousdVault.previewYield();
        assertApproxEqAbs(yield, 2e18, 1e15, "Preview yield mismatch");
    }

    function test_previewYield_returnsZeroWhenNoYield() public view {
        uint256 yield = ousdVault.previewYield();
        assertEq(yield, 0, "Preview yield should be 0 with no excess");
    }

    //////////////////////////////////////////////////////
    /// --- REBASE EMITS YIELDDISTRIBUTION
    //////////////////////////////////////////////////////

    function test_rebase_emitsYieldDistribution() public {
        _dealUSDC(address(this), 2e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 2e6);

        // With no trustee, fee = 0
        vm.expectEmit(true, true, true, false);
        emit IVault.YieldDistribution(address(0), 2e18, 0);
        ousdVault.rebase();
    }

    //////////////////////////////////////////////////////
    /// --- DRIP DURATION SMOOTHING
    //////////////////////////////////////////////////////

    function test_rebase_dripDurationSmoothsYield() public {
        // Enable drip duration smoothing (> 1 second)
        vm.prank(governor);
        ousdVault.setDripDuration(1 days);

        // Simulate 10 USDC yield
        _dealUSDC(address(this), 10e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 10e6);

        uint256 supplyBefore = ousd.totalSupply();

        // Advance only 1 hour — much less than 1 day drip duration
        vm.warp(block.timestamp + 1 hours);
        ousdVault.rebase();

        uint256 distributed = ousd.totalSupply() - supplyBefore;

        // With drip smoothing, only a fraction of yield should be distributed
        assertGt(distributed, 0, "Some yield should drip");
        assertLt(distributed, 10e18, "Yield should be smoothed, not fully distributed");
    }

    function test_rebase_dripDurationIncreasesTargetRate() public {
        // Enable drip duration smoothing
        vm.prank(governor);
        ousdVault.setDripDuration(1 days);

        // Simulate large yield (20 USDC)
        _dealUSDC(address(this), 20e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 20e6);

        // First rebase after half a day — sets initial target rate
        vm.warp(block.timestamp + 12 hours);
        ousdVault.rebase();

        uint256 supplyAfterFirst = ousd.totalSupply();

        // Add more yield
        _dealUSDC(address(this), 20e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 20e6);

        // Second rebase after another 12 hours — target rate should increase
        vm.warp(block.timestamp + 12 hours);
        ousdVault.rebase();

        uint256 supplyAfterSecond = ousd.totalSupply();
        assertGt(supplyAfterSecond, supplyAfterFirst, "Second rebase should distribute more yield");
    }

    //////////////////////////////////////////////////////
    /// --- _NEXTYIELD EARLY-RETURN BRANCHES
    //////////////////////////////////////////////////////

    function test_rebase_noYieldWhenNoRebasingSupply() public {
        // Transfer all OUSD to the MockNonRebasing contract (non-rebasing)
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 100e18);
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 100e18);

        // Simulate yield
        _dealUSDC(address(this), 5e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 5e6);

        uint256 supplyBefore = ousd.totalSupply();
        ousdVault.rebase();

        // No rebasing supply → no yield distributed
        assertEq(ousd.totalSupply(), supplyBefore, "No yield when rebasing supply is 0");
    }

    function test_rebase_noYieldOnSameBlock() public {
        // Simulate yield
        _dealUSDC(address(this), 5e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 5e6);

        // First rebase consumes the yield
        ousdVault.rebase();
        uint256 supplyAfterFirst = ousd.totalSupply();

        // Second rebase in same block — elapsed = 0 → no yield
        ousdVault.rebase();
        assertEq(ousd.totalSupply(), supplyAfterFirst, "No double yield in same block");
    }

    //////////////////////////////////////////////////////
    /// --- TRUSTEE FEE >= YIELD (DEFENSIVE CHECK)
    //////////////////////////////////////////////////////

    function test_rebase_RevertWhen_feeExceedsYield() public {
        vm.startPrank(governor);
        ousdVault.setTrusteeAddress(address(mockNonRebasing));
        // setTrusteeFeeBps caps at 5000, so use vm.store to set 10000 (100%)
        // trusteeFeeBps is at storage slot found via forge inspect
        vm.stopPrank();

        // Write 10000 directly to trusteeFeeBps storage slot
        bytes32 slot = bytes32(uint256(67)); // trusteeFeeBps slot in VaultStorage
        vm.store(address(ousdVault), slot, bytes32(uint256(10000)));
        assertEq(ousdVault.trusteeFeeBps(), 10000);

        // Simulate 1 USDC yield
        _dealUSDC(address(this), 1e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 1e6);

        vm.warp(block.timestamp + 1);
        vm.expectRevert("Fee must not be greater than yield");
        ousdVault.rebase();
    }
}
