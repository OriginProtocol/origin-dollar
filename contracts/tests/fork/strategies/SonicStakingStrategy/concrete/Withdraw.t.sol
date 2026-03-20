// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_SonicStakingStrategy_Shared_Test} from
    "tests/fork/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_Withdraw_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_withdraw_undelegatedFunds() public {
        _withdrawUndelegatedAmount(15_000 ether, false);
    }

    function test_withdrawAll_undelegatedFunds() public {
        _withdrawUndelegatedAmount(15_000 ether, true);
    }
}
