// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_FeeSplitter_Shared_Test} from "tests/unit/harvest/FeeSplitter/shared/Shared.t.sol";

// --- Project imports
import {IFeeSplitter} from "contracts/interfaces/IFeeSplitter.sol";
import {MockRebasingToken} from "tests/mocks/MockRebasingToken.sol";

contract Unit_Concrete_FeeSplitter_AssetManagement_Test is Unit_FeeSplitter_Shared_Test {
    MockRebasingToken internal extra;

    function setUp() public override {
        super.setUp();
        extra = new MockRebasingToken("Extra", "EXTRA", 18);
    }

    //////////////////////////////////////////////////////
    /// --- ADD
    //////////////////////////////////////////////////////

    function test_addAsset_registersAsset() public {
        vm.prank(strategist);
        feeSplitter.addAsset(address(extra), 5e18);

        assertTrue(feeSplitter.isSupported(address(extra)));
        assertEq(feeSplitter.minDistribute(address(extra)), 5e18);
        assertEq(feeSplitter.getSupportedAssets().length, 3);
    }

    function test_addAsset_emitsEvent() public {
        vm.expectEmit({emitter: address(feeSplitter)});
        emit IFeeSplitter.AssetAdded(address(extra), 5e18);

        vm.prank(strategist);
        feeSplitter.addAsset(address(extra), 5e18);
    }

    function test_addAsset_RevertWhen_alreadySupported() public {
        vm.prank(strategist);
        vm.expectRevert("Asset already supported");
        feeSplitter.addAsset(address(ousd), 1e18);
    }

    function test_addAsset_RevertWhen_zeroAddress() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid asset");
        feeSplitter.addAsset(address(0), 1e18);
    }

    function test_addAsset_RevertWhen_notStrategistOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Strategist or Governor");
        feeSplitter.addAsset(address(extra), 1e18);
    }

    //////////////////////////////////////////////////////
    /// --- REMOVE
    //////////////////////////////////////////////////////

    function test_removeAsset_clearsState() public {
        vm.prank(strategist);
        feeSplitter.removeAsset(address(ousd));

        assertFalse(feeSplitter.isSupported(address(ousd)));
        assertEq(feeSplitter.minDistribute(address(ousd)), 0);
        assertEq(feeSplitter.getSupportedAssets().length, 1);
    }

    /// @dev Swap-and-pop must not drop the surviving entries.
    function test_removeAsset_keepsRemainingAssets() public {
        vm.startPrank(strategist);
        feeSplitter.addAsset(address(extra), 5e18);
        feeSplitter.removeAsset(address(ousd)); // removes a middle-ish element
        vm.stopPrank();

        address[] memory assets = feeSplitter.getSupportedAssets();
        assertEq(assets.length, 2);

        bool sawOeth;
        bool sawExtra;
        for (uint256 i = 0; i < assets.length; ++i) {
            if (assets[i] == address(oeth)) sawOeth = true;
            if (assets[i] == address(extra)) sawExtra = true;
        }
        assertTrue(sawOeth, "OETH lost");
        assertTrue(sawExtra, "extra lost");
    }

    function test_removeAsset_removedAssetIsSkippedByDistribute() public {
        ousd.mint(address(feeSplitter), 1000e18);

        vm.prank(strategist);
        feeSplitter.removeAsset(address(ousd));

        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(address(feeSplitter)), 1000e18, "balance stays put");
    }

    function test_removeAsset_RevertWhen_notSupported() public {
        vm.prank(strategist);
        vm.expectRevert("Asset not supported");
        feeSplitter.removeAsset(address(extra));
    }

    function test_removeAsset_canBeReAdded() public {
        vm.startPrank(strategist);
        feeSplitter.removeAsset(address(ousd));
        feeSplitter.addAsset(address(ousd), 7e18);
        vm.stopPrank();

        assertTrue(feeSplitter.isSupported(address(ousd)));
        assertEq(feeSplitter.minDistribute(address(ousd)), 7e18);
        assertEq(feeSplitter.getSupportedAssets().length, 2);
    }

    //////////////////////////////////////////////////////
    /// --- MIN DISTRIBUTE
    //////////////////////////////////////////////////////

    function test_setMinDistribute_updates() public {
        vm.prank(strategist);
        feeSplitter.setMinDistribute(address(ousd), 99e18);

        assertEq(feeSplitter.minDistribute(address(ousd)), 99e18);
    }

    function test_setMinDistribute_RevertWhen_notSupported() public {
        vm.prank(strategist);
        vm.expectRevert("Asset not supported");
        feeSplitter.setMinDistribute(address(extra), 1e18);
    }

    //////////////////////////////////////////////////////
    /// --- REBASE OPT-IN
    //////////////////////////////////////////////////////

    function test_optIntoRebase_marksAccountRebasing() public {
        assertTrue(ousd.isRebasing(address(feeSplitter)), "opted in during setup");
        assertTrue(oeth.isRebasing(address(feeSplitter)));
    }

    function test_optIntoRebase_worksForNewlyAddedAsset() public {
        vm.startPrank(strategist);
        feeSplitter.addAsset(address(extra), 1e18);
        feeSplitter.optIntoRebase(address(extra));
        vm.stopPrank();

        assertTrue(extra.isRebasing(address(feeSplitter)));
    }

    function test_optIntoRebase_RevertWhen_notStrategistOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Strategist or Governor");
        feeSplitter.optIntoRebase(address(extra));
    }
}
