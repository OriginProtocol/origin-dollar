// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_Accounting_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    // fuseStart 21.6 ether
    // fuseEnd 25.6 ether

    struct AccountingTestCase {
        uint256 ethBalance;
        uint256 previousConsensusRewards;
        uint256 expectedConsensusRewards;
        uint256 expectedValidatorsFullWithdrawals;
        bool slashDetected;
        bool fuseBlown;
    }

    function _runAccountingTest(AccountingTestCase memory tc) internal {
        // Setup state
        if (tc.ethBalance > 0) {
            vm.deal(address(nativeStakingSSVStrategy), tc.ethBalance);
        }
        _setActiveDepositedValidators(30);
        _setConsensusRewards(tc.previousConsensusRewards);

        // Run accounting
        vm.prank(governor);

        // Events must be expected in emission order:
        // 1. AccountingFullyWithdrawnValidator (if withdrawals)
        // 2. AccountingConsensusRewards OR AccountingValidatorSlashed OR Paused (fuse blown)
        if (tc.expectedValidatorsFullWithdrawals > 0) {
            uint256 ethWithdrawnToVault = 32 ether * tc.expectedValidatorsFullWithdrawals;
            vm.expectEmit(true, true, true, true);
            emit AccountingFullyWithdrawnValidator(
                tc.expectedValidatorsFullWithdrawals,
                30 - tc.expectedValidatorsFullWithdrawals,
                ethWithdrawnToVault
            );
        }

        if (tc.expectedConsensusRewards > 0) {
            vm.expectEmit(true, false, false, true);
            emit AccountingConsensusRewards(tc.expectedConsensusRewards);
        }

        if (tc.slashDetected) {
            vm.expectEmit(false, false, false, false);
            emit AccountingValidatorSlashed(0, 0);
        }

        if (tc.fuseBlown) {
            vm.expectEmit(false, false, false, false);
            emit Paused(address(0));
        }

        nativeStakingSSVStrategy.doAccounting();
    }

    // no new rewards
    function test_doAccounting_noNewRewards() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 0,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // no new rewards on previous rewards
    function test_doAccounting_noNewRewardsOnPrevious() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 0.001 ether,
                previousConsensusRewards: 0.001 ether,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // invalid eth balance (balance < consensusRewards)
    function test_doAccounting_invalidEthBalance_fuseBlown() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 1.9 ether,
                previousConsensusRewards: 2 ether,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // tiny consensus rewards
    function test_doAccounting_tinyConsensusRewards() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 0.001 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0.001 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // tiny consensus rewards on small previous
    function test_doAccounting_tinyRewardsOnSmallPrevious() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 0.03 ether,
                previousConsensusRewards: 0.02 ether,
                expectedConsensusRewards: 0.01 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // tiny consensus rewards on large previous
    function test_doAccounting_tinyRewardsOnLargePrevious() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 5.04 ether,
                previousConsensusRewards: 5 ether,
                expectedConsensusRewards: 0.04 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // large consensus rewards
    function test_doAccounting_largeConsensusRewards() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 14 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 14 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // just under fuse start
    function test_doAccounting_justUnderFuseStart() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 21.5 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 21.5 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // exactly fuse start
    function test_doAccounting_exactlyFuseStart_fuseBlown() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 21.6 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // fuse blown in interval
    function test_doAccounting_fuseBlownInInterval() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 22 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // just under fuse end
    function test_doAccounting_justUnderFuseEnd_fuseBlown() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 25.5 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // exactly fuse end
    function test_doAccounting_exactlyFuseEnd_fuseBlown() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 25.6 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // just over fuse end - slash detected
    function test_doAccounting_justOverFuseEnd_slashDetected() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 25.7 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: true,
                fuseBlown: false
            })
        );
    }

    // 1 validator slashed
    function test_doAccounting_validatorSlashed() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 26.6 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: true,
                fuseBlown: false
            })
        );
    }

    // no consensus rewards, 1 slashed validator at 31.9 ETH
    function test_doAccounting_slashedValidatorAt31_9() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 31.9 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: true,
                fuseBlown: false
            })
        );
    }

    // 1 validator fully withdrawn
    function test_doAccounting_oneFullWithdrawal() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 32 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // tiny consensus rewards + 1 withdrawn
    function test_doAccounting_tinyRewardsPlusOneWithdrawal() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 32.01 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0.01 ether,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // consensus rewards on previous rewards > 32
    function test_doAccounting_consensusOnPreviousOver32() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 33 ether,
                previousConsensusRewards: 32.3 ether,
                expectedConsensusRewards: 0.7 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // large consensus rewards + 1 withdrawn
    function test_doAccounting_largeRewardsPlusOneWithdrawal() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 34 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 2 ether,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // large consensus rewards on large previous
    function test_doAccounting_largeRewardsOnLargePrevious() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 44 ether,
                previousConsensusRewards: 24 ether,
                expectedConsensusRewards: 20 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // fuse blown + 1 withdrawn validator
    function test_doAccounting_fuseBlownPlusOneWithdrawal() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 54 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // fuse blown + 1 withdrawn with previous rewards
    function test_doAccounting_fuseBlownPlusOneWithdrawalPreviousRewards() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 55 ether,
                previousConsensusRewards: 1 ether,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: false,
                fuseBlown: true
            })
        );
    }

    // 1 validator fully withdrawn + 1 slashed
    function test_doAccounting_oneWithdrawPlusOneSlash() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 58.6 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: true,
                fuseBlown: false
            })
        );
    }

    // 2 full withdraws
    function test_doAccounting_twoFullWithdrawals() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 64 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 2,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // tiny consensus rewards + 2 withdrawn
    function test_doAccounting_tinyRewardsPlusTwoWithdrawals() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 64.1 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 0.1 ether,
                expectedValidatorsFullWithdrawals: 2,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // 2 full withdraws on previous rewards
    function test_doAccounting_twoWithdrawsOnPreviousRewards() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 66 ether,
                previousConsensusRewards: 2 ether,
                expectedConsensusRewards: 0,
                expectedValidatorsFullWithdrawals: 2,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // consensus rewards on large previous rewards
    function test_doAccounting_consensusOnLargePrevious() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 66 ether,
                previousConsensusRewards: 65 ether,
                expectedConsensusRewards: 1 ether,
                expectedValidatorsFullWithdrawals: 0,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // consensus rewards on large previous with withdraw
    function test_doAccounting_consensusOnLargePreviousWithWithdraw() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 100 ether,
                previousConsensusRewards: 65 ether,
                expectedConsensusRewards: 3 ether,
                expectedValidatorsFullWithdrawals: 1,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // 8 withdrawn validators + consensus rewards
    function test_doAccounting_eightWithdrawalsPlusRewards() public {
        _runAccountingTest(
            AccountingTestCase({
                ethBalance: 276 ether,
                previousConsensusRewards: 0,
                expectedConsensusRewards: 20 ether,
                expectedValidatorsFullWithdrawals: 8,
                slashDetected: false,
                fuseBlown: false
            })
        );
    }

    // ----------------
    // Events
    // ----------------

    event Paused(address account);
    event AccountingFullyWithdrawnValidator(uint256 noOfValidators, uint256 remainingValidators, uint256 wethSentToVault);
    event AccountingConsensusRewards(uint256 amount);
    event AccountingValidatorSlashed(uint256 remainingValidators, uint256 wethSentToVault);
}
