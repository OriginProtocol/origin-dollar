// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {ICrossChainRemoteStrategy} from "contracts/interfaces/strategies/ICrossChainRemoteStrategy.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_Withdraw_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAW
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        // Pre-deposit so there's something to withdraw
        _depositAsGovernor(5000e6);
    }

    function test_withdraw_withdrawsFromERC4626Vault() public {
        uint256 amount = 1000e6;

        uint256 usdcBefore = mockUsdc.balanceOf(address(crossChainRemoteStrategy));

        vm.prank(governor);
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), amount);

        uint256 usdcAfter = mockUsdc.balanceOf(address(crossChainRemoteStrategy));
        assertEq(usdcAfter - usdcBefore, amount);
    }

    function test_withdraw_emitsWithdrawalEvent() public {
        uint256 amount = 500e6;

        vm.expectEmit(true, true, true, true);
        emit ICrossChainRemoteStrategy.Withdrawal(address(mockUsdc), address(mockERC4626Vault), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), amount);
    }

    function test_withdraw_asStrategist() public {
        vm.prank(strategist);
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), 100e6);

        assertGt(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 0);
    }

    function test_withdraw_RevertWhen_calledByNonGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), 100e6);
    }

    function test_withdraw_RevertWhen_recipientNotSelf() public {
        vm.prank(governor);
        vm.expectRevert("Invalid recipient");
        crossChainRemoteStrategy.withdraw(alice, address(mockUsdc), 100e6);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(governor);
        vm.expectRevert("Unexpected asset address");
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(0xdead), 100e6);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(governor);
        vm.expectRevert("Must withdraw something");
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), 0);
    }
}
