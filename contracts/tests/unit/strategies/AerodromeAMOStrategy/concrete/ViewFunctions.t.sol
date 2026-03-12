// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_AerodromeAMOStrategy_ViewFunctions_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_checkBalance_returnsZeroWithNoDeposit() public view {
        uint256 balance = aerodromeAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 0);
    }

    function test_checkBalance_includesDirectWethBalance() public {
        deal(address(weth), address(aerodromeAMOStrategy), 5 ether);

        uint256 balance = aerodromeAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 5 ether);
    }

    function test_checkBalance_includesOethbBalance() public {
        // Mint OETHb to strategy via vault (only vault can mint)
        vm.prank(address(oethBaseVault));
        oethBase.mint(address(aerodromeAMOStrategy), 3 ether);

        uint256 balance = aerodromeAMOStrategy.checkBalance(address(weth));
        assertEq(balance, 3 ether);
    }

    function test_checkBalance_includesUnderlyingAssets() public {
        // Deposit to create position with underlyingAssets tracked
        _depositAsVault(10 ether);

        uint256 balance = aerodromeAMOStrategy.checkBalance(address(weth));
        // Should include underlyingAssets from the position
        assertGt(balance, 0);
    }

    function test_checkBalance_RevertWhen_notWeth() public {
        vm.expectRevert("Only WETH supported");
        aerodromeAMOStrategy.checkBalance(address(oethBase));
    }

    function test_supportsAsset_weth() public view {
        assertTrue(aerodromeAMOStrategy.supportsAsset(address(weth)));
    }

    function test_supportsAsset_nonWeth() public view {
        assertFalse(aerodromeAMOStrategy.supportsAsset(address(oethBase)));
        assertFalse(aerodromeAMOStrategy.supportsAsset(alice));
    }

    function test_getPositionPrincipal_noPosition() public view {
        (uint256 wethAmount, uint256 oethbAmount) = aerodromeAMOStrategy.getPositionPrincipal();
        assertEq(wethAmount, 0);
        assertEq(oethbAmount, 0);
    }

    function test_getPositionPrincipal_withPosition() public {
        _depositAsVault(10 ether);
        mockSugarHelper.setPrincipal(4 ether, 6 ether);

        (uint256 wethAmount, uint256 oethbAmount) = aerodromeAMOStrategy.getPositionPrincipal();
        assertEq(wethAmount, 4 ether);
        assertEq(oethbAmount, 6 ether);
    }

    function test_getPoolX96Price() public view {
        uint160 price = aerodromeAMOStrategy.getPoolX96Price();
        assertEq(price, DEFAULT_POOL_PRICE);
    }

    function test_getCurrentTradingTick() public view {
        int24 tick = aerodromeAMOStrategy.getCurrentTradingTick();
        assertEq(tick, -1);
    }

    function test_getWETHShare() public view {
        // With default sugar helper returning 1:1 for estimateAmount1,
        // WETH share = 1e18 / (1e18 + 1e18) = 0.5e18 = 50%
        uint256 share = aerodromeAMOStrategy.getWETHShare();
        assertEq(share, 0.5 ether);
    }

    function test_getWETHShare_withCustomEstimate() public {
        // Set estimateAmount1 to return 3 ether (for 1 ether WETH)
        // WETH share = 1e18 / (1e18 + 3e18) = 0.25e18 = 25%
        mockSugarHelper.setEstimateAmount1(3 ether);

        uint256 share = aerodromeAMOStrategy.getWETHShare();
        assertEq(share, 0.25 ether);
    }

    function test_solvencyThreshold() public view {
        assertEq(aerodromeAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
    }

    function test_onERC721Received() public {
        bytes4 result = aerodromeAMOStrategy.onERC721Received(address(0), address(0), 0, "");
        assertEq(result, aerodromeAMOStrategy.onERC721Received.selector);
    }
}
