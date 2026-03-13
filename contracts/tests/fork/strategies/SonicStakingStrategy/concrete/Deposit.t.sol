// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_SonicStakingStrategy_Shared_Test} from
    "tests/fork/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_Deposit_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_deposit() public {
        _depositTokenAmount(15_000 ether, false);
    }

    function test_depositAll() public {
        _depositTokenAmount(15_000 ether, true);
    }

    function test_deposit_multipleValidators() public {
        _changeDefaultValidator(15);
        _depositTokenAmount(5_000 ether, false);
        _changeDefaultValidator(16);
        _depositTokenAmount(5_000 ether, false);
        _changeDefaultValidator(17);
        _depositTokenAmount(5_000 ether, false);
        _changeDefaultValidator(18);
        _depositTokenAmount(5_000 ether, false);
    }
}
