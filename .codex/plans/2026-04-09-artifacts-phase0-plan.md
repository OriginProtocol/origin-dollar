# Phase 0 Plan: Propagate `Artifacts.sol` Across Foundry Tests

Date: 2026-04-09
Working directory: `contracts/`
Scope for migration phases: `tests/unit/**` and `tests/fork/**`

## 1. Inventory

### Summary

- `grep -rln 'vm.deployCode(' tests/` currently matches 89 paths total.
- Non-target matches:
  - `tests/README.md`
  - `tests/utils/Artifacts.sol`
- In-scope migration targets for Phases 1-3: 85 test files under `tests/unit/` and `tests/fork/`.
- Verified out-of-scope smoke-test matches:
  - `tests/smoke/base/strategies/CrossChainRemoteStrategyBase/shared/Shared.t.sol`
  - `tests/smoke/hyperevm/strategies/CrossChainRemoteStrategyHyperEVM/shared/Shared.t.sol`

### Grouped file inventory

#### `unit/vault` (2)

- `tests/unit/vault/OETHVault/shared/Shared.t.sol`
- `tests/unit/vault/OUSDVault/shared/Shared.t.sol`

#### `unit/token` (11)

- `tests/unit/token/OETH/concrete/ViewFunctions.t.sol`
- `tests/unit/token/OETHBase/concrete/ViewFunctions.t.sol`
- `tests/unit/token/OSonic/concrete/ViewFunctions.t.sol`
- `tests/unit/token/OUSD/concrete/Initialize.t.sol`
- `tests/unit/token/OUSD/shared/Shared.t.sol`
- `tests/unit/token/WOETH/concrete/Initialize.t.sol`
- `tests/unit/token/WOETH/shared/Shared.t.sol`
- `tests/unit/token/WOETHBase/shared/Shared.t.sol`
- `tests/unit/token/WOETHPlume/shared/Shared.t.sol`
- `tests/unit/token/WOSonic/shared/Shared.t.sol`
- `tests/unit/token/WrappedOusd/shared/Shared.t.sol`

#### `unit/strategies` (25)

- `tests/unit/strategies/AerodromeAMOStrategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/AerodromeAMOStrategy/concrete/Rebalance.t.sol`
- `tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/BaseCurveAMOStrategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/BridgedWOETHStrategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/CrossChainMasterStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/CrossChainRemoteStrategy/concrete/DepositFailure.t.sol`
- `tests/unit/strategies/CrossChainRemoteStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/CurveAMOStrategy/concrete/Constructor.t.sol`
- `tests/unit/strategies/CurveAMOStrategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/Generalized4626Strategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol`
- `tests/unit/strategies/MorphoV2Strategy/shared/Shared.t.sol`
- `tests/unit/strategies/OETHSupernovaAMOStrategy/concrete/Constructor.t.sol`
- `tests/unit/strategies/OETHSupernovaAMOStrategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/SonicSwapXAMOStrategy/concrete/Constructor.t.sol`
- `tests/unit/strategies/SonicSwapXAMOStrategy/concrete/Initialize.t.sol`
- `tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol`
- `tests/unit/strategies/VaultValueChecker/shared/Shared.t.sol`

#### `unit/poolBooster` (18)

- `tests/unit/poolBooster/Curve/shared/Shared.t.sol`
- `tests/unit/poolBooster/Merkl/concrete/PoolBoosterFactoryMerkl_Constructor.t.sol`
- `tests/unit/poolBooster/Merkl/shared/Shared.t.sol`
- `tests/unit/poolBooster/Metropolis/concrete/PoolBoosterFactoryMetropolis_Constructor.t.sol`
- `tests/unit/poolBooster/Metropolis/concrete/PoolBoosterMetropolis_Constructor.t.sol`
- `tests/unit/poolBooster/Metropolis/shared/Shared.t.sol`
- `tests/unit/poolBooster/SwapXDouble/concrete/PoolBoosterFactorySwapxDouble_Constructor.t.sol`
- `tests/unit/poolBooster/SwapXDouble/concrete/PoolBoosterSwapxDouble_Bribe.t.sol`
- `tests/unit/poolBooster/SwapXDouble/concrete/PoolBoosterSwapxDouble_Constructor.t.sol`
- `tests/unit/poolBooster/SwapXDouble/fuzz/PoolBoosterSwapxDouble_Bribe.fuzz.t.sol`
- `tests/unit/poolBooster/SwapXDouble/shared/Shared.t.sol`
- `tests/unit/poolBooster/SwapXSingle/concrete/PoolBoostCentralRegistry_ApproveFactory.t.sol`
- `tests/unit/poolBooster/SwapXSingle/concrete/PoolBoostCentralRegistry_Constructor.t.sol`
- `tests/unit/poolBooster/SwapXSingle/concrete/PoolBoostCentralRegistry_RemoveFactory.t.sol`
- `tests/unit/poolBooster/SwapXSingle/concrete/PoolBoostCentralRegistry_ViewFunctions.t.sol`
- `tests/unit/poolBooster/SwapXSingle/concrete/PoolBoosterFactorySwapxSingle_Constructor.t.sol`
- `tests/unit/poolBooster/SwapXSingle/concrete/PoolBoosterSwapxSingle_Constructor.t.sol`
- `tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol`

