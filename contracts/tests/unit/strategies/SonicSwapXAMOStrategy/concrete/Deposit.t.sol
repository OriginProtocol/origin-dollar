// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {ISonicSwapXAMOStrategy} from "contracts/interfaces/strategies/ISonicSwapXAMOStrategy.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_Deposit_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_deposit_mintsProportionalOS() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        // Pool is balanced (100e18 / 100e18), so OS minted should equal wS deposited
        _setupPoolReserves(100 ether, 100 ether);

        uint256 osSupplyBefore = oSonic.totalSupply();
        _depositAsVault(amount);
        uint256 osMinted = oSonic.totalSupply() - osSupplyBefore;

        // Balanced pool: osAmount = (wsAmount * osReserves) / wsReserves = amount
        assertEq(osMinted, amount);
    }

    function test_deposit_depositsToPoolAndGauge() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);

        _depositAsVault(amount);

        // LP tokens should be staked in gauge
        assertGt(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        // No LP tokens left in strategy
        assertEq(mockSwapXPair.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_deposit_emitsDepositEvents() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), amount);

        // Expect Deposit event for wS
        vm.expectEmit(true, true, true, true);
        emit ISonicSwapXAMOStrategy.Deposit(address(mockWrappedSonic), address(mockSwapXPair), amount);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), amount);
    }

    function test_deposit_solvencyCheck() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Verify solvency maintained
        uint256 totalValue = oSonicVault.totalValue();
        uint256 totalSupply = oSonic.totalSupply();
        assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Unsupported asset");
        sonicSwapXAMOStrategy.deposit(address(oSonic), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Must deposit something");
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), 0);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), 1 ether);
    }

    function test_deposit_RevertWhen_emptyPool() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolReserves(0, 0);

        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), 1 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Empty pool");
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), 1 ether);
    }

    function test_deposit_RevertWhen_protocolInsolvent() public {
        // Mint a large amount of OS externally to inflate supply
        vm.prank(address(oSonicVault));
        oSonic.mint(alice, 1000 ether);

        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), 1 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Protocol insolvent");
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), 1 ether);
    }

    function test_deposit_RevertWhen_priceOutOfRange() public {
        _seedVaultForSolvency(100 ether);
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), 1 ether);

        // Set amountOut to make price deviate far beyond maxDepeg (1%)
        mockSwapXPair.setAmountOut(0.5 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), 1 ether);
    }
}
