// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// Test utilities
import {Base} from "tests/utils/Addresses.sol";

// Project imports
import {ITimelockController} from "contracts/interfaces/ITimelockController.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";

abstract contract Fork_BaseTimelockController_Shared_Test is BaseFork {
    using GovHelper for GovProposal;

    IVault internal oethBaseVault;
    ITimelockController internal timelock;
    GovProposal internal govProposal;
    uint256 internal newVaultBuffer;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();

        oethBaseVault = IVault(Base.OETHBaseVaultProxy);
        timelock = ITimelockController(Base.timelock);
        newVaultBuffer = oethBaseVault.vaultBuffer() == 0.1e18 ? 0.2e18 : 0.1e18;

        govProposal.setDescription("Test Base TimelockController vault buffer update");
        govProposal.action(address(oethBaseVault), "setVaultBuffer(uint256)", abi.encode(newVaultBuffer));

        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(address(timelock), "Base TimelockController");
        vm.label(Base.governor, "Base Governor");
    }

    function _scheduleProposal() internal {
        bytes memory scheduleData = GovHelper.getScheduleCalldata(govProposal, timelock.getMinDelay());
        vm.prank(Base.governor);
        (bool success,) = address(timelock).call(scheduleData);
        require(success, "Failed to schedule test proposal");
    }
}
