// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.sol";

contract Unit_Fuzz_OUSDVault_Mint_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT FUZZ TESTS
    //////////////////////////////////////////////////////

    /// @notice alice OUSD balance equals amount * 1e12 after mint
    function testFuzz_mint_ousdBalanceMatchesScaledAmount(uint256 amount) public {
        amount = bound(amount, 1, 1e12);

        _mintOUSD(alice, amount);

        assertEq(ousd.balanceOf(alice), amount * 1e12);
    }

    /// @notice vault USDC balance increases by exact amount
    function testFuzz_mint_vaultUSDCBalanceIncrease(uint256 amount) public {
        amount = bound(amount, 1, 1e12);

        uint256 vaultBefore = usdc.balanceOf(address(ousdVault));
        _mintOUSD(alice, amount);

        assertEq(usdc.balanceOf(address(ousdVault)), vaultBefore + amount);
    }

    /// @notice totalSupply increases by amount * 1e12
    function testFuzz_mint_totalSupplyIncrease(uint256 amount) public {
        amount = bound(amount, 1, 1e12);

        uint256 supplyBefore = ousd.totalSupply();
        _mintOUSD(alice, amount);

        assertEq(ousd.totalSupply(), supplyBefore + amount * 1e12);
    }

    /// @notice totalValue increases by amount * 1e12
    function testFuzz_mint_totalValueIncrease(uint256 amount) public {
        amount = bound(amount, 1, 1e12);

        uint256 valueBefore = ousdVault.totalValue();
        _mintOUSD(alice, amount);

        assertEq(ousdVault.totalValue(), valueBefore + amount * 1e12);
    }

    /// @notice mint then full withdrawal returns same USDC
    function testFuzz_mint_roundTrip_exactRecovery(uint256 amount) public {
        amount = bound(amount, 1, 1e12);

        _mintOUSD(alice, amount);
        uint256 ousdBal = ousd.balanceOf(alice);

        vm.prank(alice);
        ousdVault.requestWithdrawal(ousdBal);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Request ID is 0 for matt, 1 for josh (from setUp drain), 2 for alice
        // Actually in setUp: matt and josh each get 100e6 minted but no withdrawal.
        // So the first requestWithdrawal gets index 0.
        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ousdVault.claimWithdrawal(0);

        assertEq(usdc.balanceOf(alice) - usdcBefore, amount);
    }

    /// @notice withdraw arbitrary OUSD amount: USDC = ousdAmt / 1e12, dust = ousdAmt % 1e12
    function testFuzz_mint_roundTrip_dustLoss(uint256 ousdAmt) public {
        ousdAmt = bound(ousdAmt, 1, 100e18);

        // Mint enough USDC to cover ousdAmt
        uint256 usdcNeeded = (ousdAmt / 1e12) + 1; // +1 to cover any dust
        _mintOUSD(alice, usdcNeeded);

        uint256 aliceOusd = ousd.balanceOf(alice);
        // Ensure alice has enough OUSD
        require(aliceOusd >= ousdAmt, "not enough OUSD");

        // Transfer excess to bobby so alice has exactly ousdAmt
        if (aliceOusd > ousdAmt) {
            vm.prank(alice);
            ousd.transfer(bobby, aliceOusd - ousdAmt);
        }

        uint256 expectedUsdc = ousdAmt / 1e12;

        vm.prank(alice);
        ousdVault.requestWithdrawal(ousdAmt);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ousdVault.claimWithdrawal(0);

        assertEq(usdc.balanceOf(alice) - usdcBefore, expectedUsdc);
    }

    /// @notice two sequential mints produce additive OUSD balance
    function testFuzz_mint_multipleMints_additive(uint256 a1, uint256 a2) public {
        a1 = bound(a1, 1, 5e11);
        a2 = bound(a2, 1, 5e11);

        _mintOUSD(alice, a1);
        _mintOUSD(alice, a2);

        assertEq(ousd.balanceOf(alice), (a1 + a2) * 1e12);
    }
}
