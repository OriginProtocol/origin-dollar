# Phase 2 Constraints (Extracted)

This section summarizes the Phase 2 constraints that must be respected in Phase 3. All statements are grounded in the Phase 2 report and/or code.

## Canonical accounting model (hub of truth)
- OUSD supply is updated only via Vault rebase, which computes total value from vault + strategies and then calls OUSD.changeSupply (report_ousdv2/branches/branch_A/flows.md; report_ousdv2/branches/branch_B/flows.md; contracts/contracts/vault/VaultCore.sol:424-468; contracts/contracts/token/OUSD.sol:597).
- In Branch A, the master strategy's checkBalance includes local USDC + pendingAmount + cached remoteStrategyBalance, and this feeds Vault accounting (report_ousdv2/branches/branch_A/flows.md; contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:141).
- In Branch B, accounting is single-asset only: _checkBalance returns 0 for non-asset and uses defaultStrategy (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:597; contracts/contracts/vault/VaultStorage.sol:202,213).

## Cross-chain movement model
- Phase 2 cross-chain flow (Branch A) uses CCTP TokenMessenger for USDC transfers with hook payloads, plus CCTP MessageTransmitter for balance updates and withdrawals (report_ousdv2/branches/branch_A/flows.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:359-415,433-523).
- Message handling is restricted to the CCTP MessageTransmitter; relay of messages is restricted to a single operator role (report_ousdv2/summary/key_invariants.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:115,123,433).
- Only one in-flight transfer is allowed; a pending nonce blocks new transfers (report_ousdv2/summary/key_invariants.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:538,588).

## Yield recognition and distribution
- Yield becomes distributable to OUSD holders only when Vault rebase is executed and changeSupply is called (report_ousdv2/branches/branch_A/flows.md; contracts/contracts/vault/VaultCore.sol:424-468; contracts/contracts/token/OUSD.sol:597).
- Strategy balances are included in total value using IStrategy.checkBalance (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:591-607; contracts/contracts/interfaces/IStrategy.sol:38).

## Roles and admin model
- Governor controls strategy approvals, default strategy selection, and pause controls (report_ousdv2/branches/branch_A/permissions.md; report_ousdv2/branches/branch_B/permissions.md; contracts/contracts/vault/VaultAdmin.sol:90-105,168-218,388-412).
- Strategist can set default strategy and move funds between vault and strategies (report_ousdv2/branches/branch_B/permissions.md; contracts/contracts/vault/VaultAdmin.sol:90,270,312).
- CCTP operator is a privileged relayer for cross-chain messages (report_ousdv2/branches/branch_A/permissions.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433).

## Emergency controls
- Vault can pause capital and rebase operations via pauseCapital/pauseRebase (report_ousdv2/branches/branch_A/permissions.md; contracts/contracts/vault/VaultAdmin.sol:388-412).
- Cross-chain strategies do not expose a dedicated pause; liveness relies on operator and CCTP components (report_ousdv2/security/risk_register.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433).

## Operational requirements
- Cross-chain flows require an operator to relay CCTP messages (report_ousdv2/summary/executive_summary.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433).
- Balance updates must be sent from the remote strategy to keep master accounting current (report_ousdv2/branches/branch_A/flows.md; contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:360-368).

## Invariants that Phase 3 must not break
- OUSD mint/burn is restricted to the Vault (onlyVault) (report_ousdv2/summary/key_invariants.md; contracts/contracts/token/OUSD.sol:414-434).
- Vault accounting must remain based on strategy.checkBalance, with rebase as the only supply adjustment path (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468; contracts/contracts/interfaces/IStrategy.sol:38).
- Cross-chain messaging must validate peer domain and peer strategy address (report_ousdv2/summary/key_invariants.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338).

## Diagram references used
- Branch A diagrams: report_ousdv2/branches/branch_A/diagrams/architecture.mmd; report_ousdv2/branches/branch_A/diagrams/sequence_mint_allocate.mmd; report_ousdv2/branches/branch_A/diagrams/sequence_harvest_report.mmd; report_ousdv2/branches/branch_A/diagrams/sequence_failure_recovery.mmd; report_ousdv2/branches/branch_A/diagrams/accounting.mmd.
- Branch B diagrams: report_ousdv2/branches/branch_B/diagrams/architecture.mmd; report_ousdv2/branches/branch_B/diagrams/sequence_mint_allocate.mmd; report_ousdv2/branches/branch_B/diagrams/sequence_harvest_report.mmd; report_ousdv2/branches/branch_B/diagrams/sequence_failure_recovery.mmd; report_ousdv2/branches/branch_B/diagrams/accounting.mmd.
