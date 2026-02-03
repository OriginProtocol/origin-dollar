# Branch B Contracts

## Inventory
| Contract | Path | Responsibilities | Key entrypoints (external/public) | External deps |
|---|---|---|---|---|
| OUSDVault | contracts/contracts/vault/OUSDVault.sol | Single-asset Vault wrapper with asset passed to constructor (contracts/contracts/vault/OUSDVault.sol:10-11). | constructor (contracts/contracts/vault/OUSDVault.sol:10-11). | VaultAdmin (contracts/contracts/vault/OUSDVault.sol:4). |
| VaultStorage | contracts/contracts/vault/VaultStorage.sol | Stores single asset, defaultStrategy, withdrawal queue, and rebase parameters (contracts/contracts/vault/VaultStorage.sol:202,213,145-196). | getters via IVault (contracts/contracts/interfaces/IVault.sol:85,164). | Governable, OUSD, IStrategy (contracts/contracts/vault/VaultStorage.sol:14-18). |
| VaultCore | contracts/contracts/vault/VaultCore.sol | Single-asset mint, allocate, rebase; computes total value from _checkBalance(asset) (contracts/contracts/vault/VaultCore.sol:65,389,424,546). | mint(uint256), allocate, rebase, checkBalance (contracts/contracts/vault/VaultCore.sol:65,376,424,573). | IStrategy, OUSD (contracts/contracts/vault/VaultCore.sol:14,17). |
| VaultAdmin | contracts/contracts/vault/VaultAdmin.sol | Admin/strategist configuration and strategy management (contracts/contracts/vault/VaultAdmin.sol:44-106,168-205). | setDefaultStrategy, approveStrategy, removeStrategy, depositToStrategy, withdrawFromStrategy, pause functions (contracts/contracts/vault/VaultAdmin.sol:90,168,180,270,312,388). | IStrategy (contracts/contracts/vault/VaultAdmin.sol:12-16). |
| VaultInitializer | contracts/contracts/vault/VaultInitializer.sol | Vault initialization: sets oToken and default parameters (contracts/contracts/vault/VaultInitializer.sol:15-33). | initialize (contracts/contracts/vault/VaultInitializer.sol:15). | OUSD (contracts/contracts/vault/VaultInitializer.sol:18). |
| OUSD token | contracts/contracts/token/OUSD.sol | Supply updated via changeSupply on rebase (contracts/contracts/token/OUSD.sol:597). | changeSupply (contracts/contracts/token/OUSD.sol:597). | Governable access control (contracts/contracts/token/OUSD.sol:597). |

## Not present (expected for Phase 2)
- CrossChainMasterStrategy, CrossChainRemoteStrategy, AbstractCCTPIntegrator, CrossChainStrategyHelper (expected under contracts/contracts/strategies/crosschain/*).
