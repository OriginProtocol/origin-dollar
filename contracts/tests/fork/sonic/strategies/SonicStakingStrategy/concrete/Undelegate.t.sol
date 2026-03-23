// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {SonicValidatorDelegator} from "contracts/strategies/sonic/SonicValidatorDelegator.sol";

import {
    Fork_SonicStakingStrategy_Shared_Test
} from "tests/fork/sonic/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_Undelegate_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_undelegate() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        _depositTokenAmount(15_000 ether, false);
        _undelegateTokenAmount(15_000 ether, defaultValidatorId);
    }

    function test_unsupportValidator_autoUndelegates() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        _depositTokenAmount(15_000 ether, false);

        uint256 expectedWithdrawId = sonicStakingStrategy.nextWithdrawId();
        uint256 stakedAmount = sfc.getStake(address(sonicStakingStrategy), defaultValidatorId);

        vm.expectEmit(true, true, true, true, address(sonicStakingStrategy));
        emit SonicValidatorDelegator.Undelegated(expectedWithdrawId, defaultValidatorId, stakedAmount);

        vm.prank(timelockAddr);
        sonicStakingStrategy.unsupportValidator(defaultValidatorId);
    }
}
