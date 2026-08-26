// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_FeeSplitter_Shared_Test} from "tests/unit/harvest/FeeSplitter/shared/Shared.t.sol";

contract Unit_Fuzz_FeeSplitter_Distribute_Test is Unit_FeeSplitter_Shared_Test {
    /// @dev The split must be lossless at every balance and every rate. Any wei
    ///      that neither recipient receives would be stranded in the splitter
    ///      forever, since `rescue` refuses supported assets.
    function testFuzz_distribute_isLossless(uint256 balance, uint16 bps) public {
        balance = bound(balance, MIN_DISTRIBUTE_OUSD, type(uint128).max);
        bps = uint16(bound(bps, 0, feeSplitter.MAX_OPERATIONS_BPS()));

        vm.prank(governor);
        feeSplitter.setOperationsBps(bps);

        ousd.mint(address(feeSplitter), balance);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet) + ousd.balanceOf(harvester), balance, "split lost value");
        assertEq(ousd.balanceOf(address(feeSplitter)), 0, "value stranded");
    }

    /// @dev Rounding must always favour the buyback, never operations.
    function testFuzz_distribute_roundingFavoursBuyback(uint256 balance, uint16 bps) public {
        balance = bound(balance, MIN_DISTRIBUTE_OUSD, type(uint128).max);
        bps = uint16(bound(bps, 0, feeSplitter.MAX_OPERATIONS_BPS()));

        vm.prank(governor);
        feeSplitter.setOperationsBps(bps);

        ousd.mint(address(feeSplitter), balance);

        vm.prank(operator);
        feeSplitter.distribute();

        uint256 exactOps = (balance * bps) / 1e4;
        assertLe(ousd.balanceOf(operationsWallet), exactOps, "ops rounded up");
        assertGe(ousd.balanceOf(harvester), balance - exactOps, "buyback shorted");
    }

    /// @dev The operations share can never exceed MAX_OPERATIONS_BPS of the
    ///      balance, whatever governance sets.
    function testFuzz_distribute_opsShareIsCapped(uint256 balance, uint16 bps) public {
        balance = bound(balance, MIN_DISTRIBUTE_OUSD, type(uint128).max);
        uint16 max = feeSplitter.MAX_OPERATIONS_BPS();
        bps = uint16(bound(bps, 0, max));

        vm.prank(governor);
        feeSplitter.setOperationsBps(bps);

        ousd.mint(address(feeSplitter), balance);

        vm.prank(operator);
        feeSplitter.distribute();

        assertLe(ousd.balanceOf(operationsWallet), (balance * max) / 1e4, "ops share above the hard cap");
    }

    /// @dev Anything under the floor stays put in full, and nothing moves.
    function testFuzz_distribute_belowFloorIsUntouched(uint256 balance) public {
        balance = bound(balance, 0, MIN_DISTRIBUTE_OUSD - 1);

        ousd.mint(address(feeSplitter), balance);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(address(feeSplitter)), balance);
        assertEq(ousd.balanceOf(operationsWallet), 0);
        assertEq(ousd.balanceOf(harvester), 0);
    }

    /// @dev previewDistribute must agree with what distribute actually does.
    function testFuzz_previewDistribute_matchesDistribute(uint256 balance, uint16 bps) public {
        balance = bound(balance, 0, type(uint128).max);
        bps = uint16(bound(bps, 0, feeSplitter.MAX_OPERATIONS_BPS()));

        vm.prank(governor);
        feeSplitter.setOperationsBps(bps);

        ousd.mint(address(feeSplitter), balance);

        (uint256 previewOps, uint256 previewBuyback) = feeSplitter.previewDistribute(address(ousd));

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet), previewOps, "ops preview wrong");
        assertEq(ousd.balanceOf(harvester), previewBuyback, "buyback preview wrong");
    }
}
