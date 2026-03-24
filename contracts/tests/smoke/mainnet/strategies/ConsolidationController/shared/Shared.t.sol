// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {ConsolidationController} from "contracts/strategies/NativeStaking/ConsolidationController.sol";
import {NativeStakingSSVStrategy} from "contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol";
import {CompoundingStakingSSVStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";

abstract contract Smoke_ConsolidationController_Shared_Test is BaseSmoke {
    ConsolidationController internal consolidationController;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy2;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy3;
    CompoundingStakingSSVStrategy internal compoundingStakingSSVStrategy;
    OETH internal oeth;
    OETHVault internal oethVault;

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

        consolidationController = ConsolidationController(resolver.resolve("CONSOLIDATION_CONTROLLER"));
        nativeStakingSSVStrategy2 =
            NativeStakingSSVStrategy(payable(resolver.resolve("NATIVE_STAKING_SSV_STRATEGY_2_PROXY")));
        nativeStakingSSVStrategy3 =
            NativeStakingSSVStrategy(payable(resolver.resolve("NATIVE_STAKING_SSV_STRATEGY_3_PROXY")));
        compoundingStakingSSVStrategy =
            CompoundingStakingSSVStrategy(payable(resolver.resolve("COMPOUNDING_STAKING_SSV_STRATEGY_PROXY")));
        oeth = OETH(resolver.resolve("OETH_PROXY"));
        oethVault = OETHVault(payable(resolver.resolve("OETH_VAULT_PROXY")));
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
