// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Project imports
import {ICrossChainRemoteStrategy} from "contracts/interfaces/strategies/ICrossChainRemoteStrategy.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_Deposit_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT
    //////////////////////////////////////////////////////

    function test_deposit_depositsToERC4626Vault() public {
        uint256 amount = 1000e6;
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);

        // Shares should be minted in the 4626 vault
        assertGt(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
        // USDC should have moved to the 4626 vault
        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 0);
        assertEq(mockUsdc.balanceOf(address(mockERC4626Vault)), amount);
    }

    function test_deposit_emitsDepositEvent() public {
        uint256 amount = 500e6;
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.expectEmit(true, true, true, true);
        emit ICrossChainRemoteStrategy.Deposit(address(mockUsdc), address(mockERC4626Vault), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);
    }

    function test_deposit_asStrategist() public {
        uint256 amount = 100e6;
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.prank(strategist);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);

        assertGt(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
    }

    function test_deposit_RevertWhen_calledByNonGovernorOrStrategist() public {
        _mintUsdc(address(crossChainRemoteStrategy), 100e6);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        crossChainRemoteStrategy.deposit(address(mockUsdc), 100e6);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(governor);
        vm.expectRevert("Unexpected asset address");
        crossChainRemoteStrategy.deposit(address(0xdead), 100e6);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(governor);
        vm.expectRevert("Must deposit something");
        crossChainRemoteStrategy.deposit(address(mockUsdc), 0);
    }
}
