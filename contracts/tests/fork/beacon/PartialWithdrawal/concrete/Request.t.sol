// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_PartialWithdrawal_Shared_Test} from "../shared/Shared.t.sol";

contract Fork_Concrete_PartialWithdrawal_Request_Test is Fork_PartialWithdrawal_Shared_Test {
    function test_fee() public view {
        uint256 fee = partialWithdrawal.fee();

        assertGt(fee, 0, "fee should be positive");
        assertLt(fee, 10, "fee should stay below 10");
    }

    function test_request() public {
        partialWithdrawal.request(SWEEPING_VALIDATOR_PUBKEY, WITHDRAW_AMOUNT);

        assertEq(beaconWithdrawalReplaced.lastPublicKey(), SWEEPING_VALIDATOR_PUBKEY, "wrong validator pubkey");
        assertEq(beaconWithdrawalReplaced.lastAmount(), WITHDRAW_AMOUNT, "wrong withdrawal amount");
    }
}
