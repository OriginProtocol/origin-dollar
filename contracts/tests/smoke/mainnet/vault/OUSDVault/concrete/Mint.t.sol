// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDVault_Shared_Test} from "tests/smoke/mainnet/vault/OUSDVault/shared/Shared.t.sol";

contract Smoke_Concrete_OUSDVault_Mint_Test is Smoke_OUSDVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT
    //////////////////////////////////////////////////////

    function test_mint_increasesTotalValue() public {
        uint256 totalValueBefore = ousdVault.totalValue();
        _mintOUSD(alice, 1000e6);
        uint256 totalValueAfter = ousdVault.totalValue();

        assertApproxEqAbs(totalValueAfter - totalValueBefore, 1000e18, 1e18);
    }

    function test_mint_usdcDebitedFromUser() public {
        deal(address(usdc), alice, 1000e6);
        vm.startPrank(alice);
        usdc.approve(address(ousdVault), 1000e6);
        ousdVault.mint(1000e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 0);
    }

    function test_mint_vaultReceivesUsdc() public {
        uint256 vaultUsdcBefore = usdc.balanceOf(address(ousdVault));
        _mintOUSD(alice, 1000e6);
        uint256 vaultUsdcAfter = usdc.balanceOf(address(ousdVault));

        // Vault USDC increases (may not be full amount if auto-allocated or queued)
        assertGe(vaultUsdcAfter, vaultUsdcBefore);
    }
}
