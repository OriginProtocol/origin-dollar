// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_SonicStakingStrategy_Shared_Test} from "../shared/Shared.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_SonicStakingStrategy_Harvest_Test is Smoke_SonicStakingStrategy_Shared_Test {
    function test_earnRewards_afterEpoch() public {
        uint256 balanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));

        _advanceWeek();
        _advanceSfcEpoch(1);

        uint256 balanceAfter = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after epoch due to rewards");
    }

    function test_restakeRewards() public {
        _advanceWeek();
        _advanceSfcEpoch(1);

        // Build validator IDs array from supported validators
        uint256 len = sonicStakingStrategy.supportedValidatorsLength();
        uint256[] memory validatorIds = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            validatorIds[i] = sonicStakingStrategy.supportedValidators(i);
        }

        uint256 balanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));

        vm.prank(validatorRegistrator);
        sonicStakingStrategy.restakeRewards(validatorIds);

        uint256 balanceAfter = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        // After restaking, checkBalance should remain the same or increase
        // (rewards move from pendingRewards to stake, both counted in checkBalance)
        assertGe(balanceAfter, balanceBefore, "checkBalance should not decrease after restake");
    }

    function test_collectRewards() public {
        _advanceWeek();
        _advanceSfcEpoch(1);

        // Build validator IDs array from supported validators
        uint256 len = sonicStakingStrategy.supportedValidatorsLength();
        uint256[] memory validatorIds = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            validatorIds[i] = sonicStakingStrategy.supportedValidators(i);
        }

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(validatorRegistrator);
        sonicStakingStrategy.collectRewards(validatorIds);

        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertGt(vaultBalanceAfter, vaultBalanceBefore, "Vault wS balance should increase after collecting rewards");
    }
}
