// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Fork_SonicStakingStrategy_Shared_Test} from
    "tests/fork/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_Rewards_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_earnRewards() public {
        _depositTokenAmount(15_000 ether, false);

        uint256 balanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        _advanceSfcEpoch(1);

        assertGt(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)),
            balanceBefore,
            "Balance did not increase after epoch"
        );
    }

    function test_restakeRewards() public {
        _depositTokenAmount(15_000 ether, false);
        _advanceSfcEpoch(1);

        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        uint256 stratBalanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        uint256 stakeBefore = sfc.getStake(address(sonicStakingStrategy), defaultValidatorId);

        sonicStakingStrategy.restakeRewards(testValidatorIds);

        assertGt(
            sfc.getStake(address(sonicStakingStrategy), defaultValidatorId),
            stakeBefore,
            "No rewards restaked"
        );
        assertEq(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)),
            stratBalanceBefore,
            "Strategy balance changed after restake"
        );
    }

    function test_collectRewards() public {
        _depositTokenAmount(15_000 ether, false);
        _advanceSfcEpoch(1);

        uint256 stratBalanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(validatorRegistrator);
        sonicStakingStrategy.collectRewards(testValidatorIds);

        assertLt(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)),
            stratBalanceBefore,
            "Strategy balance hasn't decreased"
        );
        assertGt(
            IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault)),
            vaultBalanceBefore,
            "Vault wS hasn't increased"
        );
    }
}
