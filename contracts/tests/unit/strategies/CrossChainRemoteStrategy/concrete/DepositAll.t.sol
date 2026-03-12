// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_DepositAll_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSITALL
    //////////////////////////////////////////////////////

    function test_depositAll_depositsEntireBalance() public {
        uint256 amount = 2000e6;
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.depositAll();

        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 0);
        assertGt(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
    }

    function test_depositAll_asStrategist() public {
        _mintUsdc(address(crossChainRemoteStrategy), 500e6);

        vm.prank(strategist);
        crossChainRemoteStrategy.depositAll();

        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 0);
    }

    function test_depositAll_RevertWhen_calledByNonGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        crossChainRemoteStrategy.depositAll();
    }

    function test_depositAll_RevertWhen_zeroBalance() public {
        // depositAll calls _deposit with balance=0, which reverts with "Must deposit something"
        vm.prank(governor);
        vm.expectRevert("Must deposit something");
        crossChainRemoteStrategy.depositAll();
    }
}
