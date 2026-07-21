// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// Test utilities
import {HyperEVM} from "tests/utils/Addresses.sol";

// Project imports
import {ITimelockController} from "contracts/interfaces/ITimelockController.sol";
import {ICrossChainRemoteStrategy} from "contracts/interfaces/strategies/ICrossChainRemoteStrategy.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";

abstract contract Fork_HyperEVMTimelockController_Shared_Test is BaseFork {
    using GovHelper for GovProposal;

    ICrossChainRemoteStrategy internal crossChainRemoteStrategy;
    ITimelockController internal timelock;
    GovProposal internal govProposal;
    address internal newHarvester;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkHyperEVM();

        crossChainRemoteStrategy = ICrossChainRemoteStrategy(HyperEVM.CrossChainRemoteStrategy);
        timelock = ITimelockController(HyperEVM.timelock);
        newHarvester =
            crossChainRemoteStrategy.harvesterAddress() == HyperEVM.admin ? makeAddr("New Harvester") : HyperEVM.admin;

        govProposal.setDescription("Test HyperEVM TimelockController harvester update");
        govProposal.action(address(crossChainRemoteStrategy), "setHarvesterAddress(address)", abi.encode(newHarvester));

        vm.label(address(crossChainRemoteStrategy), "CrossChainRemoteStrategy");
        vm.label(address(timelock), "HyperEVM TimelockController");
        vm.label(HyperEVM.admin, "HyperEVM Admin");
        vm.label(newHarvester, "New Harvester");
    }
}
