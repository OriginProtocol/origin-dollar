// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";

contract Unit_Concrete_OETHVault_Rebase_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE()
    //////////////////////////////////////////////////////

    function test_rebase_works() public {
        // Inject 2 WETH of yield into the vault
        _dealWETH(address(oethVault), 2e18);

        // Advance time to allow yield calculation
        vm.warp(block.timestamp + 1);

        uint256 supplyBefore = oeth.totalSupply();

        oethVault.rebase();

        uint256 supplyAfter = oeth.totalSupply();
        assertGt(supplyAfter, supplyBefore, "Supply should increase after rebase with yield");
    }

    function test_rebase_emitsYieldDistribution() public {
        _dealWETH(address(oethVault), 2e18);
        vm.warp(block.timestamp + 1);

        // Should emit YieldDistribution event
        vm.expectEmit(false, false, false, false);
        emit IVault.YieldDistribution(address(0), 0, 0);
        oethVault.rebase();
    }

    function test_rebase_noYieldDoesNotChangeSupply() public {
        // No extra WETH — no yield to distribute
        uint256 supplyBefore = oeth.totalSupply();

        vm.warp(block.timestamp + 1);
        oethVault.rebase();

        assertEq(oeth.totalSupply(), supplyBefore, "Supply should not change without yield");
    }

    function test_rebase_RevertWhen_rebasePaused() public {
        vm.prank(governor);
        oethVault.pauseRebase();

        vm.expectRevert("Rebasing paused");
        oethVault.rebase();
    }

    function test_rebase_sameBlockNoYield() public {
        // Inject yield and advance time so rebase distributes and sets lastRebase
        _dealWETH(address(oethVault), 2e18);
        vm.warp(block.timestamp + 1);
        oethVault.rebase();

        // Now inject more yield in the same block — elapsed = 0, should not distribute
        _dealWETH(address(oethVault), 3e18);

        uint256 supplyBefore = oeth.totalSupply();
        oethVault.rebase();
        assertEq(oeth.totalSupply(), supplyBefore, "No yield when elapsed=0");
    }

    //////////////////////////////////////////////////////
    /// --- REBASE WITH TRUSTEE FEE
    //////////////////////////////////////////////////////

    function test_rebase_withTrusteeFee() public {
        // Configure trustee
        vm.startPrank(governor);
        oethVault.setTrusteeAddress(alice);
        oethVault.setTrusteeFeeBps(2000); // 20%
        vm.stopPrank();

        // Inject yield
        _dealWETH(address(oethVault), 10e18);
        vm.warp(block.timestamp + 1);

        uint256 aliceBefore = oeth.balanceOf(alice);

        oethVault.rebase();

        uint256 aliceAfter = oeth.balanceOf(alice);
        assertGt(aliceAfter, aliceBefore, "Trustee should receive fee in OETH");
    }

    function test_rebase_withTrusteeFee_emitsEvent() public {
        vm.startPrank(governor);
        oethVault.setTrusteeAddress(alice);
        oethVault.setTrusteeFeeBps(2000);
        vm.stopPrank();

        _dealWETH(address(oethVault), 10e18);
        vm.warp(block.timestamp + 1);

        // Should emit YieldDistribution with trustee address and non-zero fee
        vm.expectEmit(true, false, false, false);
        emit IVault.YieldDistribution(alice, 0, 0);
        oethVault.rebase();
    }

    //////////////////////////////////////////////////////
    /// --- TRUSTEE FEE >= YIELD (DEFENSIVE CHECK)
    //////////////////////////////////////////////////////

    function test_rebase_RevertWhen_feeExceedsYield() public {
        vm.startPrank(governor);
        oethVault.setTrusteeAddress(address(mockNonRebasing));
        vm.stopPrank();

        // Write 10000 (100%) directly to trusteeFeeBps storage slot (setTrusteeFeeBps caps at 5000)
        bytes32 slot = bytes32(uint256(67)); // trusteeFeeBps slot in VaultStorage
        vm.store(address(oethVault), slot, bytes32(uint256(10000)));
        assertEq(oethVault.trusteeFeeBps(), 10000);

        // Simulate 1 WETH yield
        _dealWETH(address(oethVault), 1e18);

        vm.warp(block.timestamp + 1);
        vm.expectRevert("Fee must not be greater than yield");
        oethVault.rebase();
    }

    //////////////////////////////////////////////////////
    /// --- PREVIEWYIELD
    //////////////////////////////////////////////////////

    function test_previewYield_returnsZeroWhenNoYield() public view {
        uint256 yield = oethVault.previewYield();
        assertEq(yield, 0, "No yield when vault is exactly backed");
    }

    function test_previewYield_returnsYieldAmount() public {
        _dealWETH(address(oethVault), 5e18);
        vm.warp(block.timestamp + 1);

        uint256 yield = oethVault.previewYield();
        assertGt(yield, 0, "Should preview non-zero yield");
    }

    //////////////////////////////////////////////////////
    /// --- REBASE WITH DRIP DURATION
    //////////////////////////////////////////////////////

    function test_rebase_withDripDuration_smoothsYield() public {
        // Set drip duration to 7 days
        vm.prank(governor);
        oethVault.setDripDuration(7 days);

        // Inject large yield
        _dealWETH(address(oethVault), 50e18);

        // Advance 1 hour
        vm.warp(block.timestamp + 1 hours);

        uint256 supplyBefore = oeth.totalSupply();
        oethVault.rebase();
        uint256 supplyAfter = oeth.totalSupply();

        // With drip smoothing, only a fraction of yield should be distributed
        uint256 yieldDistributed = supplyAfter - supplyBefore;
        assertGt(yieldDistributed, 0, "Some yield should be distributed");
        assertLt(yieldDistributed, 50e18, "Full yield should not be distributed with drip");
    }

    function test_rebase_withDripDuration_multipleRebases() public {
        vm.prank(governor);
        oethVault.setDripDuration(7 days);

        _dealWETH(address(oethVault), 50e18);

        uint256 totalYield;

        // Rebase multiple times
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + 1 days);
            uint256 supplyBefore = oeth.totalSupply();
            oethVault.rebase();
            totalYield += oeth.totalSupply() - supplyBefore;
        }

        assertGt(totalYield, 0, "Should have accumulated yield over time");
    }

    //////////////////////////////////////////////////////
    /// --- REBASE WITH NONREBASING SUPPLY
    //////////////////////////////////////////////////////

    function test_rebase_withNonRebasingUser() public {
        // MockNonRebasing opts in to non-rebasing
        mockNonRebasing.rebaseOptOut();

        // Mint some OETH for the non-rebasing contract
        _dealWETH(address(mockNonRebasing), 50e18);
        mockNonRebasing.approveFor(address(weth), address(oethVault), 50e18);
        mockNonRebasing.mintOusd(address(oethVault), 50e18);

        uint256 nonRebasingBefore = oeth.balanceOf(address(mockNonRebasing));

        // Inject yield
        _dealWETH(address(oethVault), 10e18);
        vm.warp(block.timestamp + 1);

        oethVault.rebase();

        // Non-rebasing balance should not change
        assertEq(oeth.balanceOf(address(mockNonRebasing)), nonRebasingBefore, "Non-rebasing balance unchanged");

        // Rebasing users should get yield
        uint256 mattAfter = oeth.balanceOf(matt);
        assertGt(mattAfter, 100e18, "Rebasing user should gain yield");
    }

    //////////////////////////////////////////////////////
    /// --- MINT TRIGGERS REBASE
    //////////////////////////////////////////////////////

    function test_mint_triggersRebaseAboveThreshold() public {
        vm.prank(governor);
        oethVault.setRebaseThreshold(10e18);

        // Inject yield
        _dealWETH(address(oethVault), 5e18);
        vm.warp(block.timestamp + 1);

        uint256 mattBefore = oeth.balanceOf(matt);

        // Mint above threshold triggers rebase
        _mintOETH(alice, 20e18);

        uint256 mattAfter = oeth.balanceOf(matt);
        // Matt should have received yield from the rebase triggered by Alice's mint
        assertGt(mattAfter, mattBefore, "Rebase should have distributed yield to Matt");
    }

    function test_mint_doesNotRebaseBelowThreshold() public {
        vm.prank(governor);
        oethVault.setRebaseThreshold(100e18);

        // Inject yield
        _dealWETH(address(oethVault), 5e18);
        vm.warp(block.timestamp + 1);

        uint256 mattBefore = oeth.balanceOf(matt);

        // Mint below threshold — no rebase
        _mintOETH(alice, 10e18);

        // Matt's balance should be unchanged (no rebase happened)
        assertEq(oeth.balanceOf(matt), mattBefore, "No rebase below threshold");
    }
}
