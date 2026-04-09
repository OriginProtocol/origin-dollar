// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_OUSD_Transfer_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- TRANSFER
    //////////////////////////////////////////////////////

    function test_transfer_simple() public {
        vm.prank(matt);
        ousd.transfer(alice, 1e18);

        assertEq(ousd.balanceOf(alice), 1e18);
        assertEq(ousd.balanceOf(matt), 99e18);
    }

    function test_transfer_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IOToken.Transfer(matt, alice, 1e18);

        vm.prank(matt);
        ousd.transfer(alice, 1e18);
    }

    function test_transfer_fullBalance() public {
        vm.prank(matt);
        ousd.transfer(alice, 100e18);

        assertEq(ousd.balanceOf(matt), 0);
        assertEq(ousd.balanceOf(alice), 100e18);
    }

    function test_transfer_RevertWhen_toZeroAddress() public {
        vm.prank(matt);
        vm.expectRevert("Transfer to zero address");
        ousd.transfer(address(0), 1e18);
    }

    function test_transfer_RevertWhen_insufficientBalance() public {
        vm.prank(matt);
        vm.expectRevert("Transfer amount exceeds balance");
        ousd.transfer(alice, 101e18);
    }

    //////////////////////////////////////////////////////
    /// --- REBASING <-> NON-REBASING TRANSFERS
    //////////////////////////////////////////////////////

    function test_transfer_rebasingToNonRebasing() public {
        // Transfer from josh (rebasing) to mockNonRebasing (contract, auto-migrates)
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 100e18);

        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 100e18, 0);
        assertApproxEqAbs(ousd.balanceOf(josh), 0, 0);

        // nonRebasingSupply should increase
        assertEq(ousd.nonRebasingSupply(), 100e18);

        // creditsPerToken frozen for non-rebasing
        (, uint256 cptBefore) = ousd.creditsBalanceOf(address(mockNonRebasing));

        // Simulate yield: 200 OUSD via changeSupply (bypasses vault rate limit)
        _changeSupply(400e18);

        // Credits per token should be same for non-rebasing
        (, uint256 cptAfter) = ousd.creditsBalanceOf(address(mockNonRebasing));
        assertEq(cptBefore, cptAfter);

        // Non-rebasing account doesn't gain yield
        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 100e18, 0);
        // Matt gets all the yield (he's the only remaining rebasing account)
        assertApproxEqAbs(ousd.balanceOf(matt), 300e18, 1);
    }

    function test_transfer_rebasingToNonRebasing_withPreviousCPT() public {
        // First transfer to set CPT
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 100e18);

        // Simulate yield: 200 OUSD via changeSupply (bypasses vault rate limit)
        _changeSupply(400e18);

        // Matt received all the yield (only remaining rebasing user)
        assertApproxEqAbs(ousd.balanceOf(matt), 300e18, 1);

        // Second transfer with previously set CPT
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 50e18);

        assertApproxEqAbs(ousd.balanceOf(matt), 250e18, 1);
        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 150e18, 0);

        _assertSupplyInvariant();
    }

    function test_transfer_nonRebasingToRebasing() public {
        // Give contract 100 OUSD from Josh
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 100e18);

        // Transfer from non-rebasing back to rebasing
        mockNonRebasing.transfer(matt, 100e18);

        assertApproxEqAbs(ousd.balanceOf(matt), 200e18, 0);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), 0);

        // nonRebasingSupply should be back to 0
        assertEq(ousd.nonRebasingSupply(), 0);

        _assertSupplyInvariant();
    }

    function test_transfer_nonRebasingToRebasing_withPreviousCPT() public {
        // Give contract 100 OUSD
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 100e18);

        // Simulate yield: 200 OUSD via changeSupply (bypasses vault rate limit)
        _changeSupply(400e18);

        // Matt got all yield
        assertApproxEqAbs(ousd.balanceOf(matt), 300e18, 1);

        // Transfer more to contract
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 50e18);

        // Transfer contract balance to Josh
        mockNonRebasing.transfer(josh, 150e18);

        assertApproxEqAbs(ousd.balanceOf(matt), 250e18, 1);
        assertApproxEqAbs(ousd.balanceOf(josh), 150e18, 0);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), 0);

        _assertSupplyInvariant();
    }

    function test_transfer_rebasingToRebasing() public {
        vm.prank(matt);
        ousd.transfer(josh, 50e18);

        assertEq(ousd.balanceOf(matt), 50e18);
        assertEq(ousd.balanceOf(josh), 150e18);
        assertEq(ousd.totalSupply(), 200e18);
    }

    function test_transfer_nonRebasingToNonRebasing() public {
        // Create a second MockNonRebasing
        MockNonRebasingTwo mockTwo = new MockNonRebasingTwo(address(ousd));

        // Give first contract 50 OUSD
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 50e18);

        // Simulate yield
        _rebase(200e6);

        // Give second contract 50 OUSD
        vm.prank(josh);
        ousd.transfer(address(mockTwo), 50e18);

        // Simulate more yield
        _rebase(100e6);

        // Transfer between non-rebasing accounts
        mockNonRebasing.transfer(address(mockTwo), 10e18);

        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 40e18, 0);
        assertApproxEqAbs(ousd.balanceOf(address(mockTwo)), 60e18, 0);

        _assertSupplyInvariant();
    }

    //////////////////////////////////////////////////////
    /// --- AUTO-MIGRATION
    //////////////////////////////////////////////////////

    function test_transfer_autoMigratesContract() public {
        // mockNonRebasing is a contract with NotSet state
        assertEq(uint256(ousd.rebaseState(address(mockNonRebasing))), 0); // NotSet

        // Transfer to contract triggers auto-migration
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 10e18);

        assertEq(uint256(ousd.rebaseState(address(mockNonRebasing))), 1); // StdNonRebasing
    }

    function test_transfer_doesNotAutoMigrateEOA() public {
        // alice is an EOA with NotSet state
        assertEq(uint256(ousd.rebaseState(alice)), 0); // NotSet

        // Transfer to EOA does NOT auto-migrate
        vm.prank(matt);
        ousd.transfer(alice, 10e18);

        assertEq(uint256(ousd.rebaseState(alice)), 0); // Still NotSet (behaves as rebasing)
    }

    //////////////////////////////////////////////////////
    /// --- LEGACY CPT NORMALIZATION
    //////////////////////////////////////////////////////

    function test_transfer_normalizesLegacyCPT() public {
        // Opt out matt so he's non-rebasing (CPT = 1e18, credits = 100e18)
        vm.prank(matt);
        ousd.rebaseOptOut();

        // Simulate a legacy account with alternativeCreditsPerToken = 1e27
        // (pre-resolution-upgrade migration). Adjust creditBalances accordingly.
        bytes32 cptSlot = keccak256(abi.encode(uint256(uint160(matt)), uint256(161)));
        bytes32 creditsSlot = keccak256(abi.encode(uint256(uint160(matt)), uint256(157)));
        vm.store(address(ousd), cptSlot, bytes32(uint256(1e27)));
        vm.store(address(ousd), creditsSlot, bytes32(uint256(100e27)));

        // Balance should still be 100e18 with legacy CPT
        assertEq(ousd.balanceOf(matt), 100e18);
        assertEq(ousd.nonRebasingCreditsPerToken(matt), 1e27);

        // Transfer normalizes CPT from 1e27 to 1e18
        vm.prank(matt);
        ousd.transfer(alice, 10e18);

        assertEq(ousd.balanceOf(matt), 90e18);
        assertEq(ousd.nonRebasingCreditsPerToken(matt), 1e18);
    }

    //////////////////////////////////////////////////////
    /// --- EXACT TRANSFER TO/FROM NON-REBASING
    //////////////////////////////////////////////////////

    function test_transfer_exactAmountsToNonRebasing() public {
        // Add yield to force higher resolution
        _rebase(50e6);

        // Verify exact transfers to non-rebasing
        uint256 beforeReceiver = ousd.balanceOf(address(mockNonRebasing));
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 1);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), beforeReceiver + 1);

        beforeReceiver = ousd.balanceOf(address(mockNonRebasing));
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 100);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), beforeReceiver + 100);

        // Verify exact transfers out of non-rebasing
        beforeReceiver = ousd.balanceOf(address(mockNonRebasing));
        mockNonRebasing.transfer(matt, 1);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), beforeReceiver - 1);

        beforeReceiver = ousd.balanceOf(address(mockNonRebasing));
        mockNonRebasing.transfer(matt, 9);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), beforeReceiver - 9);
    }
}

/// @dev Helper contract: a second MockNonRebasing for testing inter-contract transfers
contract MockNonRebasingTwo {
    IOToken private immutable _ousd;

    constructor(address ousd_) {
        _ousd = IOToken(ousd_);
    }

    function transfer(address to, uint256 amount) external {
        _ousd.transfer(to, amount);
    }
}