#### `unit/automation` (8)

- `tests/unit/automation/AutoWithdrawalModule/concrete/Constructor.t.sol`
- `tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol`
- `tests/unit/automation/BaseBridgeHelperModule/shared/Shared.t.sol`
- `tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol`
- `tests/unit/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol`
- `tests/unit/automation/CollectXOGNRewardsModule/shared/Shared.t.sol`
- `tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol`
- `tests/unit/automation/EthereumBridgeHelperModule/shared/Shared.t.sol`

#### `unit/zapper` (4)

- `tests/unit/zapper/OETHBaseZapper/concrete/Constructor.t.sol`
- `tests/unit/zapper/OETHZapper/shared/Shared.t.sol`
- `tests/unit/zapper/OSonicZapper/shared/Shared.t.sol`
- `tests/unit/zapper/WOETHCCIPZapper/shared/Shared.t.sol`

#### `unit/proxies` (3)

- `tests/unit/proxies/concrete/Admin.t.sol`
- `tests/unit/proxies/fuzz/Initialize.fuzz.t.sol`
- `tests/unit/proxies/shared/Shared.t.sol`

#### `fork/mainnet` (8)

- `tests/fork/mainnet/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol`
- `tests/fork/mainnet/automation/EthereumBridgeHelperModule/shared/Shared.t.sol`
- `tests/fork/mainnet/poolBooster/CurvePoolBooster/shared/Shared.t.sol`
- `tests/fork/mainnet/poolBooster/MerklPoolBoosterMainnet/shared/Shared.t.sol`
- `tests/fork/mainnet/strategies/CrossChainMasterStrategy/shared/Shared.t.sol`
- `tests/fork/mainnet/strategies/CurveAMOStrategy/shared/Shared.t.sol`
- `tests/fork/mainnet/strategies/MorphoV2Strategy/shared/Shared.t.sol`
- `tests/fork/mainnet/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol`

#### `fork/base` (3)

- `tests/fork/base/automation/BaseBridgeHelperModule/shared/Shared.t.sol`
- `tests/fork/base/strategies/AerodromeAMOStrategy/shared/Shared.t.sol`
- `tests/fork/base/strategies/CrossChainRemoteStrategy/shared/Shared.t.sol`

#### `fork/sonic` (3)

- `tests/fork/sonic/poolBooster/MetropolisPoolBooster/shared/Shared.t.sol`
- `tests/fork/sonic/poolBooster/SwapXPoolBooster/shared/Shared.t.sol`
- `tests/fork/sonic/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol`

#### `fork/hyperevm` (0)

- No in-scope files.

## 2. Full Artifact-Path Enumeration

Distinct inline artifact-path strings found in tests (excluding `tests/README.md` and `tests/utils/Artifacts.sol`): 60.

Proposed `Artifacts.sol` additions are grouped by target sub-library and alphabetized by constant name within each library.

