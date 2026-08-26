// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {CompoundingStakingStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

// Mainnet addresses
import {Mainnet} from "tests/utils/Addresses.sol";

/// @title 005_UpgradeCompoundingStakingStrategy
/// @notice Makes snapBalances() and verifyBalances() permissionless now that validator consolidation is complete.
contract $005_UpgradeCompoundingStakingStrategy is AbstractDeployScript("005_UpgradeCompoundingStakingStrategy") {
    using GovHelper for GovProposal;

    uint64 internal constant BEACON_GENESIS_TIMESTAMP = 1_606_824_023;
    // Limit exposure while a new validator's withdrawal credentials are still unverified.
    uint256 internal constant INITIAL_DEPOSIT_AMOUNT = 1 ether;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        CompoundingStakingStrategy newImpl = new CompoundingStakingStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: resolver.resolve("OETH_VAULT_PROXY")
            }),
            Mainnet.WETH,
            Mainnet.beaconChainDepositContract,
            Mainnet.BeaconProofs,
            BEACON_GENESIS_TIMESTAMP
        );

        _recordDeployment("COMPOUNDING_STAKING_STRATEGY_IMPL", address(newImpl), type(CompoundingStakingStrategy).name);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription(
            "Make Compounding Staking Strategy balance proofs permissionless\n\n"
            "Validator consolidation is complete, so the ConsolidationController is no longer the "
            "strategy registrator. This proposal upgrades the CompoundingStakingStrategy to allow "
            "anyone to call snapBalances() and verifyBalances(). The existing snapshot delay and "
            "beacon proof verification continue to protect the accounting inputs. It also lowers "
            "the maximum first validator deposit to 1 ETH."
        );
        address proxy = resolver.resolve("COMPOUNDING_STAKING_STRATEGY_PROXY");
        govProposal.action(
            proxy, "upgradeTo(address)", abi.encode(resolver.resolve("COMPOUNDING_STAKING_STRATEGY_IMPL"))
        );
        govProposal.action(proxy, "setInitialDepositAmount(uint256)", abi.encode(INITIAL_DEPOSIT_AMOUNT));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address proxy = resolver.resolve("COMPOUNDING_STAKING_STRATEGY_PROXY");
        address expectedImpl = resolver.resolve("COMPOUNDING_STAKING_STRATEGY_IMPL");

        require(
            InitializeGovernedUpgradeabilityProxy(payable(proxy)).implementation() == expectedImpl,
            "Compounding strategy implementation not updated"
        );

        CompoundingStakingStrategy strategy = CompoundingStakingStrategy(payable(proxy));
        require(strategy.vaultAddress() == resolver.resolve("OETH_VAULT_PROXY"), "Unexpected OETH vault");
        require(strategy.BEACON_PROOFS() == Mainnet.BeaconProofs, "Unexpected BeaconProofs");
        require(strategy.initialDepositAmountWei() == INITIAL_DEPOSIT_AMOUNT, "Initial deposit amount changed");
        require(strategy.validatorRegistrator() != address(0), "Registrator cleared");

        _verifyPermissionlessBalanceCalls(proxy);
    }

    function _verifyPermissionlessBalanceCalls(address proxy) internal {
        address caller = address(0xBEEF);

        vm.prank(caller);
        (bool success, bytes memory returnData) =
            proxy.call(abi.encodeCall(CompoundingStakingStrategy.snapBalances, ()));
        _requireNotRestricted(success, returnData, "snapBalances is restricted");

        CompoundingStakingStrategy.BalanceProofs memory balanceProofs = CompoundingStakingStrategy.BalanceProofs({
            balancesContainerRoot: bytes32(0),
            balancesContainerProof: bytes(""),
            validatorBalanceLeaves: new bytes32[](0),
            validatorBalanceProofs: new bytes[](0)
        });
        CompoundingStakingStrategy.PendingDepositProofs memory pendingDepositProofs =
            CompoundingStakingStrategy.PendingDepositProofs({
                pendingDepositContainerRoot: bytes32(0),
                pendingDepositContainerProof: bytes(""),
                pendingDepositIndexes: new uint32[](0),
                pendingDepositProofs: new bytes[](0)
            });

        vm.prank(caller);
        (success, returnData) = proxy.call(
            abi.encodeCall(CompoundingStakingStrategy.verifyBalances, (balanceProofs, pendingDepositProofs))
        );
        _requireNotRestricted(success, returnData, "verifyBalances is restricted");
    }

    function _requireNotRestricted(bool success, bytes memory returnData, string memory errorMessage) internal pure {
        if (!success) require(_selector(returnData) != bytes4(keccak256("NotRegistrator()")), errorMessage);
    }

    function _selector(bytes memory returnData) internal pure returns (bytes4 selector) {
        if (returnData.length < 4) return bytes4(0);
        assembly {
            selector := mload(add(returnData, 32))
        }
    }
}
