// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";

contract Unit_Concrete_CrossChainMasterStrategy_Deposit_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT
    //////////////////////////////////////////////////////

    function test_deposit_sendsTokensViaCCTP() public {
        uint256 amount = 1000e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        uint256 transmitterBalBefore = mockUsdc.balanceOf(address(cctpMessageTransmitterMock));

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        // Tokens should have left the strategy (sent to CCTP mocks)
        assertEq(mockUsdc.balanceOf(address(crossChainMasterStrategy)), 0);
        // Transmitter mock receives the tokens (minus fee which is 0)
        assertGt(
            mockUsdc.balanceOf(address(cctpMessageTransmitterMock))
                + mockUsdc.balanceOf(address(cctpTokenMessengerMock)),
            transmitterBalBefore
        );
    }

    function test_deposit_setsPendingAmount() public {
        uint256 amount = 500e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        assertEq(crossChainMasterStrategy.pendingAmount(), 0);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        assertEq(crossChainMasterStrategy.pendingAmount(), amount);
    }

    function test_deposit_incrementsNonce() public {
        uint256 amount = 1e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        uint64 nonceBefore = crossChainMasterStrategy.lastTransferNonce();

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        assertEq(crossChainMasterStrategy.lastTransferNonce(), nonceBefore + 1);
    }

    function test_deposit_emitsDepositEvent() public {
        uint256 amount = 100e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.Deposit(address(mockUsdc), address(mockUsdc), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        uint256 amount = 100e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Unsupported asset");
        crossChainMasterStrategy.deposit(address(0xdead), 100e6);
    }

    function test_deposit_RevertWhen_pendingTransfer() public {
        // First deposit
        _mintUsdc(address(crossChainMasterStrategy), 100e6);
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), 100e6);

        // Second deposit should revert (pendingAmount != 0)
        _mintUsdc(address(crossChainMasterStrategy), 100e6);
        vm.prank(address(ousdVault));
        vm.expectRevert("Unexpected pending amount");
        crossChainMasterStrategy.deposit(address(mockUsdc), 100e6);
    }

    function test_deposit_RevertWhen_amountTooSmall() public {
        uint256 amount = 1e6 - 1; // Less than MIN_TRANSFER_AMOUNT
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        vm.expectRevert("Deposit amount too small");
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);
    }

    function test_deposit_RevertWhen_amountTooHigh() public {
        uint256 amount = 10_000_001e6; // More than MAX_TRANSFER_AMOUNT
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        vm.expectRevert("Deposit amount too high");
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);
    }

    function test_deposit_RevertWhen_pendingAmountNotZero() public {
        // Create a pending state via a deposit
        _mintUsdc(address(crossChainMasterStrategy), 100e6);
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), 100e6);

        // pendingAmount != 0 check fires before nonce check
        _mintUsdc(address(crossChainMasterStrategy), 100e6);
        vm.prank(address(ousdVault));
        vm.expectRevert("Unexpected pending amount");
        crossChainMasterStrategy.deposit(address(mockUsdc), 100e6);
    }

    function test_deposit_withFeePremium() public {
        // Set fee premium to 100 bps (1%)
        vm.prank(governor);
        crossChainMasterStrategy.setFeePremiumBps(100);

        uint256 amount = 1000e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        // Fee = 1000e6 * 100 / 10000 = 10e6
        // Strategy should have no USDC left
        assertEq(mockUsdc.balanceOf(address(crossChainMasterStrategy)), 0);
        assertEq(crossChainMasterStrategy.pendingAmount(), amount);
    }
}
