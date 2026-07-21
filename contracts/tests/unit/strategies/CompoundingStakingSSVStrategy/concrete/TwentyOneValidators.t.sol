// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CompoundingStakingSSVStrategy_TwentyOneValidators_Shared_Test
} from "../shared/TwentyOneValidatorsShared.t.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_TwentyOneValidators_Test is
    Unit_CompoundingStakingSSVStrategy_TwentyOneValidators_Shared_Test
{
    function test_verifyBalances_21ValidatorsNoPendingDeposits() public {
        _assertHistoricalBalances(0);

        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 16);
        assertFalse(_containsVerifiedValidator(testValidators[3].publicKeyHash));
        assertFalse(_containsVerifiedValidator(testValidators[11].publicKeyHash));
        assertFalse(_containsVerifiedValidator(testValidators[12].publicKeyHash));
        assertFalse(_containsVerifiedValidator(testValidators[13].publicKeyHash));
        assertFalse(_containsVerifiedValidator(testValidators[14].publicKeyHash));
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 0.345 ether + _validatorTotal());
    }

    function test_verifyBalances_zeroBalanceValidatorWithTwoPendingDeposits() public {
        this.topUpHistoricalValidator(3, 1 ether / 1 gwei);
        this.topUpHistoricalValidator(3, 2 ether / 1 gwei);

        _assertHistoricalBalances(3 ether);

        assertEq(compoundingStakingSSVStrategy.depositListLength(), 2);
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 17);
        assertTrue(_containsVerifiedValidator(testValidators[3].publicKeyHash));
    }

    function test_verifyBalances_mixedPendingDeposits() public {
        this.topUpHistoricalValidator(0, 2 ether / 1 gwei);
        this.topUpHistoricalValidator(0, 3 ether / 1 gwei);
        this.topUpHistoricalValidator(1, 4 ether / 1 gwei);
        this.topUpHistoricalValidator(3, 5 ether / 1 gwei);
        this.topUpHistoricalValidator(3, 6 ether / 1 gwei);

        _assertHistoricalBalances(20 ether);

        assertEq(compoundingStakingSSVStrategy.depositListLength(), 5);
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 17);
        assertTrue(_containsVerifiedValidator(testValidators[0].publicKeyHash));
        assertTrue(_containsVerifiedValidator(testValidators[1].publicKeyHash));
        assertTrue(_containsVerifiedValidator(testValidators[3].publicKeyHash));
    }

    function _validatorTotal() internal view returns (uint256 total) {
        HistoricalSnapshot memory snapshot = _loadHistoricalSnapshot();
        for (uint256 i = 0; i < snapshot.validatorBalances.length; ++i) {
            total += _parseDecimal(snapshot.validatorBalances[i], 18);
        }
    }
}