| Artifact path | Proposed constant |
| --- | --- |
| `contracts/automation/AutoWithdrawalModule.sol:AutoWithdrawalModule` | `Automation.AUTO_WITHDRAWAL_MODULE` |
| `contracts/automation/BaseBridgeHelperModule.sol:BaseBridgeHelperModule` | `Automation.BASE_BRIDGE_HELPER_MODULE` |
| `contracts/automation/ClaimBribesSafeModule.sol:ClaimBribesSafeModule` | `Automation.CLAIM_BRIBES_SAFE_MODULE` |
| `contracts/automation/ClaimStrategyRewardsSafeModule.sol:ClaimStrategyRewardsSafeModule` | `Automation.CLAIM_STRATEGY_REWARDS_SAFE_MODULE` |
| `contracts/automation/CollectXOGNRewardsModule.sol:CollectXOGNRewardsModule` | `Automation.COLLECT_XOGN_REWARDS_MODULE` |
| `contracts/automation/CurvePoolBoosterBribesModule.sol:CurvePoolBoosterBribesModule` | `Automation.CURVE_POOL_BOOSTER_BRIBES_MODULE` |
| `contracts/automation/EthereumBridgeHelperModule.sol:EthereumBridgeHelperModule` | `Automation.ETHEREUM_BRIDGE_HELPER_MODULE` |
| `contracts/mocks/crosschain/CCTPMessageTransmitterMock2.sol:CCTPMessageTransmitterMock2` | `Mocks.CCTP_MESSAGE_TRANSMITTER_MOCK_2` |
| `contracts/mocks/crosschain/CCTPTokenMessengerMock.sol:CCTPTokenMessengerMock` | `Mocks.CCTP_TOKEN_MESSENGER_MOCK` |
| `contracts/poolBooster/PoolBoostCentralRegistry.sol:PoolBoostCentralRegistry` | `PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY` |
| `contracts/poolBooster/PoolBoosterFactoryMerkl.sol:PoolBoosterFactoryMerkl` | `PoolBoosters.POOL_BOOSTER_FACTORY_MERKL` |
| `contracts/poolBooster/PoolBoosterFactoryMetropolis.sol:PoolBoosterFactoryMetropolis` | `PoolBoosters.POOL_BOOSTER_FACTORY_METROPOLIS` |
| `contracts/poolBooster/PoolBoosterFactorySwapxDouble.sol:PoolBoosterFactorySwapxDouble` | `PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_DOUBLE` |
| `contracts/poolBooster/PoolBoosterFactorySwapxSingle.sol:PoolBoosterFactorySwapxSingle` | `PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_SINGLE` |
| `contracts/poolBooster/PoolBoosterMerklV2.sol:PoolBoosterMerklV2` | `PoolBoosters.POOL_BOOSTER_MERKL_V2` |
| `contracts/poolBooster/PoolBoosterMetropolis.sol:PoolBoosterMetropolis` | `PoolBoosters.POOL_BOOSTER_METROPOLIS` |
| `contracts/poolBooster/PoolBoosterSwapxDouble.sol:PoolBoosterSwapxDouble` | `PoolBoosters.POOL_BOOSTER_SWAPX_DOUBLE` |
| `contracts/poolBooster/PoolBoosterSwapxSingle.sol:PoolBoosterSwapxSingle` | `PoolBoosters.POOL_BOOSTER_SWAPX_SINGLE` |
| `contracts/poolBooster/curve/CurvePoolBooster.sol:CurvePoolBooster` | `PoolBoosters.CURVE_POOL_BOOSTER` |
| `contracts/poolBooster/curve/CurvePoolBoosterFactory.sol:CurvePoolBoosterFactory` | `PoolBoosters.CURVE_POOL_BOOSTER_FACTORY` |
| `contracts/poolBooster/curve/CurvePoolBoosterPlain.sol:CurvePoolBoosterPlain` | `PoolBoosters.CURVE_POOL_BOOSTER_PLAIN` |
| `contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy` | `Proxies.IG_PROXY` |
| `contracts/proxies/InitializeGovernedUpgradeabilityProxy2.sol:InitializeGovernedUpgradeabilityProxy2` | `Proxies.IG_PROXY_2` |
| `contracts/proxies/Proxies.sol:OETHProxy` | `Proxies.OETH_PROXY` |
| `contracts/proxies/Proxies.sol:OETHVaultProxy` | `Proxies.OETH_VAULT_PROXY` |
| `contracts/proxies/Proxies.sol:WOETHProxy` | `Proxies.WOETH_PROXY` |
| `contracts/proxies/SonicProxies.sol:OSonicProxy` | `Proxies.OS_PROXY` |
| `contracts/proxies/SonicProxies.sol:OSonicVaultProxy` | `Proxies.OS_VAULT_PROXY` |
| `contracts/proxies/create2/CrossChainStrategyProxy.sol:CrossChainStrategyProxy` | `Proxies.CROSS_CHAIN_STRATEGY_PROXY` |
| `contracts/strategies/BaseCurveAMOStrategy.sol:BaseCurveAMOStrategy` | `Strategies.BASE_CURVE_AMO_STRATEGY` |
| `contracts/strategies/BridgedWOETHStrategy.sol:BridgedWOETHStrategy` | `Strategies.BRIDGED_WOETH_STRATEGY` |
| `contracts/strategies/CurveAMOStrategy.sol:CurveAMOStrategy` | `Strategies.CURVE_AMO_STRATEGY` |
| `contracts/strategies/Generalized4626Strategy.sol:Generalized4626Strategy` | `Strategies.GENERALIZED_4626_STRATEGY` |
| `contracts/strategies/MorphoV2Strategy.sol:MorphoV2Strategy` | `Strategies.MORPHO_V2_STRATEGY` |
| `contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol:CompoundingStakingSSVStrategy` | `Strategies.COMPOUNDING_STAKING_SSV_STRATEGY` |
| `contracts/strategies/VaultValueChecker.sol:OETHVaultValueChecker` | `Strategies.OETH_VAULT_VALUE_CHECKER` |
| `contracts/strategies/VaultValueChecker.sol:VaultValueChecker` | `Strategies.VAULT_VALUE_CHECKER` |
| `contracts/strategies/aerodrome/AerodromeAMOStrategy.sol:AerodromeAMOStrategy` | `Strategies.AERODROME_AMO_STRATEGY` |
| `contracts/strategies/algebra/OETHSupernovaAMOStrategy.sol:OETHSupernovaAMOStrategy` | `Strategies.OETH_SUPERNOVA_AMO_STRATEGY` |
| `contracts/strategies/crosschain/CrossChainMasterStrategy.sol:CrossChainMasterStrategy` | `Strategies.CROSS_CHAIN_MASTER_STRATEGY` |
| `contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:CrossChainRemoteStrategy` | `Strategies.CROSS_CHAIN_REMOTE_STRATEGY` |
| `contracts/strategies/sonic/SonicStakingStrategy.sol:SonicStakingStrategy` | `Strategies.SONIC_STAKING_STRATEGY` |
| `contracts/strategies/sonic/SonicSwapXAMOStrategy.sol:SonicSwapXAMOStrategy` | `Strategies.SONIC_SWAPX_AMO_STRATEGY` |
| `contracts/token/OETH.sol:OETH` | `Tokens.OETH` |
| `contracts/token/OETHBase.sol:OETHBase` | `Tokens.OETH_BASE` |
| `contracts/token/OSonic.sol:OSonic` | `Tokens.OS` |
| `contracts/token/OUSD.sol:OUSD` | `Tokens.OUSD` |
| `contracts/token/WOETH.sol:WOETH` | `Tokens.WOETH` |
| `contracts/token/WOETHBase.sol:WOETHBase` | `Tokens.WOETH_BASE` |
| `contracts/token/WOETHPlume.sol:WOETHPlume` | `Tokens.WOETH_PLUME` |
| `contracts/token/WOSonic.sol:WOSonic` | `Tokens.WOSONIC` |
| `contracts/token/WrappedOusd.sol:WrappedOusd` | `Tokens.WRAPPED_OUSD` |
| `contracts/vault/OETHBaseVault.sol:OETHBaseVault` | `Vaults.OETH_BASE` |
| `contracts/vault/OETHVault.sol:OETHVault` | `Vaults.OETH` |
| `contracts/vault/OSVault.sol:OSVault` | `Vaults.OS` |
| `contracts/vault/OUSDVault.sol:OUSDVault` | `Vaults.OUSD` |
| `contracts/zapper/OETHBaseZapper.sol:OETHBaseZapper` | `Zappers.OETH_BASE_ZAPPER` |
| `contracts/zapper/OETHZapper.sol:OETHZapper` | `Zappers.OETH_ZAPPER` |
| `contracts/zapper/OSonicZapper.sol:OSonicZapper` | `Zappers.OS_ZAPPER` |
| `contracts/zapper/WOETHCCIPZapper.sol:WOETHCCIPZapper` | `Zappers.WOETH_CCIP_ZAPPER` |

