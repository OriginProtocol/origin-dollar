# Branch B Flow-of-Funds (Phase 2 context)

## 1) Mint (asset in -> OUSD out)
- User mints via VaultCore.mint(amount) which calls _mint, scales by assetDecimals, mints OUSD, and transfers the single asset into the Vault (contracts/contracts/vault/VaultCore.sol:65-91; contracts/contracts/vault/VaultStorage.sol:213-214).
- Rebase can be triggered before transfers when the scaled amount exceeds rebaseThreshold (contracts/contracts/vault/VaultCore.sol:83).
- Event: Mint (contracts/contracts/vault/VaultStorage.sol:27).

## 2) Allocation to strategy
- defaultStrategy is configured via setDefaultStrategy (contracts/contracts/vault/VaultAdmin.sol:90-105).
- _allocate sends asset above the vault buffer to defaultStrategy (contracts/contracts/vault/VaultCore.sol:389-417; contracts/contracts/vault/VaultStorage.sol:202,91).
- Event: AssetAllocated (contracts/contracts/vault/VaultStorage.sol:24).

## 3) Yield accounting and distribution
- _rebase uses _totalValue() which is derived from _checkBalance(asset) across strategies (contracts/contracts/vault/VaultCore.sol:424-468; contracts/contracts/vault/VaultCore.sol:546-607).
- OUSD supply is increased via changeSupply (contracts/contracts/vault/VaultCore.sol:467-468; contracts/contracts/token/OUSD.sol:597).
- Event: YieldDistribution (contracts/contracts/vault/VaultStorage.sol:39).

## 4) Cross-chain dispatch and reporting
UNKNOWN: Branch B does not contain cross-chain strategy contracts (expected contracts/contracts/strategies/crosschain/*). There are no code references for CCTP messaging, remote strategy handling, or balance reporting in this branch.
