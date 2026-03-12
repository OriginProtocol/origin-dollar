// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_CrossChainMasterStrategy_DepositAll_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSITALL
    //////////////////////////////////////////////////////

    function test_depositAll_depositsFullBalance() public {
        uint256 amount = 5000e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.depositAll();

        assertEq(mockUsdc.balanceOf(address(crossChainMasterStrategy)), 0);
        assertEq(crossChainMasterStrategy.pendingAmount(), amount);
    }

    function test_depositAll_skipsWhenBalanceBelowMin() public {
        uint256 amount = 1e6 - 1; // Below MIN_TRANSFER_AMOUNT
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.depositAll();

        // Balance unchanged, no deposit happened
        assertEq(mockUsdc.balanceOf(address(crossChainMasterStrategy)), amount);
        assertEq(crossChainMasterStrategy.pendingAmount(), 0);
    }

    function test_depositAll_depositsExactlyMinAmount() public {
        uint256 amount = 1e6; // Exactly MIN_TRANSFER_AMOUNT
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.depositAll();

        assertEq(mockUsdc.balanceOf(address(crossChainMasterStrategy)), 0);
        assertEq(crossChainMasterStrategy.pendingAmount(), amount);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        crossChainMasterStrategy.depositAll();
    }
}
