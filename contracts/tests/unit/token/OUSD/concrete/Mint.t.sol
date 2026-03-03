// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.sol";
import {OUSD} from "contracts/token/OUSD.sol";

contract Unit_Concrete_OUSD_Mint_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT
    //////////////////////////////////////////////////////

    function test_mint_RevertWhen_notVault() public {
        vm.prank(matt);
        vm.expectRevert("Caller is not the Vault");
        ousd.mint(matt, 100e18);
    }

    function test_mint_toRebasingUser() public {
        uint256 balBefore = ousd.balanceOf(matt);
        _mintOUSD(matt, 50e6);
        assertEq(ousd.balanceOf(matt), balBefore + 50e18);
    }

    function test_mint_toNonRebasingUser() public {
        // Setup: transfer USDC to contract and mint via vault
        _dealUSDC(address(mockNonRebasing), 100e6);
        mockNonRebasing.approveFor(address(usdc), address(ousdVault), 100e6);
        mockNonRebasing.mintOusd(address(ousdVault), 50e6);

        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 50e18, 1);
    }

    function test_mint_RevertWhen_zeroAddress() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Mint to the zero address");
        ousd.mint(address(0), 100e18);
    }

    function test_mint_RevertWhen_maxSupplyExceeded() public {
        // Mint close to MAX_SUPPLY (type(uint128).max)
        uint256 maxSupply = type(uint128).max;
        uint256 currentSupply = ousd.totalSupply();
        uint256 amountToMint = maxSupply - currentSupply + 1;

        _dealUSDC(matt, amountToMint / 1e12 + 1);
        vm.startPrank(matt);
        usdc.approve(address(ousdVault), type(uint256).max);
        vm.stopPrank();

        vm.prank(address(ousdVault));
        vm.expectRevert("Max supply");
        ousd.mint(matt, amountToMint);
    }
}
