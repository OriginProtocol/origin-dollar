// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_CompoundingStakingStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_CompoundingStakingStrategy_ValidatorStaking_Test is Fork_CompoundingStakingStrategy_Shared_Test {
    function test_stakeEth_depositsValidatorOnBeaconChain() public {
        _depositToStrategy(INITIAL_DEPOSIT_AMOUNT);

        _stakeValidator();
    }

    function test_stakeEth_withThirdPartyWeth() public {
        uint256 vaultDeposit = 16 ether;
        _depositToStrategy(vaultDeposit);

        vm.prank(domen);
        weth.transfer(address(strategy), INITIAL_DEPOSIT_AMOUNT - vaultDeposit);

        _stakeValidator();
    }
}
