// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OETHVault_Mint_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT(UINT256)
    //////////////////////////////////////////////////////

    function test_mint() public {
        uint256 wethAmount = DEFAULT_WETH_AMOUNT; // 10_000e18
        uint256 expectedOETH = DEFAULT_WETH_AMOUNT; // 10_000e18

        _dealWETH(alice, wethAmount);

        vm.startPrank(alice);
        weth.approve(address(oethVault), wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();

        assertEq(oeth.balanceOf(alice), expectedOETH, "OETH balance mismatch");
        assertEq(weth.balanceOf(alice), 0, "WETH not fully spent");
        assertEq(weth.balanceOf(address(oethVault)), wethAmount + 200e18, "Vault WETH balance mismatch");
    }

    function test_mint_RevertWhen_amountIsZero() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be greater than 0");
        oethVault.mint(0);
    }

    function test_mint_RevertWhen_capitalPaused() public {
        vm.prank(governor);
        oethVault.pauseCapital();

        vm.prank(alice);
        vm.expectRevert("Capital paused");
        oethVault.mint(1000e18);
    }

    function test_mint_emitsMintEvent() public {
        uint256 wethAmount = 50e18;
        _dealWETH(alice, wethAmount);

        vm.startPrank(alice);
        weth.approve(address(oethVault), wethAmount);

        vm.expectEmit(true, true, true, true);
        emit IVault.Mint(alice, wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- MINT(ADDRESS, UINT256, UINT256) — DEPRECATED OVERLOAD
    //////////////////////////////////////////////////////

    function test_mintDeprecated_works() public {
        uint256 wethAmount = 100e18;
        uint256 expectedOETH = 100e18;

        _dealWETH(alice, wethAmount);

        vm.startPrank(alice);
        weth.approve(address(oethVault), wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();

        assertEq(oeth.balanceOf(alice), expectedOETH, "Deprecated mint OETH mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- MINTFORSTRATEGY
    //////////////////////////////////////////////////////

    function test_mintForStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        uint256 mintAmount = 1000e18;
        vm.prank(address(strategy));
        oethVault.mintForStrategy(mintAmount);

        assertEq(oeth.balanceOf(address(strategy)), mintAmount, "Strategy OETH balance mismatch");
    }

    function test_mintForStrategy_RevertWhen_unsupportedStrategy() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(address(fakeStrategy));
        vm.expectRevert("Unsupported strategy");
        oethVault.mintForStrategy(1000e18);
    }

    function test_mintForStrategy_RevertWhen_notWhitelisted() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        // Approved but NOT whitelisted for minting

        vm.prank(address(strategy));
        vm.expectRevert("Not whitelisted strategy");
        oethVault.mintForStrategy(1000e18);
    }

    //////////////////////////////////////////////////////
    /// --- BURNFORSTRATEGY
    //////////////////////////////////////////////////////

    function test_burnForStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        // First mint some OETH for the strategy
        uint256 amount = 1000e18;
        vm.prank(address(strategy));
        oethVault.mintForStrategy(amount);

        assertEq(oeth.balanceOf(address(strategy)), amount);

        // Now burn it
        vm.prank(address(strategy));
        oethVault.burnForStrategy(amount);

        assertEq(oeth.balanceOf(address(strategy)), 0, "Strategy OETH not burned");
    }

    function test_burnForStrategy_RevertWhen_overflow() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        vm.prank(address(strategy));
        vm.expectRevert("SafeCast: value doesn't fit in an int256");
        oethVault.burnForStrategy(10e76);
    }

    function test_burnForStrategy_RevertWhen_unsupportedStrategy() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(address(fakeStrategy));
        vm.expectRevert("Unsupported strategy");
        oethVault.burnForStrategy(1000e18);
    }

    function test_burnForStrategy_RevertWhen_notWhitelisted() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        // Approved but NOT whitelisted

        vm.prank(address(strategy));
        vm.expectRevert("Not whitelisted strategy");
        oethVault.burnForStrategy(1000e18);
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGYFROM MINTWHITELIST
    //////////////////////////////////////////////////////

    function test_removeStrategyFromMintWhitelist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        assertTrue(oethVault.isMintWhitelistedStrategy(address(strategy)));

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyRemovedFromMintWhitelist(address(strategy));
        oethVault.removeStrategyFromMintWhitelist(address(strategy));

        assertFalse(oethVault.isMintWhitelistedStrategy(address(strategy)));
    }

    //////////////////////////////////////////////////////
    /// --- AUTO-ALLOCATE ON MINT
    //////////////////////////////////////////////////////

    function test_mint_autoAllocatesAboveThreshold() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setAutoAllocateThreshold(50e18); // 50 OETH
        vm.stopPrank();

        // Mint 60 WETH (= 60 OETH) which exceeds the 50 OETH threshold
        _dealWETH(alice, 60e18);
        vm.startPrank(alice);
        weth.approve(address(oethVault), 60e18);
        oethVault.mint(60e18);
        vm.stopPrank();

        // Strategy should have received funds via auto-allocate
        assertGt(weth.balanceOf(address(strategy)), 0, "Strategy should receive allocation");
    }

    //////////////////////////////////////////////////////
    /// --- MINT GATING: UNDER-BACKED VAULT
    //////////////////////////////////////////////////////

    /// @dev Simulate a loss by moving WETH out of the vault so totalValue falls
    /// below OToken supply. The vault starts fully backed (200 OETH / 200 WETH).
    function _makeUnderBacked() internal {
        vm.prank(address(oethVault));
        weth.transfer(governor, 10e18);
        assertLt(oethVault.totalValue(), oeth.totalSupply(), "vault should be under-backed");
    }

    function test_mint_RevertWhen_underBacked() public {
        _makeUnderBacked();

        _dealWETH(alice, 1e18);
        vm.startPrank(alice);
        weth.approve(address(oethVault), 1e18);
        vm.expectRevert("Vault under-backed");
        oethVault.mint(1e18);
        vm.stopPrank();
    }

    function test_mint_worksAfterBackingRestored() public {
        _makeUnderBacked();

        _dealWETH(alice, 1e18);
        vm.startPrank(alice);
        weth.approve(address(oethVault), 1e18);
        vm.expectRevert("Vault under-backed");
        oethVault.mint(1e18);
        vm.stopPrank();

        // Restore backing to exactly 1:1
        _dealWETH(address(this), 10e18);
        weth.transfer(address(oethVault), 10e18);
        assertEq(oethVault.totalValue(), oeth.totalSupply(), "vault should be fully backed again");

        uint256 balanceBefore = oeth.balanceOf(alice);
        vm.prank(alice);
        oethVault.mint(1e18);
        assertEq(oeth.balanceOf(alice), balanceBefore + 1e18, "mint should succeed once backed");
    }

    function test_mintForStrategy_worksWhenUnderBacked() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        _makeUnderBacked();

        // mintForStrategy is a separate path and is intentionally not gated
        uint256 mintAmount = 1000e18;
        vm.prank(address(strategy));
        oethVault.mintForStrategy(mintAmount);

        assertEq(oeth.balanceOf(address(strategy)), mintAmount, "mintForStrategy should succeed under-backed");
    }
}
