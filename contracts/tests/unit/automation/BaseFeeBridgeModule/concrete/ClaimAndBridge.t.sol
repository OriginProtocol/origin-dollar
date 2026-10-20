// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseFeeBridgeModule_Shared_Test} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseFeeBridgeModule_ClaimAndBridge_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    uint256 internal constant AMOUNT = 2 ether;

    event FeesBridged(uint256 indexed requestId, uint256 wethAmount, uint256 ccipFee);

    function setUp() public override {
        super.setUp();
        _request(AMOUNT);
        skip(CLAIM_DELAY);
    }

    //////////////////////////////////////////////////////
    /// --- HAPPY PATH
    //////////////////////////////////////////////////////

    function test_claimAndBridge_claimsAndBridgesWeth() public {
        vm.prank(operator);
        module.claimAndBridge();

        assertEq(mockWeth.balanceOf(address(mockSafe)), 0, "WETH left on Safe");
        assertEq(mockWeth.balanceOf(address(router)), AMOUNT, "WETH not sent to router");
        assertEq(router.sentMessagesLength(), 1);
        assertTrue(vault.withdrawalRequests(0).claimed);
    }

    function test_claimAndBridge_clearsPendingRequest() public {
        vm.prank(operator);
        module.claimAndBridge();

        assertFalse(module.hasPendingRequest());
    }

    function test_claimAndBridge_allowsNextRequest() public {
        vm.prank(operator);
        module.claimAndBridge();

        _request(AMOUNT);

        assertTrue(module.hasPendingRequest());
        assertEq(module.pendingRequestId(), 1);
    }

    function test_claimAndBridge_sendsToFeeSplitterOnDestination() public {
        vm.expectEmit(address(router));
        emit MockCcipSend(DEST_SELECTOR, abi.encode(feeSplitter), address(mockWeth), AMOUNT, CCIP_FEE);

        vm.prank(operator);
        module.claimAndBridge();
    }

    function test_claimAndBridge_safePaysCcipFee() public {
        uint256 ethBefore = address(mockSafe).balance;

        vm.prank(operator);
        module.claimAndBridge();

        assertEq(ethBefore - address(mockSafe).balance, CCIP_FEE);
        assertEq(address(router).balance, CCIP_FEE);
    }

    function test_claimAndBridge_bridgesOnlyClaimedWeth() public {
        uint256 existing = 5 ether;
        mockWeth.mint(address(mockSafe), existing);

        vm.prank(operator);
        module.claimAndBridge();

        assertEq(mockWeth.balanceOf(address(mockSafe)), existing, "Pre-existing WETH was bridged");
        assertEq(mockWeth.balanceOf(address(router)), AMOUNT);
    }

    function test_claimAndBridge_emitsFeesBridged() public {
        vm.expectEmit(address(module));
        emit FeesBridged(0, AMOUNT, CCIP_FEE);

        vm.prank(operator);
        module.claimAndBridge();
    }

    function test_bridgeFee_returnsRouterFee() public view {
        assertEq(module.bridgeFee(AMOUNT), CCIP_FEE);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTS
    //////////////////////////////////////////////////////

    function test_claimAndBridge_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.claimAndBridge();
    }

    function test_claimAndBridge_revertsWithoutPendingRequest() public {
        vm.prank(operator);
        module.claimAndBridge();

        vm.prank(operator);
        vm.expectRevert("No pending request");
        module.claimAndBridge();
    }

    function test_claimAndBridge_revertsBeforeClaimDelay() public {
        vm.prank(operator);
        module.claimAndBridge();
        _request(AMOUNT);
        skip(CLAIM_DELAY - 1);

        vm.prank(operator);
        vm.expectRevert("Withdrawal claim failed");
        module.claimAndBridge();
        assertTrue(module.hasPendingRequest(), "Pending state lost on revert");
    }

    function test_claimAndBridge_revertsWithoutQueueLiquidity() public {
        // Drain the vault's asset so the queue cannot be funded.
        vm.prank(address(vault));
        mockWeth.transfer(alice, VAULT_LIQUIDITY);

        vm.prank(operator);
        vm.expectRevert("Withdrawal claim failed");
        module.claimAndBridge();
    }

    function test_claimAndBridge_revertsWhenAlreadyClaimedOnVault() public {
        // A Safe owner claims directly on the vault, bypassing the module.
        vm.prank(address(mockSafe));
        vault.claimWithdrawal(0);

        vm.prank(operator);
        vm.expectRevert("Withdrawal claim failed");
        module.claimAndBridge();
    }

    function test_claimAndBridge_revertsWhenSafeCannotPayCcipFee() public {
        vm.deal(address(mockSafe), CCIP_FEE - 1);

        vm.prank(operator);
        vm.expectRevert("Failed to send CCIP message");
        module.claimAndBridge();
    }
}
