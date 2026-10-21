// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseFeeBridgeModule_Shared_Test} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseFeeBridgeModule_ClearPendingRequest_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    uint256 internal constant AMOUNT = 2 ether;

    event PendingRequestCleared(uint256 indexed requestId);

    function setUp() public override {
        super.setUp();
        _request(AMOUNT);
    }

    function test_clearPendingRequest_clearsState() public {
        vm.expectEmit(address(module));
        emit PendingRequestCleared(0);

        vm.prank(address(mockSafe));
        module.clearPendingRequest();

        assertFalse(module.hasPendingRequest());
    }

    function test_clearPendingRequest_recoversAfterDirectClaim() public {
        skip(CLAIM_DELAY);
        vm.prank(address(mockSafe));
        vault.claimWithdrawal(0);

        vm.prank(address(mockSafe));
        module.clearPendingRequest();

        _request(AMOUNT);
        assertEq(module.pendingRequestId(), 1);
    }

    function test_clearPendingRequest_revertsForOperator() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.clearPendingRequest();
    }

    function test_clearPendingRequest_revertsWithoutPendingRequest() public {
        vm.prank(address(mockSafe));
        module.clearPendingRequest();

        vm.prank(address(mockSafe));
        vm.expectRevert("No pending request");
        module.clearPendingRequest();
    }
}
