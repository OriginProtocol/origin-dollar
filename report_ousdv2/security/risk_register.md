# Risk Register (Ranked)

1) Operator liveness and single relayer dependency (Branch A)
- Severity: High
- Impact: Bridged funds and withdrawals can stall if operator is offline.
- Likelihood: Medium
- Mitigation: Operate redundant relayers and monitor relay health (not enforced on-chain).
- Code refs: AbstractCCTPIntegrator.relay onlyOperator (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433,123).

2) Single in-flight transfer (Branch A)
- Severity: High
- Impact: A stuck transfer blocks all subsequent deposits/withdrawals.
- Likelihood: Medium
- Mitigation: Operational monitoring; ensure relay and message processing reliability.
- Code refs: AbstractCCTPIntegrator._getNextNonce and isTransferPending (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:588,538).

3) Cached accounting for remote assets (Branch A)
- Severity: Medium
- Impact: Vault accounting can be stale vs actual remote strategy balance.
- Likelihood: Medium
- Mitigation: Frequent balance updates; monitor remote strategy and relay cadence.
- Code refs: CrossChainMasterStrategy.checkBalance uses pendingAmount and remoteStrategyBalance (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:141).

4) Withdrawal confirmation without transfer (Branch A)
- Severity: High
- Impact: Master may clear pending withdrawal even if remote could not bridge funds (WithdrawalFailed path).
- Likelihood: Medium
- Mitigation: Add explicit failure handling or require funds before confirmation.
- Code refs: CrossChainRemoteStrategy._processWithdrawMessage sends balance update and emits WithdrawalFailed when insufficient balance (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:268-291).

5) Silent deposit/withdraw failures on remote (Branch A)
- Severity: Medium
- Impact: Funds can remain idle while deposit/withdraw errors are only logged.
- Likelihood: Medium
- Mitigation: Off-chain monitoring of failure events and retry logic.
- Code refs: CrossChainRemoteStrategy._deposit/_withdraw try-catch (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:206-233,300-333).

6) Unfinalized message acceptance (Branch A)
- Severity: Medium
- Impact: Reorg risk if minFinalityThreshold allows unfinalized messages.
- Likelihood: Low to Medium
- Mitigation: Keep minFinalityThreshold at finalized mode (2000).
- Code refs: AbstractCCTPIntegrator.handleReceiveUnfinalizedMessage checks minFinalityThreshold==1000 (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:312-320).

7) Governance parameter risk (Branch A)
- Severity: Medium
- Impact: Misconfiguration of operator or thresholds can stall or weaken message security.
- Likelihood: Low to Medium
- Mitigation: Governance process controls and multi-sig review.
- Code refs: AbstractCCTPIntegrator.setOperator/setMinFinalityThreshold/setFeePremiumBps (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:215,235,262).

8) Proxy upgrade risk (Branch A)
- Severity: High
- Impact: Governor can replace implementation; upgrade mistakes can break accounting or custody.
- Likelihood: Low
- Mitigation: Rigorous upgrade testing and timelock process.
- Code refs: InitializeGovernedUpgradeabilityProxy.upgradeTo/upgradeToAndCall (contracts/contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:76,89).

9) Peer strategy address mismatch across chains (Branch A)
- Severity: Medium
- Impact: Messages rejected, causing stuck funds or stale balance.
- Likelihood: Low
- Mitigation: Ensure create2 proxy address matches on both chains.
- Code refs: AbstractCCTPIntegrator._handleReceivedMessage requires peerDomainID and peerStrategy (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338-347).

10) Phase 2 cross-chain stack missing in Branch B
- Severity: Medium
- Impact: Phase 2 cannot function without cross-chain contracts and deploy scripts.
- Likelihood: High (current state in Branch B).
- Mitigation: Merge cross-chain stack from Branch A and reconcile vault API differences.
- Code refs: Missing contracts/contracts/strategies/crosschain/* in Branch B; single-asset vault confirmed by VaultStorage.asset/defaultStrategy (contracts/contracts/vault/VaultStorage.sol:202,213).
