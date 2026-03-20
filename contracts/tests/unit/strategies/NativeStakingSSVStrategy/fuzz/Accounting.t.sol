// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_NativeStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_NativeStakingSSVStrategy_Accounting_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    // fuseStart 21.6 ether, fuseEnd 25.6 ether

    /// @dev Fuzz: consensus rewards path (ethBalance < fuseStart after subtracting previous)
    function testFuzz_doAccounting_consensusRewards(uint256 ethBalance) public {
        // Bound to consensus rewards range (0, fuseStart)
        ethBalance = bound(ethBalance, 0.001 ether, 21.5 ether);

        vm.deal(address(nativeStakingSSVStrategy), ethBalance);
        _setActiveDepositedValidators(30);
        _setConsensusRewards(0);

        vm.prank(governor);
        bool valid = nativeStakingSSVStrategy.doAccounting();
        assertTrue(valid);

        // Consensus rewards should have increased
        assertEq(nativeStakingSSVStrategy.consensusRewards(), ethBalance);
    }

    /// @dev Fuzz: full withdrawal path (ethBalance >= 32 ether, remainder < fuseStart)
    function testFuzz_doAccounting_fullWithdrawal(uint8 numWithdrawals) public {
        numWithdrawals = uint8(bound(numWithdrawals, 1, 8));
        uint256 ethBalance = uint256(numWithdrawals) * 32 ether;

        vm.deal(address(nativeStakingSSVStrategy), ethBalance);
        _setActiveDepositedValidators(30);
        _setConsensusRewards(0);

        vm.prank(governor);
        bool valid = nativeStakingSSVStrategy.doAccounting();
        assertTrue(valid);

        assertEq(nativeStakingSSVStrategy.activeDepositedValidators(), 30 - numWithdrawals);
    }

    /// @dev Fuzz: fuse blown path (ethBalance in [fuseStart, fuseEnd])
    function testFuzz_doAccounting_fuseBlown(uint256 ethBalance) public {
        ethBalance = bound(ethBalance, 21.6 ether, 25.6 ether);

        vm.deal(address(nativeStakingSSVStrategy), ethBalance);
        _setActiveDepositedValidators(30);
        _setConsensusRewards(0);

        vm.prank(governor);
        bool valid = nativeStakingSSVStrategy.doAccounting();
        assertFalse(valid);
        assertTrue(nativeStakingSSVStrategy.paused());
    }
}
