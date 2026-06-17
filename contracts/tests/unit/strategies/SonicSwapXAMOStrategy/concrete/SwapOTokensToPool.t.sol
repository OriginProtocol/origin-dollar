// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {ISonicSwapXAMOStrategy} from "contracts/interfaces/strategies/ISonicSwapXAMOStrategy.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_SwapOTokensToPool_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    /// @dev Setup imbalanced pool (more wS than OS) and deposit LP for the strategy
    function _setupForSwapOTokensToPool() internal {
        _seedVaultForSolvency(1000 ether);
        // Imbalanced pool: more wS than OS (diff > 0)
        _setupPoolReserves(130 ether, 90 ether);
        _depositAsVault(20 ether);
    }

    function test_swapOTokensToPool_mintsOSAndSwaps() public {
        _setupForSwapOTokensToPool();

        uint256 supplyBefore = oSonic.totalSupply();

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(5 ether);

        // OS supply should increase (minted for swap + minted for deposit)
        assertGt(oSonic.totalSupply(), supplyBefore);
        // LP tokens should be in gauge (re-deposited)
        assertGt(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_emitsEvents() public {
        _setupForSwapOTokensToPool();

        // Expect SwapOTokensToPool event
        vm.expectEmit(false, false, false, false);
        emit ISonicSwapXAMOStrategy.SwapOTokensToPool(0, 0, 0, 0);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(5 ether);
    }

    function test_swapOTokensToPool_solvencyCheck() public {
        _setupForSwapOTokensToPool();

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(5 ether);

        // Verify solvency maintained
        uint256 totalValue = oSonicVault.totalValue();
        uint256 totalSupply = oSonic.totalSupply();
        if (totalSupply > 0) {
            assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
        }
    }

    function test_swapOTokensToPool_RevertWhen_zeroAmount() public {
        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        sonicSwapXAMOStrategy.swapOTokensToPool(0);
    }

    function test_swapOTokensToPool_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        sonicSwapXAMOStrategy.swapOTokensToPool(5 ether);
    }

    function test_swapOTokensToPool_RevertWhen_tooMuchOSInStrategy() public {
        _setupForSwapOTokensToPool();

        // Put some OS in the strategy
        vm.prank(address(oSonicVault));
        oSonic.mint(address(sonicSwapXAMOStrategy), 10 ether);

        // Try to swap less than what is already in strategy
        vm.prank(strategist);
        vm.expectRevert("Too much OToken in strategy");
        sonicSwapXAMOStrategy.swapOTokensToPool(5 ether);
    }

    function test_swapOTokensToPool_RevertWhen_oTokensOvershotPeg() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more wS than OS (diffBefore > 0)
        _setupPoolReserves(130 ether, 90 ether);

        // Set amountOut to near-zero so swap barely removes wS from pool
        // but adds a lot of OS, overshooting to OS > wS
        mockSwapXPair.setAmountOut(1);

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        sonicSwapXAMOStrategy.swapOTokensToPool(80 ether);
    }

    function test_swapOTokensToPool_RevertWhen_oTokensBalanceWorse() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more OS than wS (diffBefore < 0)
        _setupPoolReserves(90 ether, 130 ether);

        // swapOTokensToPool adds OS and removes wS from pool.
        // On a pool already heavy in OS, this worsens the OS imbalance.
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        sonicSwapXAMOStrategy.swapOTokensToPool(5 ether);
    }
}