### Notes on naming choices

- `Tokens.OS` and `Vaults.OS` follow the prompt's Sonic chain-disambiguation example.
- `Proxies.OS_PROXY`, `Proxies.OS_VAULT_PROXY`, and `Zappers.OS_ZAPPER` extend the same Sonic shorthand consistently.
- `Strategies.GENERALIZED_4626_STRATEGY` keeps the numeric marker explicit and readable.
- Existing constants to preserve:
  - `Tokens.OUSD`
  - `Vaults.OUSD`
  - `Proxies.IG_PROXY`

## 3. Sub-Agent Split Plan

Phase 2 only. Phase 1 remains single-writer and sequential because `Artifacts.sol` is shared by all future test-file migrations.

### Agent A

- Scope:
  - `tests/unit/vault/`
  - `tests/unit/token/`
- File count: 13

### Agent B

- Scope:
  - `tests/unit/strategies/`
- File count: 25

### Agent C

- Scope:
  - `tests/unit/poolBooster/`
  - `tests/unit/zapper/`
- File count: 22

### Agent D

- Scope:
  - `tests/unit/automation/`
  - `tests/unit/proxies/`
- File count: 11
- Special cleanup:
  - Remove the local `AUTO_WITHDRAWAL_MODULE_ARTIFACT` constant from `tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol`
  - Replace its uses with `Automation.AUTO_WITHDRAWAL_MODULE`

