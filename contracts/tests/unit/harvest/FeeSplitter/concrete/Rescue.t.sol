// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_FeeSplitter_Shared_Test} from "tests/unit/harvest/FeeSplitter/shared/Shared.t.sol";

// --- Project imports
import {MockRebasingToken} from "tests/mocks/MockRebasingToken.sol";

contract Unit_Concrete_FeeSplitter_Rescue_Test is Unit_FeeSplitter_Shared_Test {
    MockRebasingToken internal stray;

    function setUp() public override {
        super.setUp();
        stray = new MockRebasingToken("Stray", "STRAY", 18);
        stray.mint(address(feeSplitter), 100e18);
    }

    function test_rescue_movesUnsupportedTokenToGovernor() public {
        vm.prank(governor);
        feeSplitter.rescue(address(stray), 100e18);

        assertEq(stray.balanceOf(governor), 100e18);
        assertEq(stray.balanceOf(address(feeSplitter)), 0);
    }

    function test_rescue_partialAmount() public {
        vm.prank(governor);
        feeSplitter.rescue(address(stray), 40e18);

        assertEq(stray.balanceOf(governor), 40e18);
        assertEq(stray.balanceOf(address(feeSplitter)), 60e18);
    }

    /// @dev Without this guard, rescue would be an unbounded fee redirect that
    ///      sidesteps setOperationsWallet entirely.
    function test_rescue_RevertWhen_assetIsSupported() public {
        ousd.mint(address(feeSplitter), 100e18);

        vm.prank(governor);
        vm.expectRevert("Cannot rescue a supported asset");
        feeSplitter.rescue(address(ousd), 100e18);
    }

    function test_rescue_worksAfterAssetIsRemoved() public {
        ousd.mint(address(feeSplitter), 100e18);

        vm.prank(strategist);
        feeSplitter.removeAsset(address(ousd));

        vm.prank(governor);
        feeSplitter.rescue(address(ousd), 100e18);

        assertEq(ousd.balanceOf(governor), 100e18);
    }
}
