# Branch A Permissions Matrix

## Roles
- Governor (Governable.onlyGovernor) (contracts/contracts/governance/Governable.sol:75).
- Vault (InitializableAbstractStrategy.onlyVault) (contracts/contracts/utils/InitializableAbstractStrategy.sol:150).
- Vault or Governor (InitializableAbstractStrategy.onlyVaultOrGovernor) (contracts/contracts/utils/InitializableAbstractStrategy.sol:166).
- Strategist (VaultAdmin.onlyGovernorOrStrategist / Strategizable.onlyGovernorOrStrategist) (contracts/contracts/vault/VaultAdmin.sol:28; contracts/contracts/governance/Strategizable.sol:18).
- Operator (AbstractCCTPIntegrator.onlyOperator) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:123).
- CCTP MessageTransmitter (AbstractCCTPIntegrator.onlyCCTPMessageTransmitter) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:115).
- Harvester (InitializableAbstractStrategy.onlyHarvester) (contracts/contracts/utils/InitializableAbstractStrategy.sol:158).

## CrossChainMasterStrategy
- initialize(operator, minFinalityThreshold, feePremiumBps) -> onlyGovernor (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:64).
- deposit(asset, amount), depositAll() -> onlyVault (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:83,93).
- withdraw(recipient, asset, amount) -> onlyVault (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:102).
- withdrawAll() -> onlyVaultOrGovernor (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:112).
- safeApproveAllTokens() -> onlyGovernor (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:164).
- collectRewardTokens() -> onlyHarvester (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:175).

## CrossChainRemoteStrategy
- initialize(strategist, operator, minFinalityThreshold, feePremiumBps) -> onlyGovernor (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:79).
- deposit/depositAll/withdraw/withdrawAll -> onlyGovernorOrStrategist (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:103,114,125,134).
- sendBalanceUpdate() -> onlyOperatorOrStrategistOrGovernor (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:360; modifier at 34-41).

## AbstractCCTPIntegrator
- setOperator, setMinFinalityThreshold, setFeePremiumBps -> onlyGovernor (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:215,235,262).
- handleReceiveFinalizedMessage, handleReceiveUnfinalizedMessage -> onlyCCTPMessageTransmitter (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:290,312,115).
- relay(message, attestation) -> onlyOperator (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433,123).

## VaultAdmin (multi-asset)
Representative privileged functions and access controls:
- setAssetDefaultStrategy(asset, strategy) -> onlyGovernorOrStrategist (contracts/contracts/vault/VaultAdmin.sol:111).
- approveStrategy/removeStrategy -> onlyGovernor (contracts/contracts/vault/VaultAdmin.sol:474,486).
- depositToStrategy/withdrawFromStrategy -> onlyGovernorOrStrategist (contracts/contracts/vault/VaultAdmin.sol:533,573).
- setRebaseThreshold/setAutoAllocateThreshold/setMaxSupplyDiff/setTrusteeAddress/setTrusteeFeeBps -> onlyGovernor (contracts/contracts/vault/VaultAdmin.sol:91,78,616,625,634).
- pauseRebase/unpauseRebase/pauseCapital/unpauseCapital -> onlyGovernorOrStrategist (contracts/contracts/vault/VaultAdmin.sol:659,667,675,683).

## Upgradeability
- Proxy upgrade functions are Governor-controlled (InitializeGovernedUpgradeabilityProxy.upgradeTo/upgradeToAndCall) (contracts/contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:76,89).
