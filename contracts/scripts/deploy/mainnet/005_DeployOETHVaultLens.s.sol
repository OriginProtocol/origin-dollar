// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {OETHVaultLensProxy} from "contracts/proxies/Proxies.sol";
import {OTokenVaultLens} from "contracts/lens/OTokenVaultLens.sol";
import {CompoundingStakingStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

// Mainnet addresses
import {Mainnet} from "tests/utils/Addresses.sol";

/// @title 005_DeployOETHVaultLens
/// @notice Upgrades the Compounding Staking Strategy (permissionless balance proofs,
///         lastVerifiedBalanceTimestamp, 1 ETH initial deposit) and deploys the
///         OETH Vault Lens that reports the OETH/WETH NAV rate gated on that timestamp.
contract $005_DeployOETHVaultLens is AbstractDeployScript("005_DeployOETHVaultLens") {
    using GovHelper for GovProposal;

    uint64 internal constant BEACON_GENESIS_TIMESTAMP = 1_606_824_023;
    // Limit exposure while a new validator's withdrawal credentials are still unverified.
    uint256 internal constant INITIAL_DEPOSIT_AMOUNT = 1 ether;
    address internal constant GOVERNOR = Mainnet.Timelock;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        // 1. New CompoundingStakingStrategy implementation.
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

        // 2. OETH Vault Lens implementation and proxy, governed by the Timelock.
        OETHVaultLensProxy lensProxy = new OETHVaultLensProxy();
        OTokenVaultLens lensImpl = new OTokenVaultLens(
            resolver.resolve("OETH_VAULT_PROXY"), resolver.resolve("COMPOUNDING_STAKING_STRATEGY_PROXY")
        );
        lensProxy.initialize(address(lensImpl), GOVERNOR, "");

        _recordDeployment("OETH_VAULT_LENS_IMPL", address(lensImpl), type(OTokenVaultLens).name);
        _recordDeployment("OETH_VAULT_LENS_PROXY", address(lensProxy), type(OETHVaultLensProxy).name);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription(
            "Upgrade the Compounding Staking Strategy and enable the OETH Vault Lens\n\n"
            "Validator consolidation is complete, so the ConsolidationController is no longer the "
            "strategy registrator. This proposal upgrades the CompoundingStakingStrategy to allow "
            "anyone to call snapBalances() and verifyBalances(). The existing snapshot delay and "
            "beacon proof verification continue to protect the accounting inputs. It also lowers "
            "the maximum first validator deposit to 1 ETH. The new implementation additionally "
            "exposes lastVerifiedBalanceTimestamp, the timestamp of the last balance snapshot "
            "verified against beacon chain data, which the newly deployed OETH Vault Lens reads "
            "to refuse reporting an OETH/WETH rate when balance verification is more than 24 " "hours old."
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
        _verifyLens(proxy);
    }

    function _verifyLens(address strategyProxy) internal {
        address lensProxyAddr = resolver.resolve("OETH_VAULT_LENS_PROXY");
        InitializeGovernedUpgradeabilityProxy lensProxy = InitializeGovernedUpgradeabilityProxy(payable(lensProxyAddr));

        require(lensProxy.implementation() == resolver.resolve("OETH_VAULT_LENS_IMPL"), "Unexpected lens impl");
        require(lensProxy.governor() == GOVERNOR, "Unexpected lens governor");

        OTokenVaultLens lens = OTokenVaultLens(lensProxyAddr);
        require(address(lens.vault()) == resolver.resolve("OETH_VAULT_PROXY"), "Unexpected lens vault");
        require(address(lens.oToken()) == resolver.resolve("OETH_PROXY"), "Unexpected lens oToken");
        require(lens.stakingStrategy() == strategyProxy, "Unexpected lens strategy");

        // Right after the upgrade no verifyBalances() has run against the new implementation,
        // so lastVerifiedBalanceTimestamp is 0 and the lens must refuse to report a rate.
        // Guarded on actual staleness so the check stays valid once real balance
        // verifications happen on-chain, as _fork() re-runs on every fork and smoke run.
        uint256 lastVerified = ICompoundingStakingStrategy(strategyProxy).lastVerifiedBalanceTimestamp();
        if (lastVerified + lens.MAX_VERIFIED_BALANCE_AGE() < block.timestamp) {
            (bool success,) = lensProxyAddr.staticcall(abi.encodeCall(OTokenVaultLens.getRate, ()));
            require(!success, "getRate should revert while stale");
        }

        // With a fresh verified balance the lens reports the Vault's value per OToken.
        vm.mockCall(
            strategyProxy,
            ICompoundingStakingStrategy.lastVerifiedBalanceTimestamp.selector,
            abi.encode(uint64(block.timestamp))
        );
        uint256 rate = lens.getRate();
        require(rate > 0, "Invalid rate");
        require(rate == (lens.vault().totalValue() * 1e18) / lens.oToken().totalSupply(), "Unexpected rate");
        // Clears all mocked calls so the mock can not leak into smoke tests,
        // which run this script as part of their setUp.
        vm.clearMockedCalls();
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
