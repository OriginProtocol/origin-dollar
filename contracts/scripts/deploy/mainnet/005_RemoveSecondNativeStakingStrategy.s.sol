// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {IVault} from "contracts/interfaces/IVault.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {CompoundingStakingStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingStrategy.sol";
import {VaultStorage} from "contracts/vault/VaultStorage.sol";
import {CrossChain} from "tests/utils/Addresses.sol";

/// @title 005_RemoveSecondNativeStakingStrategy
/// @notice Completes the migration from the second Native Staking Strategy to the
///         new Compounding Staking Strategy.
contract $005_RemoveSecondNativeStakingStrategy is AbstractDeployScript("005_RemoveSecondNativeStakingStrategy") {
    using GovHelper for GovProposal;

    // SSV cluster state for NativeStakingSSVStrategy2 at block 25,724,239.
    // TODO Change to 0 after all the validators have been removed from the cluster
    uint32 internal constant VALIDATOR_COUNT = 104;
    uint64 internal constant NETWORK_FEE_INDEX = 27_051_034_992;
    uint64 internal constant CLUSTER_INDEX = 0;
    // TODO needs to be updated after the last validators have been removed
    uint256 internal constant CLUSTER_ETH_BALANCE = 0.051885958642 ether;

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address nativeStakingStrategy = resolver.resolve("NATIVE_STAKING_SSV_STRATEGY_2_PROXY");
        address compoundingStakingStrategy = resolver.resolve("COMPOUNDING_STAKING_STRATEGY_PROXY");

        uint64[] memory operatorIds = new uint64[](4);
        operatorIds[0] = 752;
        operatorIds[1] = 753;
        operatorIds[2] = 754;
        operatorIds[3] = 755;

        Cluster memory cluster = Cluster({
            validatorCount: VALIDATOR_COUNT,
            networkFeeIndex: NETWORK_FEE_INDEX,
            index: CLUSTER_INDEX,
            active: true,
            balance: CLUSTER_ETH_BALANCE
        });

        govProposal.setDescription(
            "Complete the migration from the second Native Staking Strategy to the new "
            "Compounding Staking Strategy. Withdraw the remaining ETH from the old strategy's "
            "SSV cluster, remove the old strategy from the OETH Vault, and replace the "
            "ConsolidationController as validator registrator with the Talos Relayer."
        );

        govProposal.action(
            nativeStakingStrategy,
            "withdrawSsvClusterEth(uint64[],uint256,(uint32,uint64,uint64,bool,uint256))",
            abi.encode(operatorIds, CLUSTER_ETH_BALANCE, cluster)
        );
        govProposal.action(
            resolver.resolve("OETH_VAULT_PROXY"), "removeStrategy(address)", abi.encode(nativeStakingStrategy)
        );
        govProposal.action(compoundingStakingStrategy, "setRegistrator(address)", abi.encode(CrossChain.talosRelayer));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address nativeStakingStrategy = resolver.resolve("NATIVE_STAKING_SSV_STRATEGY_2_PROXY");
        IVault vault = IVault(resolver.resolve("OETH_VAULT_PROXY"));
        VaultStorage.Strategy memory strategyConfig = vault.strategies(nativeStakingStrategy);

        require(!strategyConfig.isSupported, "Native Staking Strategy 2 still supported");
        require(
            CompoundingStakingStrategy(payable(resolver.resolve("COMPOUNDING_STAKING_STRATEGY_PROXY")))
                .validatorRegistrator() == CrossChain.talosRelayer,
            "Compounding Staking Strategy registrator not updated"
        );
    }
}