### Agent E

- Scope:
  - `tests/fork/mainnet/`
- File count: 8

### Agent F

- Scope:
  - `tests/fork/base/`
  - `tests/fork/sonic/`
  - `tests/fork/hyperevm/`
- File count: 6
- Note:
  - `tests/fork/hyperevm/` currently has zero in-scope files with `vm.deployCode(`

### Shared Phase 2 instructions for every agent

- Only modify `vm.deployCode("contracts/...sol:Name", ...)` call sites and add the necessary `import { ... } from "tests/utils/Artifacts.sol";` line.
- Use `tests/unit/vault/OUSDVault/shared/Shared.t.sol` as the canonical import-placement example.
- Put the `Artifacts.sol` import in a `// --- Test utilities` section between `// --- Test base` and `// --- External libraries`.
- Do not edit `tests/utils/Artifacts.sol`.
- Do not change function bodies, assertions, constructor args, control flow, test names, or unrelated formatting.
- If an artifact path is missing from `Artifacts.sol`, stop and report it instead of inventing a new constant locally.

## 4. Verification Plan

All commands run from `contracts/`.

### Before Phase 2

Capture the full-suite baseline once, after `Artifacts.sol` is populated and before parallel test-file edits:

```bash
forge test
```

Record the passing-test summary line for comparison after Phase 3.

### After Phase 1

```bash
pnpm prettier:sol
forge build
```

Expectation: clean compilation after adding the full constant registry to `tests/utils/Artifacts.sol`.

### After each Phase 2 agent scope

Run formatting once for the Solidity edits made in that scope:

```bash
pnpm prettier:sol
forge build
```

Then run the smallest relevant test commands for that scope:

#### Agent A

```bash
forge test --match-path "tests/unit/vault/**/*.t.sol"
forge test --match-path "tests/unit/token/**/*.t.sol"
```

#### Agent B

```bash
forge test --match-path "tests/unit/strategies/**/*.t.sol"
```

#### Agent C

```bash
forge test --match-path "tests/unit/poolBooster/**/*.t.sol"
forge test --match-path "tests/unit/zapper/**/*.t.sol"
```

#### Agent D

```bash
forge test --match-path "tests/unit/automation/**/*.t.sol"
forge test --match-path "tests/unit/proxies/**/*.t.sol"
```

#### Agent E

```bash
forge test --match-path "tests/fork/mainnet/**/*.t.sol"
```

#### Agent F

```bash
forge test --match-path "tests/fork/base/**/*.t.sol"
forge test --match-path "tests/fork/sonic/**/*.t.sol"
```

No `fork/hyperevm` command is needed because there are no in-scope files there.

### After Phase 3

```bash
forge build
forge fmt tests/
forge test
grep -rn '"contracts/[^"]*\.sol:[A-Za-z0-9_]*"' tests/ | grep -v "tests/utils/Artifacts.sol"
```

Success criteria:

- `forge build` passes with no new warnings.
- `forge fmt tests/` is a no-op or only shortens newly-updated lines.
- `forge test` finishes with the same passing-test count captured before Phase 2.
- The final grep returns no in-scope inline artifact-path strings. The only acceptable remaining matches are:
  - `tests/utils/Artifacts.sol`
  - `tests/README.md`
  - the two verified smoke-test files if the grep is not restricted away from `tests/smoke/`

## Planned execution order after plan approval

1. Phase 1: extend `tests/utils/Artifacts.sol` in one sequential pass.
2. Verify with `pnpm prettier:sol` and `forge build`.
3. Phase 2: run Agents A-F in parallel against disjoint directory scopes.
4. Integrate and re-run formatting plus scoped verification.
5. Phase 3: full-suite verification and final sanity grep.
6. Phase 4: commit using `refactor(test): ...` without `--no-verify`.
