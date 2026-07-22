// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import { AbstractDeployScript } from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import { GovHelper } from "scripts/deploy/helpers/GovHelper.sol";
import { GovProposal } from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import { IVault } from "contracts/interfaces/IVault.sol";
import { IWOToken } from "contracts/interfaces/IWOToken.sol";
import { OUSD } from "contracts/token/OUSD.sol";
import { WrappedOusd } from "contracts/token/WrappedOusd.sol";
import { OUSDVault } from "contracts/vault/OUSDVault.sol";
import { VaultValueChecker } from "contracts/strategies/VaultValueChecker.sol";
import { InitializeGovernedUpgradeabilityProxy } from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import { OUSDProxy, VaultProxy, WrappedOUSDProxy } from "contracts/proxies/Proxies.sol";

// OpenZeppelin
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mainnet addresses
import { CrossChain, Mainnet } from "tests/utils/Addresses.sol";

/// @title 003_DeployOUSD
/// @notice Deploys a fresh OUSD core system and its supporting contracts.
/// @dev The deployment has two phases:
///      1. _execute() deploys and initializes OUSD, its Vault, Wrapped OUSD,
///         and the VaultValueChecker.
///      2. _buildGovernanceProposal() configures and activates the new Vault.
contract $003_DeployOUSD is AbstractDeployScript("003_DeployOUSD") {
    using GovHelper for GovProposal;

    address internal constant GOVERNOR = Mainnet.Timelock;
    address internal constant STRATEGIST = CrossChain.multichainStrategist;
    uint256 internal constant INITIAL_CREDITS_PER_TOKEN = 1e27;
    uint256 internal constant REBASE_RATE_MAX = 200e18;
    uint256 internal constant WITHDRAWAL_CLAIM_DELAY = 10 minutes;

    bool public constant override skip = true;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        // Deploy the core proxies first so their addresses can be passed to the
        // implementations' initializers and constructors.
        OUSDProxy ousdProxy = new OUSDProxy();
        VaultProxy vaultProxy = new VaultProxy();

        OUSD ousdImpl = new OUSD();
        OUSDVault vaultImpl = new OUSDVault(Mainnet.USDC);

        // Initialize each proxy atomically and hand governance over only after
        // its implementation initializer has completed.
        ousdProxy.initialize(
            address(ousdImpl),
            GOVERNOR,
            abi.encodeCall(
                OUSD.initialize,
                (address(vaultProxy), INITIAL_CREDITS_PER_TOKEN)
            )
        );
        vaultProxy.initialize(
            address(vaultImpl),
            GOVERNOR,
            abi.encodeCall(IVault.initialize, (address(ousdProxy)))
        );

        WrappedOUSDProxy wrappedOusdProxy = new WrappedOUSDProxy();
        WrappedOusd wrappedOusdImpl = new WrappedOusd(
            ERC20(address(ousdProxy))
        );
        wrappedOusdProxy.initialize(
            address(wrappedOusdImpl),
            GOVERNOR,
            abi.encodeCall(IWOToken.initialize, ())
        );

        VaultValueChecker vaultValueChecker = new VaultValueChecker(
            address(vaultProxy),
            address(ousdProxy)
        );

        _recordDeployment("OUSD_IMPL", address(ousdImpl));
        _recordDeployment("OUSD_PROXY", address(ousdProxy));
        _recordDeployment("OUSD_VAULT_IMPL", address(vaultImpl));
        _recordDeployment("OUSD_VAULT_PROXY", address(vaultProxy));
        _recordDeployment("WRAPPED_OUSD_IMPL", address(wrappedOusdImpl));
        _recordDeployment("WRAPPED_OUSD_PROXY", address(wrappedOusdProxy));
        _recordDeployment(
            "OUSD_VAULT_VALUE_CHECKER",
            address(vaultValueChecker)
        );
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address vaultProxy = resolver.resolve("OUSD_VAULT_PROXY");

        govProposal.setDescription(
            "Configure and activate the fresh OUSD Vault"
        );
        govProposal.action(
            vaultProxy,
            "setStrategistAddr(address)",
            abi.encode(STRATEGIST)
        );
        govProposal.action(
            vaultProxy,
            "setRebaseRateMax(uint256)",
            abi.encode(REBASE_RATE_MAX)
        );
        govProposal.action(
            vaultProxy,
            "setWithdrawalClaimDelay(uint256)",
            abi.encode(WITHDRAWAL_CLAIM_DELAY)
        );
        govProposal.action(vaultProxy, "unpauseCapital()", bytes(""));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address ousdProxyAddr = resolver.resolve("OUSD_PROXY");
        address vaultProxyAddr = resolver.resolve("OUSD_VAULT_PROXY");
        address wrappedOusdProxyAddr = resolver.resolve("WRAPPED_OUSD_PROXY");

        InitializeGovernedUpgradeabilityProxy ousdProxy = InitializeGovernedUpgradeabilityProxy(
                payable(ousdProxyAddr)
            );
        InitializeGovernedUpgradeabilityProxy vaultProxy = InitializeGovernedUpgradeabilityProxy(
                payable(vaultProxyAddr)
            );
        InitializeGovernedUpgradeabilityProxy wrappedOusdProxy = InitializeGovernedUpgradeabilityProxy(
                payable(wrappedOusdProxyAddr)
            );

        require(
            ousdProxy.implementation() == resolver.resolve("OUSD_IMPL"),
            "Unexpected OUSD implementation"
        );
        require(
            vaultProxy.implementation() == resolver.resolve("OUSD_VAULT_IMPL"),
            "Unexpected OUSD Vault implementation"
        );
        require(
            wrappedOusdProxy.implementation() ==
                resolver.resolve("WRAPPED_OUSD_IMPL"),
            "Unexpected Wrapped OUSD implementation"
        );
        require(ousdProxy.governor() == GOVERNOR, "Unexpected OUSD governor");
        require(
            vaultProxy.governor() == GOVERNOR,
            "Unexpected OUSD Vault governor"
        );
        require(
            wrappedOusdProxy.governor() == GOVERNOR,
            "Unexpected Wrapped OUSD governor"
        );

        OUSD ousd = OUSD(ousdProxyAddr);
        IVault vault = IVault(vaultProxyAddr);
        WrappedOusd wrappedOusd = WrappedOusd(wrappedOusdProxyAddr);
        VaultValueChecker vaultValueChecker = VaultValueChecker(
            resolver.resolve("OUSD_VAULT_VALUE_CHECKER")
        );

        require(
            ousd.vaultAddress() == vaultProxyAddr,
            "OUSD Vault link is incorrect"
        );
        require(
            address(vault.oToken()) == ousdProxyAddr,
            "Vault OUSD link is incorrect"
        );
        require(
            ousd.rebasingCreditsPerTokenHighres() == INITIAL_CREDITS_PER_TOKEN,
            "Unexpected OUSD credits resolution"
        );
        require(
            keccak256(bytes(ousd.name())) == keccak256(bytes("Origin Dollar")),
            "Unexpected OUSD name"
        );
        require(
            keccak256(bytes(ousd.symbol())) == keccak256(bytes("OUSD")),
            "Unexpected OUSD symbol"
        );
        require(ousd.totalSupply() == 0, "OUSD supply is not zero");

        require(vault.asset() == Mainnet.USDC, "Unexpected OUSD Vault asset");
        require(
            vault.strategistAddr() == STRATEGIST,
            "Unexpected OUSD Vault strategist"
        );
        require(!vault.capitalPaused(), "OUSD Vault capital is paused");
        require(
            vault.withdrawalClaimDelay() == WITHDRAWAL_CLAIM_DELAY,
            "Unexpected withdrawal claim delay"
        );
        require(
            vault.rebasePerSecondMax() == REBASE_RATE_MAX / 100 / 365 days,
            "Unexpected maximum rebase rate"
        );

        require(
            wrappedOusd.asset() == ousdProxyAddr,
            "Unexpected Wrapped OUSD asset"
        );
        require(
            wrappedOusd.adjuster() == INITIAL_CREDITS_PER_TOKEN,
            "Wrapped OUSD is not initialized"
        );
        require(
            address(vaultValueChecker.vault()) == vaultProxyAddr,
            "VaultValueChecker Vault link is incorrect"
        );
        require(
            address(vaultValueChecker.ousd()) == ousdProxyAddr,
            "VaultValueChecker OUSD link is incorrect"
        );
    }
}
