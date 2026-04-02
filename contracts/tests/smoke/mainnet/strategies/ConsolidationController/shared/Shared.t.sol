// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {IConsolidationController} from "contracts/interfaces/strategies/IConsolidationController.sol";
import {INativeStakingSSVStrategy} from "contracts/interfaces/strategies/INativeStakingSSVStrategy.sol";
import {ICompoundingStakingSSVStrategy} from "contracts/interfaces/strategies/ICompoundingStakingSSVStrategy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_ConsolidationController_Shared_Test is BaseSmoke {
    IConsolidationController internal consolidationController;
    INativeStakingSSVStrategy internal nativeStakingSSVStrategy2;
    INativeStakingSSVStrategy internal nativeStakingSSVStrategy3;
    ICompoundingStakingSSVStrategy internal compoundingStakingSSVStrategy;
    IOToken internal oeth;
    IVault internal oethVault;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        consolidationController = IConsolidationController(resolver.resolve("CONSOLIDATION_CONTROLLER"));
        nativeStakingSSVStrategy2 =
            INativeStakingSSVStrategy(payable(resolver.resolve("NATIVE_STAKING_SSV_STRATEGY_2_PROXY")));
        nativeStakingSSVStrategy3 =
            INativeStakingSSVStrategy(payable(resolver.resolve("NATIVE_STAKING_SSV_STRATEGY_3_PROXY")));
        compoundingStakingSSVStrategy =
            ICompoundingStakingSSVStrategy(payable(resolver.resolve("COMPOUNDING_STAKING_SSV_STRATEGY_PROXY")));
        oeth = IOToken(resolver.resolve("OETH_PROXY"));
        oethVault = IVault(resolver.resolve("OETH_VAULT_PROXY"));
    }

    function _resolveActors() internal {
        governor = consolidationController.owner();
        strategist = oethVault.strategistAddr();
    }

    function _labelContracts() internal {
        vm.label(address(consolidationController), "ConsolidationController");
        vm.label(address(nativeStakingSSVStrategy2), "NativeStakingSSVStrategy2");
        vm.label(address(nativeStakingSSVStrategy3), "NativeStakingSSVStrategy3");
        vm.label(address(compoundingStakingSSVStrategy), "CompoundingStakingSSVStrategy");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
    }
}
