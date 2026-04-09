// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AutoWithdrawalModule_Shared_Test} from "tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol";

// --- Project imports
import {IAutoWithdrawalModule} from "contracts/interfaces/automation/IAutoWithdrawalModule.sol";

contract Unit_Concrete_AutoWithdrawalModule_FundWithdrawals_Test is Unit_AutoWithdrawalModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_fundWithdrawals_noopWhenShortfallIsZero() public {
        // queued == claimable => shortfall = 0
        mockVault.setQueueMetadata(100e18, 100e18);

        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        // No withdrawal should have been attempted
        assertFalse(mockVault.withdrawFromStrategyCalled());
    }

    function test_fundWithdrawals_emitsInsufficientStrategyLiquidityWhenStrategyEmpty() public {
        // shortfall = 100e18, strategy balance = 0
        mockVault.setQueueMetadata(100e18, 0);
        mockStrategy.setNextBalance(0);

        vm.expectEmit(true, false, false, true, address(autoWithdrawalModule));
        emit IAutoWithdrawalModule.InsufficientStrategyLiquidity(address(mockStrategy), 100e18, 0);

        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        // No withdrawal should have been attempted
        assertFalse(mockVault.withdrawFromStrategyCalled());
    }

    function test_fundWithdrawals_exactShortfallWithdrawal() public {
        uint256 shortfall = 100e18;
        // queued=100, claimable=0 => shortfall=100
        mockVault.setQueueMetadata(uint128(shortfall), 0);
        // Strategy has enough to cover full shortfall
        mockStrategy.setNextBalance(shortfall);

        vm.expectEmit(true, false, false, true, address(autoWithdrawalModule));
        emit IAutoWithdrawalModule.LiquidityWithdrawn(address(mockStrategy), shortfall, 0);

        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        assertTrue(mockVault.withdrawFromStrategyCalled());
        assertEq(mockVault.lastWithdrawStrategy(), address(mockStrategy));
        assertEq(mockVault.lastWithdrawAmount(), shortfall);
    }

    function test_fundWithdrawals_partialWithdrawal() public {
        uint256 shortfall = 100e18;
        uint256 strategyBalance = 60e18;
        // queued=100, claimable=0 => shortfall=100
        mockVault.setQueueMetadata(uint128(shortfall), 0);
        // Strategy has less than shortfall
        mockStrategy.setNextBalance(strategyBalance);

        vm.expectEmit(true, false, false, true, address(autoWithdrawalModule));
        emit IAutoWithdrawalModule.LiquidityWithdrawn(
            address(mockStrategy), strategyBalance, shortfall - strategyBalance
        );

        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        assertTrue(mockVault.withdrawFromStrategyCalled());
        assertEq(mockVault.lastWithdrawAmount(), strategyBalance);
    }

    function test_fundWithdrawals_emitsWithdrawalFailedWhenSafeExecFails() public {
        uint256 shortfall = 100e18;
        mockVault.setQueueMetadata(uint128(shortfall), 0);
        mockStrategy.setNextBalance(shortfall);

        // Make safe exec fail
        mockSafe.setShouldFail(true);

        vm.expectEmit(true, false, false, true, address(autoWithdrawalModule));
        emit IAutoWithdrawalModule.WithdrawalFailed(address(mockStrategy), shortfall);

        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        // withdrawFromStrategy was never actually called on the vault since safe failed
        assertFalse(mockVault.withdrawFromStrategyCalled());
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_fundWithdrawals_RevertWhen_notOperator() public {
        vm.expectRevert("Caller is not an operator");
        vm.prank(josh);
        autoWithdrawalModule.fundWithdrawals();
    }
}
