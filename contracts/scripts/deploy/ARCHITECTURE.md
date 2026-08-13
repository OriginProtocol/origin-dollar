# Deployment Framework

A Foundry-based deployment framework that orchestrates smart contract deployments
across Ethereum Mainnet, Sonic, Base, and HyperEVM. It tracks deployment history
in JSON, resolves cross-script contract addresses via an in-memory registry,
builds and simulates governance actions on forks, and produces ready-to-submit
calldata for real deployments.

> [README.md](./README.md) is the canonical operator quick-start. This document
> explains framework internals. Where a command or supported-chain statement
> conflicts with the Makefile, `foundry.toml`, or implementation, the source file
> is authoritative.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Concepts](#core-concepts)
  - [Resolver](#resolver)
  - [Deployment State](#deployment-state)
  - [Sentinel Values](#sentinel-values)
  - [Alphabetical JSON Decoding](#alphabetical-json-decoding)
- [Execution Flow](#execution-flow)
  - [DeployManager.setUp()](#deploymanagersetup)
  - [DeployManager.run()](#deploymanagerrun)
  - [The 10-Step Script Lifecycle](#the-10-step-script-lifecycle)
  - [Post-Deployment Serialization](#post-deployment-serialization)
- [Governance](#governance)
  - [Building Proposals](#building-proposals)
  - [Proposal ID Computation](#proposal-id-computation)
  - [Fork Simulation](#fork-simulation)
  - [Real Deployment Output](#real-deployment-output)
  - [The Governance State Machine](#the-governance-state-machine)
- [Governance Metadata Maintenance](#governance-metadata-maintenance)
- [Deployment History (JSON Format)](#deployment-history-json-format)
- [Creating a New Deployment Script](#creating-a-new-deployment-script)
  - [Naming Convention](#naming-convention)
  - [Template](#template)
  - [Virtual Hooks](#virtual-hooks)
  - [Resolver Usage Patterns](#resolver-usage-patterns)
- [Integration with Tests](#integration-with-tests)
  - [Smoke Tests](#smoke-tests)
  - [Fork Tests](#fork-tests)
- [Running Deployments](#running-deployments)
- [Environment Variables](#environment-variables)
- [CI Integration](#ci-integration)
- [Design Patterns and Tips](#design-patterns-and-tips)

---

## Architecture Overview

```
scripts/deploy/
├── DeployManager.s.sol                  # Orchestrator — discovers, filters, and runs scripts
├── Base.s.sol                           # Shared infrastructure (VM, Resolver, chain config)
├── helpers/
│   ├── AbstractDeployScript.s.sol       # Base class for all deployment scripts
│   ├── DeploymentTypes.sol              # Shared types (State, Contract, Execution, GovProposal)
│   ├── GovHelper.sol                    # Governance proposal building, encoding, simulation
│   ├── Logger.sol                       # ANSI-styled console logging
│   ├── Resolver.sol                     # Contract address registry (vm.etched singleton)
├── mainnet/                             # Ethereum Mainnet scripts (001_, 002_, ...)
│   └── 000_Example.s.sol               # Reference template (skip = true)
├── sonic/                               # Sonic chain scripts
├── base/                                # Base scripts
└── hyperevm/                            # HyperEVM scripts
```

**High-level flow:**

```
                    ┌──────────────────┐
                    │   DeployManager  │
                    │     setUp()      │
                    └────────┬─────────┘
                             │  detect state, create fork file, etch Resolver
                             ▼
                    ┌──────────────────┐
                    │   DeployManager  │
                    │      run()       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       _preDeployment   vm.readDir()   _postDeployment
       JSON → Resolver  discover &     Resolver → JSON
                        sort scripts
                             │
                    ┌────────┴────────┐
                    │  for each file  │
                    └────────┬────────┘
                             │
                    _canSkipDeployFile?
                       │           │
                      yes          no
                       │           │
                     skip    vm.deployCode
                             _runDeployFile
                                  │
                          AbstractDeployScript
                              .run()
                         (10-step lifecycle)
```

---

## Core Concepts

### Resolver

The `Resolver` (`helpers/Resolver.sol`) is the central in-memory registry that all deployment scripts share. It stores three domains of data:

| Domain | Purpose | Access Pattern |
|--------|---------|----------------|
| **Contracts** | Maps names → addresses (e.g., `"OUSD_PROXY"` → `0x85B7...`) | `resolver.resolve("OUSD_PROXY")` |
| **Executions** | Tracks which scripts ran and their governance metadata | `resolver.executionExists("003_UpgradeVault")` |
| **State** | Current deployment mode (fork test, simulation, real) | `resolver.getState()` |

**How it works:**

The Resolver is deployed at a *deterministic address* computed from `keccak256("Resolver")`. DeployManager uses `vm.etch()` to place the compiled Resolver bytecode at this address before any script runs. Because the address is derived from a fixed hash, every contract in the inheritance chain (`Base`, `AbstractDeployScript`, any concrete script) can reference the same `Resolver` instance without passing addresses around:

```solidity
// In Base.s.sol — same line inherited by every script
Resolver internal resolver = Resolver(address(uint160(uint256(keccak256("Resolver")))));
```

**O(1) lookups:** The Resolver maintains both a `Contract[]` array (for JSON serialization) and a `mapping(string => address)` (for instant lookups). A `Position` struct tracks each contract's index in the array, enabling in-place updates when a contract is re-registered (e.g., after an upgrade deploys a new implementation).

**Reverts on unknown names:** `resolver.resolve("TYPO")` reverts with `Resolver: unknown contract "TYPO"`, catching misspelled names immediately rather than silently returning `address(0)`.

### Deployment State

The `State` enum controls framework behavior — whether transactions are broadcast or pranked, whether governance is simulated or output as calldata, and whether logging is active.

```solidity
enum State {
    DEFAULT,         // Initial state, never active during execution (reverts if reached)
    FORK_TEST,       // forge test / forge coverage / forge snapshot
    FORK_DEPLOYING,  // forge script (without --broadcast) — dry-run simulation
    REAL_DEPLOYING   // forge script --broadcast — real on-chain deployment
}
```

State is auto-detected in `DeployManager.setState()` via Foundry's `vm.isContext()`:

| Forge Context | State | Broadcast? | Governance | Logging |
|--------------|-------|------------|------------|---------|
| `TestGroup` (test, coverage, snapshot) | `FORK_TEST` | `vm.prank` | Simulated end-to-end | Off (unless `forcedLog`) |
| `ScriptDryRun` (script, no `--broadcast`) | `FORK_DEPLOYING` | `vm.prank` | Simulated end-to-end | On |
| `ScriptBroadcast` / `ScriptResume` | `REAL_DEPLOYING` | `vm.broadcast` | Calldata output only | On |

The `DEFAULT` state exists as a zero-value guard. If `setState()` cannot match any Forge context, the framework reverts with `"Unable to determine deployment state"`.

### Sentinel Values

Two constants in `DeploymentTypes.sol` act as sentinel values for governance metadata:

```solidity
uint256 constant NO_GOVERNANCE = 1;       // Script needs no governance action
uint256 constant GOVERNANCE_PENDING = 0;  // Governance not yet submitted/executed (default)
```

**Why `1` instead of `0`?** The default `uint256` value is `0`, which naturally represents "pending/unknown." A sentinel of `0` would be indistinguishable from an uninitialized field. Using `1` works because:

- A real `proposalId` is a `keccak256` hash — effectively never `1`
- A real `tsGovernance` timestamp is a Unix epoch — `1` corresponds to January 1, 1970, which will never be a governance execution time

Both `proposalId` and `tsGovernance` use the same sentinel: `NO_GOVERNANCE = 1` means "complete, no governance needed" while `GOVERNANCE_PENDING = 0` means "waiting for governance submission or execution."

### Alphabetical JSON Decoding

Foundry's `vm.parseJson()` returns struct fields in **alphabetical order by JSON key**, regardless of the struct's declaration order. When you decode with `abi.decode(vm.parseJson(json), (MyStruct))`, the ABI decoder maps fields positionally — first parsed field to first struct field, etc.

This means struct fields **must be declared in alphabetical order** to match the JSON key ordering:

```solidity
struct Execution {
    string name;          // "n" comes first alphabetically
    uint256 proposalId;   // "p" comes second
    uint256 tsDeployment; // "tsD" comes third
    uint256 tsGovernance; // "tsG" comes fourth
}
```

If you reorder fields (e.g., move `proposalId` before `name`), the decoded values silently swap — a pernicious bug with no compiler warning. The same applies to the `Contract` struct (`implementation` before `name`) and the `Root` struct (`contracts` before `executions`).

---

## Execution Flow

### DeployManager.setUp()

`setUp()` runs automatically before `run()` (Forge convention). It establishes the execution environment:

1. **State detection** — Calls `setState()` which uses `vm.isContext()` to determine `FORK_TEST`, `FORK_DEPLOYING`, or `REAL_DEPLOYING`.

2. **Logging setup** — Enables logging for `FORK_DEPLOYING` and `REAL_DEPLOYING`. Suppresses for `FORK_TEST` (smoke tests run silently) unless `forcedLog` is set.

3. **Deployment JSON** — Reads the chain-specific file (e.g., `build/deployments-1.json`). If it doesn't exist, creates one with empty arrays: `{"contracts": [], "executions": []}`.

4. **Fork file isolation** — For `FORK_TEST` and `FORK_DEPLOYING`, copies the deployment JSON to a temporary fork file (`build/deployments-fork-{timestamp}.json`). All writes during the session go to this copy, leaving the real deployment history untouched.

5. **Resolver deployment** — Calls `deployResolver()` which uses `vm.etch()` to place compiled Resolver bytecode at the deterministic address, then initializes it with the current state.

### DeployManager.run()

`run()` is the main deployment loop:

#### 1. `_preDeployment()` — JSON to Resolver

Parses the deployment JSON into a `Root` struct and loads it into the Resolver:

- **Contracts:** Each `{name, implementation}` pair is registered via `resolver.addContract()`.
- **Executions:** Each record is loaded with **timestamp filtering**:
  - If `tsDeployment > block.timestamp` → skip entirely (this deployment doesn't exist yet at the current fork block)
  - If `tsGovernance > block.timestamp` → zero it out (governance hasn't executed yet at this fork point)

This filtering enables **historical fork replay**: set `FORK_BLOCK_NUMBER_MAINNET` to an old block and the framework automatically excludes deployments that happened after that block.

#### 2. Script Discovery

Determines the script folder based on chain ID:
- Chain `1` → `scripts/deploy/mainnet/`
- Chain `146` → `scripts/deploy/sonic/`
- Chain `8453` → `scripts/deploy/base/`
- Chain `999` → `scripts/deploy/hyperevm/`

Reads all files via `vm.readDir()`, which returns entries in alphabetical order. This is why scripts use numeric prefixes (`001_`, `002_`, ...) — it guarantees execution order.

#### 3. `_canSkipDeployFile()` — The Skip Decision Tree

Before compiling each script, a lightweight check determines if it can be skipped entirely (avoiding the cost of `vm.deployCode`):

| executionExists? | proposalId | tsGovernance | block.timestamp ≥ tsGovernance? | Result |
|:---:|:---:|:---:|:---:|:---|
| No | — | — | — | **Cannot skip** (never deployed) |
| Yes | `NO_GOVERNANCE (1)` | — | — | **Skip** (deployed, no governance needed) |
| Yes | `0` | — | — | **Cannot skip** (governance pending) |
| Yes | `> 1` | `0` | — | **Cannot skip** (governance not yet executed) |
| Yes | `> 1` | `> 0` | No | **Cannot skip** (governance executed after current block) |
| Yes | `> 1` | `> 0` | Yes | **Skip** (fully complete at this block) |

#### 4. `_runDeployFile()` — Per-Script State Machine

For scripts that pass the skip check, DeployManager compiles them via `vm.deployCode()` and runs them through a 5-case decision tree:

| Case | Condition | Action |
|------|-----------|--------|
| 1 | `skip() == true` | Return immediately |
| 2 | Not in execution history | Call `deployFile.run()` (full 10-step lifecycle) |
| 3 | In history, `proposalId == NO_GOVERNANCE` | Return (fully complete) |
| 4 | In history, `proposalId == 0` | Call `handleGovernanceProposal()` (re-simulate) |
| 5 | In history, `proposalId > 1`, governance not yet executed | Call `handleGovernanceProposal()` |

Cases 4 and 5 handle the scenario where contracts were deployed but governance hasn't executed yet. The script rebuilds and re-simulates the proposal to verify it still works against current state.

### The 10-Step Script Lifecycle

When `_runDeployFile()` calls `deployFile.run()` (Case 2 above), the `AbstractDeployScript.run()` method executes the complete deployment lifecycle:

```
Step 1:  Get state from Resolver
Step 2:  Load deployer address from DEPLOYER_ADDRESS env var
Step 3:  Start transaction context (vm.startBroadcast or vm.startPrank)
Step 4:  Execute _execute() — child contract's deployment logic
Step 5:  Stop transaction context (vm.stopBroadcast or vm.stopPrank)
Step 6:  Persist deployed contracts to Resolver (_storeContracts)
Step 7:  Build governance proposal (_buildGovernanceProposal)
Step 8:  Record execution in Resolver (_recordExecution)
Step 9:  Handle governance (simulate on fork, output calldata on real)
Step 10: Run _fork() for post-deployment verification (fork modes only)
```

**The two-phase contract registration pattern (Steps 4→6):**

During Step 4 (`_execute()`), contracts are deployed inside a broadcast/prank context. Each deployment is recorded locally via `_recordDeployment(name, address)`, which pushes to a `Contract[]` array on the script instance. These are *not* yet in the Resolver.

After Step 5 stops the transaction context, Step 6 (`_storeContracts()`) iterates the local array and registers each contract in the Resolver. This separation is necessary because the Resolver lives outside the broadcast context — calls to it are cheatcode-level operations, not on-chain transactions.

**Governance metadata recording (Step 8):**

`_recordExecution()` runs *after* `_buildGovernanceProposal()` so it can inspect `govProposal.actions.length`:
- If 0 actions → `proposalId = NO_GOVERNANCE`, `tsGovernance = NO_GOVERNANCE`
- If > 0 actions → `proposalId = GOVERNANCE_PENDING (0)`, `tsGovernance = GOVERNANCE_PENDING (0)`

### Post-Deployment Serialization

`_postDeployment()` reads all data from the Resolver and writes it back to the deployment JSON file:

1. Fetches `resolver.getContracts()` and `resolver.getExecutions()`
2. Serializes each entry using Foundry's `vm.serializeString` / `vm.serializeUint` / `vm.serializeAddress` cheatcodes
3. Writes the final JSON to the appropriate file (fork file or real deployment file)

---

## Governance

### Building Proposals

Deployment scripts define governance actions by overriding `_buildGovernanceProposal()`:

```solidity
function _buildGovernanceProposal() internal override {
    govProposal.setDescription("Upgrade OUSD implementation");

    govProposal.action(
        resolver.resolve("OUSD_PROXY"),
        "upgradeTo(address)",
        abi.encode(resolver.resolve("OUSD_IMPL"))
    );
}
```

**`GovProposal`** contains a `description` (string) and an array of `GovAction` structs, each with:
- `target` — contract address to call
- `value` — ETH to send (usually 0)
- `fullsig` — function signature (e.g., `"upgradeTo(address)"`)
- `data` — ABI-encoded parameters (without selector)

### Governance ID Computation

On Mainnet, `GovHelper.id()` computes the proposal ID identically to the on-chain OpenZeppelin Governor contract:

```solidity
proposalId = uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
```

Where `calldatas[i] = abi.encodePacked(bytes4(keccak256(bytes(signature))), data)`.

On Base and HyperEVM, `GovHelper.operationId()` computes the TimelockController batch hash using the encoded actions, a zero predecessor, and `keccak256(description)` as the deterministic salt. `buildGovernanceProposal()` returns the chain-appropriate identifier as a `uint256`.

These deterministic computations let deployment reruns recognize governance that was already submitted or executed.

### Fork Simulation

In `FORK_TEST` and `FORK_DEPLOYING` modes, `GovHelper.simulate()` dispatches by chain. Mainnet executes the full Governor lifecycle:

| Stage | Action | Time Manipulation |
|-------|--------|-------------------|
| **1. Create** | `vm.prank(govMultisig)` → `governance.propose(...)` | — |
| **2. Wait** | Fast-forward past voting delay | `vm.roll(+votingDelay+1)`, `vm.warp(+1min)` |
| **3. Vote** | `vm.prank(govMultisig)` → `governance.castVote(id, 1)` | `vm.roll(+deadline+20)`, `vm.warp(+2days)` |
| **4. Queue** | `vm.prank(govMultisig)` → `governance.queue(id)` | — |
| **5. Execute** | Fast-forward past timelock → `governance.execute(id)` | `vm.roll(+10)`, `vm.warp(eta+20)` |

If any stage fails, the script reverts — catching governance proposal bugs before they reach mainnet.

Base and HyperEVM use the chain-local TimelockController and governance Safe:

| Existing operation state | Fork behavior |
|--------------------------|---------------|
| Absent | Schedule with `getMinDelay()`, advance to the operation timestamp, then execute |
| Scheduled but not ready | Advance to the operation timestamp, then execute |
| Ready | Execute immediately |
| Done | Return without replaying the actions |

The TimelockController predecessor is zero and the description-derived salt must remain unchanged between submission and reruns.

### Real Deployment Output

In `REAL_DEPLOYING` mode, `GovHelper.logProposalData()`:
1. On Mainnet, verifies the proposal doesn't already exist and outputs `propose()` calldata.
2. On Base and HyperEVM, outputs both `scheduleBatch()` and `executeBatch()` for a new operation, only `executeBatch()` for an existing scheduled operation, and nothing for a completed operation.

### The Governance State Machine

For each execution in the deployment history, the combination of `proposalId` and `tsGovernance` determines the governance state:

| `proposalId` | `tsGovernance` | Meaning | Framework Behavior |
|:---:|:---:|---|---|
| `0` | `0` | Governance pending (not yet submitted) | Re-simulate proposal |
| `1` (NO_GOVERNANCE) | `1` (NO_GOVERNANCE) | No governance needed | Skip entirely |
| `> 1` | `0` | Proposal submitted, not yet executed | Re-simulate proposal |
| `> 1` | `> 1` | Proposal executed at timestamp | Skip if `block.timestamp >= tsGovernance` |

---

## Governance Metadata Maintenance

The metadata updater is not currently active. The Makefile contains only a
commented placeholder for `update-deployments`, and there is no
`update-deployments.yml` workflow. Proposal IDs and governance execution
timestamps therefore require explicit maintenance in the reviewed deployment
process.

---

## Deployment History (JSON Format)

Deployment history is stored in chain-specific JSON files:

| File | Chain |
|------|-------|
| `build/deployments-1.json` | Ethereum Mainnet |
| `build/deployments-146.json` | Sonic |
| `build/deployments-8453.json` | Base |
| `build/deployments-999.json` | HyperEVM |
| `build/deployments-fork-{timestamp}.json` | Temporary fork files (ignored by git) |

### Schema

```json
{
  "contracts": [
    {
      "implementation": "0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6",
      "name": "OUSD_PROXY"
    },
    {
      "implementation": "0xC0297a0E39031F09406F0987C9D9D41c5dfbc3df",
      "name": "OUSD_IMPL"
    }
  ],
  "executions": [
    {
      "name": "001_CoreMainnet",
      "proposalId": 1,
      "tsDeployment": 1723685111,
      "tsGovernance": 1
    },
    {
      "name": "007_UpgradeLidoARMMorphoScript",
      "proposalId": 59265604807181750059374521697037203647325806747129712398293966379088988710865,
      "tsDeployment": 1754407535,
      "tsGovernance": 1755065999
    }
  ]
}
```

### Field Reference

**Contracts:**
- `name` — Unique identifier in `UPPER_SNAKE_CASE` (e.g., `"OUSD_PROXY"`, `"OUSD_IMPL"`)
- `implementation` — Deployed address. For proxies, this is the proxy address. Implementation addresses use a `_IMPL` suffix.

**Executions:**
- `name` — Script name matching the file/contract/constructor (e.g., `"007_UpgradeLidoARMMorphoScript"`)
- `tsDeployment` — Unix timestamp of the block when the script was deployed
- `proposalId` — `0` = governance pending, `1` = no governance needed, `> 1` = on-chain Governor proposal ID
- `tsGovernance` — `0` = governance not yet executed, `1` = no governance needed, `> 1` = Unix timestamp of governance execution

---

## Creating a New Deployment Script

### Naming Convention

All three identifiers **must match exactly** — if they drift, the script will either fail to load or track execution under the wrong name:

| Component | Format | Example |
|-----------|--------|---------|
| **File** | `NNN_DescriptiveName.s.sol` | `017_UpgradeVault.s.sol` |
| **Contract** | `$NNN_DescriptiveName` (prefixed with `$`) | `$017_UpgradeVault` |
| **Constructor arg** | `"NNN_DescriptiveName"` (no `$`, no `.s.sol`) | `"017_UpgradeVault"` |

**Why they must match:** DeployManager constructs the artifact path as `out/{name}.s.sol/${name}.json` from the filename. If the contract name inside the file differs, `vm.deployCode()` fails. The constructor argument becomes the script's `name` property, used for execution history lookups — if it differs from the filename, the skip logic breaks.

### Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

contract $017_UpgradeVault is AbstractDeployScript("017_UpgradeVault") {
    using GovHelper for GovProposal;

    // Set to true to skip this script
    bool public constant override skip = false;

    function _execute() internal override {
        // 1. Get previously deployed contracts
        address proxy = resolver.resolve("OUSD_VAULT_PROXY");

        // 2. Deploy new contracts
        MyImpl impl = new MyImpl();

        // 3. Register deployments
        _recordDeployment("OUSD_VAULT_IMPL", address(impl));
    }

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription("Upgrade OUSD Vault");

        address proxy = resolver.resolve("OUSD_VAULT_PROXY");
        address impl = resolver.resolve("OUSD_VAULT_IMPL");

        govProposal.action(proxy, "upgradeTo(address)", abi.encode(impl));
    }

    function _fork() internal override {
        // Post-deployment verification (runs after governance simulation)
    }
}
```

See `mainnet/000_Example.s.sol` for a comprehensive, fully-commented template.

### Virtual Hooks

| Hook | Purpose | When Called |
|------|---------|------------|
| `_execute()` | Deploy contracts. Runs inside broadcast/prank context. Use `_recordDeployment()` to register new contracts. | Step 4 of lifecycle |
| `_buildGovernanceProposal()` | Define governance actions via `govProposal.setDescription()` and `govProposal.action()`. Leave empty if no governance needed. | Step 7 of lifecycle |
| `_fork()` | Post-deployment verification. Runs after governance simulation. Only called in fork modes. | Step 10 of lifecycle |
| `skip()` | Return `true` to skip this script entirely. | Checked by `_runDeployFile()` before execution |

### Resolver Usage Patterns

```solidity
// Look up a previously deployed contract (reverts if not found)
address proxy = resolver.resolve("OUSD_PROXY");

// Register a newly deployed contract
_recordDeployment("MY_CONTRACT", address(myContract));

// Check if a script was previously executed
bool ran = resolver.executionExists("003_UpgradeVault");

// Contracts registered with _recordDeployment become available
// to subsequent scripts via resolver.resolve()
```

---

## Integration with Tests

### Smoke Tests

Smoke tests use the deployment framework through `BaseSmoke`. A chain-specific
shared test creates and selects its fork, then calls `_igniteDeployManager()`:

```solidity
function setUp() public virtual override {
    super.setUp();
    _createAndSelectForkMainnet();
    _igniteDeployManager();
    _fetchContracts();
}
```

After setup, smoke test contracts access deployed addresses via the Resolver.
This ensures every smoke test runs against the full deployment state — including
pending scripts that have not yet been deployed to the target chain.

### Fork Tests

Fork tests (`tests/fork/`) are independent of DeployManager and Resolver. Most
deploy Origin contracts fresh against real external protocols; tests whose
purpose depends on deployed configuration may bind to live Origin addresses.

### Pinned-Block Testing

Set the applicable `FORK_BLOCK_NUMBER_MAINNET`, `FORK_BLOCK_NUMBER_BASE`,
`FORK_BLOCK_NUMBER_ARBITRUM`, or `FORK_BLOCK_NUMBER_HYPEREVM` variable to pin a
fork. Timestamp filtering in `_preDeployment()` excludes later deployments and
governance executions.

---

## Running Deployments

### Simulate (Dry Run)

```bash
# Mainnet simulation (FORK_DEPLOYING state)
make simulate

# Base or HyperEVM simulation
make simulate NETWORK=base
make simulate NETWORK=hyperevm
```

Simulation runs the full pipeline with `vm.prank` instead of `vm.broadcast`. Governance proposals are simulated end-to-end. Writes go to a temporary fork file.

### Deploy

```bash
# Ethereum Mainnet
make deploy-mainnet

# Base and HyperEVM
make deploy-base
make deploy-hyperevm

# Local Anvil node
make deploy-local

```

Private keys are managed via Foundry's encrypted keystore: `cast wallet import deployerKey --interactive`.

### Makefile Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEPLOY_SCRIPT` | `scripts/deploy/DeployManager.s.sol` | Entry point script |
| `DEPLOY_BASE` | `--account deployerKey --sender $(DEPLOYER_ADDRESS) --broadcast --slow` | Common deployment flags |
| `NETWORK` | `mainnet` | Target network for `make simulate` |

---

## Environment Variables

Copy `dev.env` to `.env` and fill in the required values.

| Variable | Required For | Purpose |
|----------|-------------|---------|
| `MAINNET_PROVIDER_URL` | Mainnet fork tests, smoke tests, deploy, simulate | Ethereum RPC endpoint |
| `BASE_PROVIDER_URL` | Base fork tests, smoke tests, deploy, simulate | Base RPC endpoint |
| `ARBITRUM_PROVIDER_URL` | Arbitrum fork tests | Arbitrum RPC endpoint |
| `HYPEREVM_PROVIDER_URL` | HyperEVM fork tests, smoke tests, deploy, simulate | HyperEVM RPC endpoint |
| `DEPLOYER_ADDRESS` | All real deployments | Must match the `deployerKey` wallet |
| `ETHERSCAN_API_KEY` | Mainnet deploy (`--verify`) | Contract verification on Etherscan |
| `FORK_BLOCK_NUMBER_MAINNET` | Optional | Pin fork to specific block for deterministic testing |
| `FORK_BLOCK_NUMBER_BASE` | Optional | Pin Base fork to a specific block |
| `FORK_BLOCK_NUMBER_ARBITRUM` | Optional | Pin Arbitrum fork to a specific block |
| `FORK_BLOCK_NUMBER_HYPEREVM` | Optional | Pin HyperEVM fork to a specific block |
| `LOCAL_URL` | Local Anvil deploy | Local node endpoint |

---

## CI Integration

### Composite Setup Action

`.github/actions/foundry-setup/action.yml` provides a reusable environment setup:
1. Install Foundry.
2. Cache and install Soldeer dependencies.
3. Set up pnpm and Node.js, then install the contract workspace dependencies.
4. Cache Forge build artifacts and build the contracts.

### CI Jobs (`.github/workflows/foundry.yml`)

| Job | Trigger | Uses Deployment Framework? |
|-----|---------|--------------------------|
| **fmt** | PRs, pushes (not schedule) | No |
| **build** | PRs, pushes (not schedule) | No |
| **unit-tests** | PRs, pushes (not schedule) | No |
| **fork-tests-mainnet/base/hyperevm** | All workflow triggers | No (mostly deploy from scratch) |
| **smoke-tests-mainnet/base/hyperevm** | All workflow triggers | Yes (bootstraps DeployManager) |
| **slither**, **snyk** | PRs, pushes (not schedule) | No |

---

## Design Patterns and Tips

1. **Fork file isolation** — Fork tests and simulations write to `build/deployments-fork-{timestamp}.json`, never touching the real deployment history. Use `make clean` to delete leftover fork files.

2. **Two-phase contract registration** — Contracts are recorded locally during `_execute()` (inside broadcast) and persisted to the Resolver after broadcast stops. This is necessary because the Resolver is a cheatcode-level construct, not an on-chain contract.

3. **Alphabetical struct field ordering** — All structs decoded from JSON (`Root`, `Contract`, `Execution`) must have fields in alphabetical order. See [Alphabetical JSON Decoding](#alphabetical-json-decoding).

4. **`pauseTracing` modifier** — Wraps expensive operations (JSON I/O, Resolver setup) with `vm.pauseTracing()` / `vm.resumeTracing()` to reduce noise in Forge trace output. Defined in `Base.s.sol`.

5. **Logger suppression via `using Logger for bool`** — The `Logger` library uses `bool` as its receiver type. Every log function checks `if (!log) return;` first, making logging a no-op in `FORK_TEST` mode without conditional wrappers at every call site.

6. **Test with fork first** — Always run `make simulate` before real deployments to verify the full pipeline.

7. **Scripts are processed in order** — Name files with numeric prefixes (`001_`, `002_`, etc.). `vm.readDir()` returns entries alphabetically.

8. **All scripts are evaluated** — Fully completed scripts are skipped automatically based on timestamp metadata. No manual tuning needed.

9. **Historical fork replay** — Set `FORK_BLOCK_NUMBER_MAINNET` to a historical block and the framework will only replay deployments that existed at that point, skipping future ones.

10. **Adding a new chain** — Add the chain ID → name mapping in `Base.s.sol`, create a directory under `scripts/deploy/`, add routing in `DeployManager.run()`, then add the RPC alias, Makefile targets, and CI coverage as appropriate.

11. **Use descriptive contract names** — Names like `OUSD_IMPL` are clearer than `IMPL_V2`.

12. **Reference the example** — See `mainnet/000_Example.s.sol` for a comprehensive, fully-commented template.
