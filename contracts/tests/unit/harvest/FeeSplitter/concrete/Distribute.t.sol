// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_FeeSplitter_Shared_Test} from "tests/unit/harvest/FeeSplitter/shared/Shared.t.sol";

// --- Project imports
import {IFeeSplitter} from "contracts/interfaces/IFeeSplitter.sol";

contract Unit_Concrete_FeeSplitter_Distribute_Test is Unit_FeeSplitter_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- HAPPY PATH
    //////////////////////////////////////////////////////

    function test_distribute_splitsEightyTwenty() public {
        ousd.mint(address(feeSplitter), 1000e18);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet), 200e18, "ops share");
        assertEq(ousd.balanceOf(harvester), 800e18, "buyback share");
        assertEq(ousd.balanceOf(address(feeSplitter)), 0, "nothing left behind");
    }

    function test_distribute_walksEverySupportedAsset() public {
        ousd.mint(address(feeSplitter), 1000e18);
        oeth.mint(address(feeSplitter), 10e18);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet), 200e18);
        assertEq(ousd.balanceOf(harvester), 800e18);
        assertEq(oeth.balanceOf(operationsWallet), 2e18);
        assertEq(oeth.balanceOf(harvester), 8e18);
    }

    function test_distribute_emitsEvent() public {
        ousd.mint(address(feeSplitter), 1000e18);

        vm.expectEmit({emitter: address(feeSplitter)});
        emit IFeeSplitter.Distributed(address(ousd), 200e18, 800e18);

        vm.prank(operator);
        feeSplitter.distribute();
    }

    function test_distribute_subsetOnly() public {
        ousd.mint(address(feeSplitter), 1000e18);
        oeth.mint(address(feeSplitter), 10e18);

        address[] memory assets = new address[](1);
        assets[0] = address(ousd);

        vm.prank(operator);
        feeSplitter.distribute(assets);

        assertEq(ousd.balanceOf(address(feeSplitter)), 0, "OUSD distributed");
        assertEq(oeth.balanceOf(address(feeSplitter)), 10e18, "OETH untouched");
    }

    //////////////////////////////////////////////////////
    /// --- ROUNDING
    //////////////////////////////////////////////////////

    /// @dev The ops share floors, so the remainder must land on the buyback side.
    ///      Getting this backwards would quietly bias fees toward operations.
    function test_distribute_roundingFavoursBuyback() public {
        // 1 wei * 2000 / 10000 == 0, so the whole amount is a remainder.
        ousd.mint(address(feeSplitter), 1);
        feeSplitterSetMin(address(ousd), 0);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet), 0, "ops rounds down");
        assertEq(ousd.balanceOf(harvester), 1, "remainder to buyback");
    }

    function test_distribute_roundingNeverStrands() public {
        uint256 amount = 123456789012345678901; // above the floor, deliberately indivisible
        ousd.mint(address(feeSplitter), amount);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet) + ousd.balanceOf(harvester), amount, "split must be lossless");
        assertEq(ousd.balanceOf(address(feeSplitter)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- DUST FLOOR
    //////////////////////////////////////////////////////

    function test_distribute_skipsBelowMinDistribute() public {
        ousd.mint(address(feeSplitter), MIN_DISTRIBUTE_OUSD - 1);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(address(feeSplitter)), MIN_DISTRIBUTE_OUSD - 1, "held back");
        assertEq(ousd.balanceOf(harvester), 0);
    }

    function test_distribute_distributesAtExactlyMinDistribute() public {
        ousd.mint(address(feeSplitter), MIN_DISTRIBUTE_OUSD);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(address(feeSplitter)), 0);
    }

    function test_distribute_skipsZeroBalanceWithoutReverting() public {
        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(harvester), 0);
        assertEq(oeth.balanceOf(harvester), 0);
    }

    /// @dev One asset being under its floor must not stop the others.
    function test_distribute_oneAssetBelowFloorDoesNotBlockOthers() public {
        ousd.mint(address(feeSplitter), MIN_DISTRIBUTE_OUSD - 1);
        oeth.mint(address(feeSplitter), 10e18);

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(harvester), 0, "OUSD held back");
        assertEq(oeth.balanceOf(harvester), 8e18, "OETH still distributed");
    }

    //////////////////////////////////////////////////////
    /// --- PREVIEW
    //////////////////////////////////////////////////////

    function test_previewDistribute_matchesDistribute() public {
        ousd.mint(address(feeSplitter), 1000e18);

        (uint256 previewOps, uint256 previewBuyback) = feeSplitter.previewDistribute(address(ousd));

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet), previewOps);
        assertEq(ousd.balanceOf(harvester), previewBuyback);
    }

    function test_previewDistribute_zeroBelowFloor() public {
        ousd.mint(address(feeSplitter), MIN_DISTRIBUTE_OUSD - 1);

        (uint256 ops, uint256 buyback) = feeSplitter.previewDistribute(address(ousd));

        assertEq(ops, 0);
        assertEq(buyback, 0);
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_distribute_allowedForOperator() public {
        ousd.mint(address(feeSplitter), 1000e18);
        vm.prank(operator);
        feeSplitter.distribute();
        assertEq(ousd.balanceOf(address(feeSplitter)), 0);
    }

    /// @dev Strategist and Governor are allowed so a distribution is still
    ///      possible when the automation account is unavailable.
    function test_distribute_allowedForStrategist() public {
        ousd.mint(address(feeSplitter), 1000e18);
        vm.prank(strategist);
        feeSplitter.distribute();
        assertEq(ousd.balanceOf(address(feeSplitter)), 0);
    }

    function test_distribute_allowedForGovernor() public {
        ousd.mint(address(feeSplitter), 1000e18);
        vm.prank(governor);
        feeSplitter.distribute();
        assertEq(ousd.balanceOf(address(feeSplitter)), 0);
    }

    function test_distribute_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Operator");
        feeSplitter.distribute();
    }

    function test_distribute_RevertWhen_unsupportedAssetInSubset() public {
        address[] memory assets = new address[](1);
        assets[0] = makeAddr("RandomToken");

        vm.prank(operator);
        vm.expectRevert("Asset not supported");
        feeSplitter.distribute(assets);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function feeSplitterSetMin(address asset, uint256 amount) internal {
        vm.prank(strategist);
        feeSplitter.setMinDistribute(asset, amount);
    }
}
