// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_WithdrawAll_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAWALL
    //////////////////////////////////////////////////////

    function test_withdrawAll_withdrawsAllShares() public {
        uint256 amount = 3000e6;
        _depositAsGovernor(amount);

        assertGt(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);

        vm.prank(governor);
        crossChainRemoteStrategy.withdrawAll();

        // All shares redeemed, USDC back on contract
        assertEq(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), amount);
    }

    function test_withdrawAll_asStrategist() public {
        _depositAsGovernor(1000e6);

        vm.prank(strategist);
        crossChainRemoteStrategy.withdrawAll();

        assertEq(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
    }

    function test_withdrawAll_RevertWhen_calledByNonGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        crossChainRemoteStrategy.withdrawAll();
    }

    function test_withdrawAll_noOp_whenNoShares() public {
        // No deposit — withdrawAll silently returns (amountToWithdraw == 0)
        vm.prank(governor);
        crossChainRemoteStrategy.withdrawAll();

        assertEq(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
    }
}
