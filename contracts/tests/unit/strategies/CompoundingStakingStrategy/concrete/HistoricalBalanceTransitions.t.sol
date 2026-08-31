// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test
} from "../shared/TwentyOneValidatorsShared.t.sol";

contract Unit_Concrete_CompoundingStakingStrategy_HistoricalBalanceTransitions_Test is
    Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test
{
    function _prepareTwentyOneValidators() internal override {
        this.processHistoricalValidator(0);
        this.processHistoricalValidator(1);
    }

    function _applyExecutionRewardTransition() internal returns (uint256 beforeBalance, uint256 afterBalance) {
        uint256[] memory validatorPositions = new uint256[](2);
        validatorPositions[0] = 0;
        validatorPositions[1] = 1;
        beforeBalance = _applyHistoricalSnapshot(3, validatorPositions, 0, 0.987 ether);
        afterBalance = _applyHistoricalSnapshot(3, validatorPositions, 0, 1 ether);
    }

    function test_verifyBalances_executionRewardsAcrossSnapshots() public {
        (uint256 beforeBalance, uint256 afterBalance) = _applyExecutionRewardTransition();

        assertEq(afterBalance - beforeBalance, 0.013 ether);
        assertEq(compoundingStakingStrategy.lastVerifiedEthBalance(), afterBalance);
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), afterBalance);
    }

    function test_verifyBalances_consensusRewardsAcrossSnapshots() public {
        uint256[] memory validatorPositions = new uint256[](2);
        validatorPositions[0] = 0;
        validatorPositions[1] = 1;

        uint256 beforeBalance = _applyHistoricalSnapshot(3, validatorPositions, 0, 0.987 ether);
        uint256 afterBalance = _applyHistoricalSnapshot(4, validatorPositions, 0, 0.987 ether);

        assertEq(afterBalance - beforeBalance, 0.007672545 ether);
        assertEq(compoundingStakingStrategy.lastVerifiedEthBalance(), afterBalance);
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), afterBalance);
    }
}
