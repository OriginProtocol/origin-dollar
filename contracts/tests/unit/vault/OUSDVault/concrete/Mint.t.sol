// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

contract Unit_Concrete_OUSDVault_Mint_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT(UINT256)
    //////////////////////////////////////////////////////

    function test_mint() public {
        uint256 usdcAmount = DEFAULT_USDC_AMOUNT; // 10_000e6
        uint256 expectedOUSD = DEFAULT_WETH_AMOUNT; // 10_000e18

        _dealUSDC(alice, usdcAmount);

        vm.startPrank(alice);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();

        assertEq(ousd.balanceOf(alice), expectedOUSD, "OUSD balance mismatch");
        assertEq(usdc.balanceOf(alice), 0, "USDC not fully spent");
        assertEq(usdc.balanceOf(address(ousdVault)), usdcAmount + 200e6, "Vault USDC balance mismatch");
    }

    function test_mint_RevertWhen_amountIsZero() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be greater than 0");
        ousdVault.mint(0);
    }

    function test_mint_RevertWhen_capitalPaused() public {
        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(alice);
        vm.expectRevert("Capital paused");
        ousdVault.mint(1000e6);
    }

    function test_mint_emitsMintEvent() public {
        uint256 usdcAmount = 50e6;
        uint256 scaledAmount = 50e18;
        _dealUSDC(alice, usdcAmount);

        vm.startPrank(alice);
        usdc.approve(address(ousdVault), usdcAmount);

        vm.expectEmit(true, true, true, true);
        emit IVault.Mint(alice, scaledAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();
    }

    function test_mint_scalesToCorrectOUSDDecimals() public {
        // Deposit 50 USDC (6 decimals) → expect 50 OUSD (18 decimals)
        uint256 usdcAmount = 50e6;
        uint256 expectedOUSD = 50e18;

        _dealUSDC(alice, usdcAmount);

        vm.startPrank(alice);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();

        assertEq(ousd.balanceOf(alice), expectedOUSD, "OUSD decimals mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- MINT(ADDRESS, UINT256, UINT256) — DEPRECATED OVERLOAD
    //////////////////////////////////////////////////////

    function test_mintDeprecated_works() public {
        uint256 usdcAmount = 100e6;
        uint256 expectedOUSD = 100e18;

        _dealUSDC(alice, usdcAmount);

        vm.startPrank(alice);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();

        assertEq(ousd.balanceOf(alice), expectedOUSD, "Deprecated mint OUSD mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- MINTFORSTRATEGY
    //////////////////////////////////////////////////////

    function test_mintForStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));

        uint256 mintAmount = 1000e18;
        vm.prank(address(strategy));
        ousdVault.mintForStrategy(mintAmount);

        assertEq(ousd.balanceOf(address(strategy)), mintAmount, "Strategy OUSD balance mismatch");
    }

    function test_mintForStrategy_RevertWhen_unsupportedStrategy() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(address(fakeStrategy));
        vm.expectRevert("Unsupported strategy");
        ousdVault.mintForStrategy(1000e18);
    }

    function test_mintForStrategy_RevertWhen_notWhitelisted() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        // Approved but NOT whitelisted for minting

        vm.prank(address(strategy));
        vm.expectRevert("Not whitelisted strategy");
        ousdVault.mintForStrategy(1000e18);
    }

    //////////////////////////////////////////////////////
    /// --- BURNFORSTRATEGY
    //////////////////////////////////////////////////////

    function test_burnForStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));

        // First mint some OUSD for the strategy
        uint256 amount = 1000e18;
        vm.prank(address(strategy));
        ousdVault.mintForStrategy(amount);

        assertEq(ousd.balanceOf(address(strategy)), amount);

        // Now burn it
        vm.prank(address(strategy));
        ousdVault.burnForStrategy(amount);

        assertEq(ousd.balanceOf(address(strategy)), 0, "Strategy OUSD not burned");
    }

    function test_burnForStrategy_RevertWhen_unsupportedStrategy() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(address(fakeStrategy));
        vm.expectRevert("Unsupported strategy");
        ousdVault.burnForStrategy(1000e18);
    }

    function test_burnForStrategy_RevertWhen_notWhitelisted() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        // Approved but NOT whitelisted

        vm.prank(address(strategy));
        vm.expectRevert("Not whitelisted strategy");
        ousdVault.burnForStrategy(1000e18);
    }

    //////////////////////////////////////////////////////
    /// --- AUTO-ALLOCATE ON MINT
    //////////////////////////////////////////////////////

    function test_mint_autoAllocatesAboveThreshold() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        ousdVault.setAutoAllocateThreshold(50e18); // 50 OUSD
        vm.stopPrank();

        // Mint 60 USDC (= 60 OUSD scaled) which exceeds the 50 OUSD threshold
        _dealUSDC(alice, 60e6);
        vm.startPrank(alice);
        usdc.approve(address(ousdVault), 60e6);
        ousdVault.mint(60e6);
        vm.stopPrank();

        // Strategy should have received funds via auto-allocate
        assertGt(usdc.balanceOf(address(strategy)), 0, "Strategy should receive allocation");
    }
}
