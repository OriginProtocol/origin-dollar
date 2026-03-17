# Deployment Framework

A Foundry-based deployment framework that orchestrates smart contract deployments across Ethereum Mainnet and Sonic. It tracks deployment history in JSON, resolves cross-script contract addresses via an in-memory registry, builds and simulates governance proposals end-to-end on forks, and produces ready-to-submit calldata for real deployments — all driven by numbered scripts that are automatically discovered, ordered, and replayed.

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
- [Automated Governance Tracking](#automated-governance-tracking)
  - [UpdateGovernanceMetadata.s.sol](#updategovernancemetadatassol)
  - [find_gov_prop_execution_timestamp.sh](#find_gov_prop_execution_timestampsh)
  - [CI Workflow](#ci-workflow-update-deployments)
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
script/deploy/
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
└── sonic/                               # Sonic chain scripts
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
| **Contracts** | Maps names → addresses (e.g., `"LIDO_ARM"` → `0x85B7...`) | `resolver.resolve("LIDO_ARM")` |
| **Executions** | Tracks which scripts ran and their governance metadata | `resolver.executionExists("005_RegisterLido...")` |
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
- Chain `1` → `script/deploy/mainnet/`
- Chain `146` → `script/deploy/sonic/`

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
    govProposal.setDescription("Upgrade LidoARM to v2");

    govProposal.action(
        resolver.resolve("LIDO_ARM"),
        "upgradeTo(address)",
        abi.encode(resolver.resolve("LIDO_ARM_IMPL"))
    );
}
```

**`GovProposal`** contains a `description` (string) and an array of `GovAction` structs, each with:
- `target` — contract address to call
- `value` — ETH to send (usually 0)
- `fullsig` — function signature (e.g., `"upgradeTo(address)"`)
- `data` — ABI-encoded parameters (without selector)

### Proposal ID Computation

`GovHelper.id()` computes the proposal ID identically to the on-chain OpenZeppelin Governor contract:

```solidity
proposalId = uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
```

Where `calldatas[i] = abi.encodePacked(bytes4(keccak256(bytes(signature))), data)`.

This deterministic computation is critical — it allows `UpdateGovernanceMetadata` to compute the proposal ID off-chain and match it against on-chain events.

### Fork Simulation

In `FORK_TEST` and `FORK_DEPLOYING` modes, `GovHelper.simulate()` executes the full Governor lifecycle:

| Stage | Action | Time Manipulation |
|-------|--------|-------------------|
| **1. Create** | `vm.prank(govMultisig)` → `governance.propose(...)` | — |
| **2. Wait** | Fast-forward past voting delay | `vm.roll(+votingDelay+1)`, `vm.warp(+1min)` |
| **3. Vote** | `vm.prank(govMultisig)` → `governance.castVote(id, 1)` | `vm.roll(+deadline+20)`, `vm.warp(+2days)` |
| **4. Queue** | `vm.prank(govMultisig)` → `governance.queue(id)` | — |
| **5. Execute** | Fast-forward past timelock → `governance.execute(id)` | `vm.roll(+10)`, `vm.warp(eta+20)` |

If any stage fails, the script reverts — catching governance proposal bugs before they reach mainnet.

### Real Deployment Output

In `REAL_DEPLOYING` mode, `GovHelper.logProposalData()`:
1. Verifies the proposal doesn't already exist on-chain
2. Outputs the `propose()` calldata for manual submission to the Governor contract

### The Governance State Machine

For each execution in the deployment history, the combination of `proposalId` and `tsGovernance` determines the governance state:

| `proposalId` | `tsGovernance` | Meaning | Framework Behavior |
|:---:|:---:|---|---|
| `0` | `0` | Governance pending (not yet submitted) | Re-simulate proposal |
| `1` (NO_GOVERNANCE) | `1` (NO_GOVERNANCE) | No governance needed | Skip entirely |
| `> 1` | `0` | Proposal submitted, not yet executed | Re-simulate proposal |
| `> 1` | `> 1` | Proposal executed at timestamp | Skip if `block.timestamp >= tsGovernance` |

---

## Automated Governance Tracking

After a deployment, the JSON file initially has `proposalId = 0` and `tsGovernance = 0` for scripts with governance. Three components work together to fill these in automatically:

### UpdateGovernanceMetadata.s.sol

`script/automation/UpdateGovernanceMetadata.s.sol` is a standalone Forge script (not part of `DeployManager`) that updates `build/deployments-1.json`:

**Case A — `proposalId == 0` (pending):**
1. Deploys the original script via `vm.deployCode()`
2. Calls `buildGovernanceProposal()` → computes `GovHelper.id(govProposal)`
3. Checks if the proposal exists on-chain via `governance.proposalSnapshot(id) > 0`
4. If it exists, writes the `proposalId` and also checks for the execution timestamp

**Case B — `proposalId > 1` && `tsGovernance == 0` (submitted but not executed):**
1. Calls `find_gov_prop_execution_timestamp.sh` via FFI
2. If the proposal was executed, records the execution timestamp

**Manual JSON serialization:** This script builds JSON strings manually instead of using `vm.serializeUint` because Foundry quotes `uint256` values exceeding 2^53 as strings (a JavaScript number precision issue), which would break the expected all-numeric format for proposal IDs and timestamps.

### find_gov_prop_execution_timestamp.sh

`script/automation/find_gov_prop_execution_timestamp.sh` is called via FFI (Foundry's `vm.ffi()`) to query on-chain events:

1. Takes `proposalId`, `rpc_url`, `governor_address`, and `tsDeployment` as arguments
2. Converts the deployment timestamp to a block number via `cast find-block`
3. Queries `ProposalExecuted(uint256)` events from the Governor starting at that block
4. Matches the event data against the proposal ID
5. Returns the execution block's timestamp (ABI-encoded), or `0` if not yet executed

### CI Workflow (update-deployments)

`.github/workflows/update-deployments.yml` runs the metadata update automatically:

- **Schedule:** Every hour (`0 */1 * * *`)
- **Trigger:** Also available via `workflow_dispatch`
- **Steps:**
  1. Setup environment (Foundry + Soldeer)
  2. `forge build && forge script script/automation/UpdateGovernanceMetadata.s.sol --fork-url $MAINNET_URL -vvvv`
  3. If `build/deployments-*.json` changed, auto-commit and push

This creates a hands-off workflow: deploy contracts → submit governance proposal manually → CI detects the proposal ID and eventual execution timestamp automatically.

---

## Deployment History (JSON Format)

Deployment history is stored in chain-specific JSON files:

| File | Chain |
|------|-------|
| `build/deployments-1.json` | Ethereum Mainnet |
| `build/deployments-146.json` | Sonic |
| `build/deployments-fork-{timestamp}.json` | Temporary fork files (ignored by git) |

### Schema

```json
{
  "contracts": [
    {
      "implementation": "0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6",
      "name": "LIDO_ARM"
    },
    {
      "implementation": "0xC0297a0E39031F09406F0987C9D9D41c5dfbc3df",
      "name": "LIDO_ARM_IMPL"
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
- `name` — Unique identifier in `UPPER_SNAKE_CASE` (e.g., `"LIDO_ARM"`, `"ETHENA_ARM_IMPL"`)
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
| **File** | `NNN_DescriptiveName.s.sol` | `017_UpgradeLidoARM.s.sol` |
| **Contract** | `$NNN_DescriptiveName` (prefixed with `$`) | `$017_UpgradeLidoARM` |
| **Constructor arg** | `"NNN_DescriptiveName"` (no `$`, no `.s.sol`) | `"017_UpgradeLidoARM"` |

**Why they must match:** DeployManager constructs the artifact path as `out/{name}.s.sol/${name}.json` from the filename. If the contract name inside the file differs, `vm.deployCode()` fails. The constructor argument becomes the script's `name` property, used for execution history lookups — if it differs from the filename, the skip logic breaks.

### Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {AbstractDeployScript} from "script/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper, GovProposal} from "script/deploy/helpers/GovHelper.sol";

contract $017_UpgradeLidoARM is AbstractDeployScript("017_UpgradeLidoARM") {
    using GovHelper for GovProposal;

    // Set to true to skip this script
    bool public constant override skip = false;

    function _execute() internal override {
        // 1. Get previously deployed contracts
        address proxy = resolver.resolve("LIDO_ARM");

        // 2. Deploy new contracts
        MyImpl impl = new MyImpl();

        // 3. Register deployments
        _recordDeployment("LIDO_ARM_IMPL", address(impl));
    }

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription("Upgrade LidoARM");

        address proxy = resolver.resolve("LIDO_ARM");
        address impl = resolver.resolve("LIDO_ARM_IMPL");

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
address proxy = resolver.resolve("LIDO_ARM");

// Register a newly deployed contract
_recordDeployment("MY_CONTRACT", address(myContract));

// Check if a script was previously executed
bool ran = resolver.executionExists("005_RegisterLido...");

// Contracts registered with _recordDeployment become available
// to subsequent scripts via resolver.resolve()
```

---

## Integration with Tests

### Smoke Tests

Smoke tests use the deployment framework directly. `AbstractSmokeTest.setUp()` bootstraps the full deployment pipeline:

```solidity
abstract contract AbstractSmokeTest is Test {
    Resolver internal resolver = Resolver(address(uint160(uint256(keccak256("Resolver")))));
    DeployManager internal deployManager;

    function setUp() public virtual {
        // Create fork (optionally pinned to FORK_BLOCK_NUMBER_MAINNET)
        vm.createSelectFork(vm.envString("MAINNET_URL"));

        deployManager = new DeployManager();
        deployManager.setUp();  // → FORK_TEST state, etch Resolver
        deployManager.run();    // → replay all scripts, simulate governance
    }
}
```

After setup, smoke test contracts access deployed addresses via `resolver.resolve("LIDO_ARM")`. This ensures every smoke test runs against the full deployment state — including any pending scripts that haven't been deployed to mainnet yet.

### Fork Tests

Fork tests (`test/fork/`) are **independent** of the deployment framework. They deploy contracts from scratch against a forked chain, testing behavior in isolation. They do NOT use DeployManager or the Resolver.

### Pinned-Block Testing

Set `FORK_BLOCK_NUMBER_MAINNET` (or `FORK_BLOCK_NUMBER_SONIC`) to pin smoke tests to a specific block. The framework's timestamp filtering in `_preDeployment()` automatically excludes deployments and governance executions that happened after that block, producing a historically accurate state.

---

## Running Deployments

### Simulate (Dry Run)

```bash
# Mainnet simulation (FORK_DEPLOYING state)
make simulate

# Sonic simulation
make simulate NETWORK=sonic
```

Simulation runs the full pipeline with `vm.prank` instead of `vm.broadcast`. Governance proposals are simulated end-to-end. Writes go to a temporary fork file.

### Deploy

```bash
# Ethereum Mainnet (requires deployerKey wallet, DEPLOYER_ADDRESS, MAINNET_URL, ETHERSCAN_API_KEY)
make deploy-mainnet

# Sonic (requires deployerKey wallet, DEPLOYER_ADDRESS, SONIC_URL)
make deploy-sonic

# Local Anvil node
make deploy-local

# Tenderly testnet (uses --unlocked, no key needed)
make deploy-testnet
```

Private keys are managed via Foundry's encrypted keystore: `cast wallet import deployerKey --interactive`.

### Update Governance Metadata

```bash
# Run the metadata updater manually (requires MAINNET_URL)
make update-deployments
```

### Makefile Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEPLOY_SCRIPT` | `script/deploy/DeployManager.s.sol` | Entry point script |
| `DEPLOY_BASE` | `--account deployerKey --sender $(DEPLOYER_ADDRESS) --broadcast --slow` | Common deployment flags |
| `NETWORK` | `mainnet` | Target network for `make simulate` |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Required For | Purpose |
|----------|-------------|---------|
| `MAINNET_URL` | Fork tests, smoke tests, mainnet deploy, simulate | Ethereum RPC endpoint |
| `SONIC_URL` | Sonic fork tests, Sonic deploy | Sonic RPC endpoint |
| `DEPLOYER_ADDRESS` | All real deployments | Must match the `deployerKey` wallet |
| `ETHERSCAN_API_KEY` | Mainnet deploy (`--verify`) | Contract verification on Etherscan |
| `FORK_BLOCK_NUMBER_MAINNET` | Optional | Pin fork to specific block for deterministic testing |
| `FORK_BLOCK_NUMBER_SONIC` | Optional | Pin Sonic fork to specific block |
| `TESTNET_URL` | Tenderly testnet deploy | Tenderly RPC endpoint |
| `LOCAL_URL` | Local Anvil deploy | Local node endpoint |
| `DEFENDER_TEAM_KEY` | Defender Action management | OpenZeppelin Defender team API key |
| `DEFENDER_TEAM_SECRET` | Defender Action management | OpenZeppelin Defender team API secret |

---

## CI Integration

### Composite Setup Action

`.github/actions/setup/action.yml` provides a reusable environment setup:
1. Checkout with submodules
2. Install Foundry (stable, with cache)
3. Install Soldeer dependencies (with cache)
4. Optionally install Yarn dependencies (with cache)

### CI Jobs (`.github/workflows/main.yml`)

| Job | Trigger | Uses Deployment Framework? |
|-----|---------|--------------------------|
| **lint** | PRs, pushes (not schedule) | No |
| **build** | PRs, pushes (not schedule) | No |
| **unit-tests** | PRs, pushes (not schedule) | No |
| **fork-tests** | All triggers | No (deploys from scratch) |
| **smoke-tests** | All triggers | Yes (bootstraps DeployManager) |
| **invariant-tests-ARM** | All triggers | No (deploys from scratch) |

### Invariant Profile Selection

Invariant test intensity is controlled by the `FOUNDRY_PROFILE` environment variable:
- **`lite`** — Used on PRs and feature branch pushes (faster, fewer runs)
- **`ci`** — Used on `main` pushes, scheduled runs, and `workflow_dispatch` (full runs, includes Medusa fuzzing for EthenaARM)

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

10. **Adding a new chain** — Add the chain ID → name mapping in `Base.s.sol`'s constructor, create a new directory under `script/deploy/`, and add the chain ID routing in `DeployManager.run()`.

11. **Use descriptive contract names** — Names like `LIDO_ARM_IMPL` are clearer than `IMPL_V2`.

12. **Reference the example** — See `mainnet/000_Example.s.sol` for a comprehensive, fully-commented template.
