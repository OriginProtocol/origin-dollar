// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseFeeBridgeModule_Shared_Test} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

// --- Project imports
import {MockAsyncWithdrawalVault} from "tests/mocks/MockAsyncWithdrawalVault.sol";

contract Unit_Concrete_BaseFeeBridgeModule_RequestWithdrawal_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    uint256 internal constant AMOUNT = 2 ether;

    event WithdrawalRequested(uint256 indexed requestId, uint256 oethbAmount);

    function test_requestWithdrawal_burnsOethbAndOpensRequest() public {
        _request(AMOUNT);

        assertEq(oethb.balanceOf(address(mockSafe)), 0, "OETHb not burned");
        MockAsyncWithdrawalVault.WithdrawalRequest memory request = vault.withdrawalRequests(0);
        assertEq(request.withdrawer, address(mockSafe));
        assertEq(request.amount, AMOUNT);
    }

    function test_requestWithdrawal_storesPendingState() public {
        _request(AMOUNT);

        assertTrue(module.hasPendingRequest());
        assertEq(module.pendingRequestId(), 0);
        assertEq(module.lastRequestAt(), block.timestamp);
    }

    function test_requestWithdrawal_tracksVaultRequestId() public {
        // Someone else's request moves the vault's index; the module must pick up the next one.
        oethb.mint(alice, 1 ether);
        vm.prank(alice);
        vault.requestWithdrawal(1 ether);

        _request(AMOUNT);

        assertEq(module.pendingRequestId(), 1);
        assertEq(vault.withdrawalRequests(1).withdrawer, address(mockSafe));
    }

    function test_requestWithdrawal_emitsEvent() public {
        oethb.mint(address(mockSafe), AMOUNT);

        vm.expectEmit(address(module));
        emit WithdrawalRequested(0, AMOUNT);

        vm.prank(operator);
        module.requestWithdrawal(AMOUNT);
    }

    function test_requestWithdrawal_revertsWhenRequestPending() public {
        _request(AMOUNT);
        oethb.mint(address(mockSafe), AMOUNT);

        vm.prank(operator);
        vm.expectRevert("Request pending");
        module.requestWithdrawal(AMOUNT);
    }

    function test_requestWithdrawal_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.requestWithdrawal(AMOUNT);
    }

    function test_requestWithdrawal_revertsOnZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert("Invalid amount");
        module.requestWithdrawal(0);
    }

    function test_requestWithdrawal_revertsWhenSafeLacksOethb() public {
        oethb.mint(address(mockSafe), AMOUNT - 1);

        vm.prank(operator);
        vm.expectRevert("Withdrawal request failed");
        module.requestWithdrawal(AMOUNT);
    }

    function test_requestWithdrawal_revertsWhenSafeCallFails() public {
        oethb.mint(address(mockSafe), AMOUNT);
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("Withdrawal request failed");
        module.requestWithdrawal(AMOUNT);
    }
}
