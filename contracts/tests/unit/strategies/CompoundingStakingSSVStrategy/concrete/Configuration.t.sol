// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_Configuration_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function test_setRegistrator() public {
        vm.prank(governor);
        vm.expectEmit(true, false, false, false);
        emit RegistratorChanged(strategist);
        compoundingStakingSSVStrategy.setRegistrator(strategist);

        assertEq(compoundingStakingSSVStrategy.validatorRegistrator(), strategist);
    }

    function test_setRegistrator_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        compoundingStakingSSVStrategy.setRegistrator(strategist);
    }

    function test_supportsAsset_weth() public view {
        assertTrue(compoundingStakingSSVStrategy.supportsAsset(address(mockWeth)));
    }

    function test_supportsAsset_notWeth() public view {
        assertFalse(compoundingStakingSSVStrategy.supportsAsset(address(mockSsv)));
    }

    function test_migrateClusterToETH_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        compoundingStakingSSVStrategy.migrateClusterToETH(_operatorIds(), _emptyCluster());
    }

    function test_migrateClusterToETH_onlyGovernor() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.migrateClusterToETH(_operatorIds(), _emptyCluster());
    }

    function test_resetFirstDeposit_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        compoundingStakingSSVStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit_RevertWhen_noFirstDeposit() public {
        vm.prank(governor);
        vm.expectRevert("No first deposit");
        compoundingStakingSSVStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit() public {
        // Register and stake to set firstDeposit = true
        _registerAndStake(0);
        assertTrue(compoundingStakingSSVStrategy.firstDeposit());

        vm.prank(governor);
        vm.expectEmit(false, false, false, false);
        emit FirstDepositReset();
        compoundingStakingSSVStrategy.resetFirstDeposit();

        assertFalse(compoundingStakingSSVStrategy.firstDeposit());
    }

    function test_pause_byGovernor() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();
        assertTrue(compoundingStakingSSVStrategy.paused());
    }

    function test_pause_byRegistrator() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();
        vm.prank(governor);
        compoundingStakingSSVStrategy.unPause();

        // Change registrator then pause
        vm.prank(governor);
        compoundingStakingSSVStrategy.setRegistrator(matt);
        vm.prank(matt);
        compoundingStakingSSVStrategy.pause();
        assertTrue(compoundingStakingSSVStrategy.paused());
    }

    function test_pause_RevertWhen_notRegistratorOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Not Registrator or Governor");
        compoundingStakingSSVStrategy.pause();
    }

    function test_unPause_onlyGovernor() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();

        vm.prank(governor);
        compoundingStakingSSVStrategy.unPause();
        assertFalse(compoundingStakingSSVStrategy.paused());
    }

    function test_safeApproveAllTokens_isNoOp() public {
        // safeApproveAllTokens is now a no-op in CompoundingStakingSSVStrategy
        compoundingStakingSSVStrategy.safeApproveAllTokens();
    }

    // ----------------
    // Events
    // ----------------

    event RegistratorChanged(address indexed newAddress);
    event FirstDepositReset();
}
