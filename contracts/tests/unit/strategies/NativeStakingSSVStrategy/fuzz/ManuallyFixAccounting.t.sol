// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_NativeStakingSSVStrategy_ManuallyFixAccounting_Test
    is Unit_NativeStakingSSVStrategy_Shared_Test
{
    /// @dev Fuzz validatorsDelta in [-3, 3]
    function testFuzz_manuallyFixAccounting_validatorsDelta(int8 rawDelta) public {
        int256 delta = bound(int256(rawDelta), -3, 3);

        _setActiveDepositedValidators(10);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(delta, 0, 0);

        assertEq(nativeStakingSSVStrategy.activeDepositedValidators(), uint256(int256(10) + delta));
    }

    /// @dev Fuzz consensusRewardsDelta - keep remainder below fuseStart so _doAccounting succeeds cleanly
    function testFuzz_manuallyFixAccounting_consensusRewardsDelta(uint256 rawDelta) public {
        // Start with 10 ether consensus rewards and 15 ether balance
        // After delta, consensusRewards changes; _doAccounting sees ethRemaining = balance - consensusRewards
        // For _doAccounting to succeed, ethRemaining must be < fuseStart (21.6 ether)
        // So we fuzz delta in [0, 10 ether] (adding to consensus rewards)
        // ethRemaining = 15 - (10 + delta) = 5 - delta, which is [0, 5] — well below fuseStart
        uint256 delta = bound(rawDelta, 0, 5 ether);

        vm.deal(address(nativeStakingSSVStrategy), 15 ether);
        _setConsensusRewards(10 ether);
        _setActiveDepositedValidators(10_000);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        uint256 expectedConsensusRewards = 10 ether + delta;

        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, int256(delta), 0);

        // After manuallyFixAccounting, _doAccounting adds ethRemaining to consensusRewards
        // Final consensusRewards = (10 + delta) + (15 - (10 + delta)) = 15
        assertEq(nativeStakingSSVStrategy.consensusRewards(), 15 ether);
    }

    /// @dev Fuzz ethToVault amount
    function testFuzz_manuallyFixAccounting_ethToVault(uint256 rawEth) public {
        uint256 ethToVault = bound(rawEth, 0, 95 ether);

        vm.deal(address(nativeStakingSSVStrategy), ethToVault + 2 ether);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        uint256 ethBefore = address(nativeStakingSSVStrategy).balance;

        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, ethToVault);

        assertEq(address(nativeStakingSSVStrategy).balance, ethBefore - ethToVault);
    }
}
