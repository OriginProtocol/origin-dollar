# How to Deploy

A step-by-step guide for deploying contracts from scratch. For a deep dive into the framework internals, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Table of Contents

- [Step 1: Prerequisites](#step-1-prerequisites)
- [Step 2: Write Your Deployment Script](#step-2-write-your-deployment-script)
- [Step 3: Test with Smoke Tests](#step-3-test-with-smoke-tests)
- [Step 4: Simulate (Dry Run)](#step-4-simulate-dry-run)
- [Step 5: Deploy](#step-5-deploy)
- [Step 6: After Deployment](#step-6-after-deployment)
- [Step 7: Troubleshooting](#step-7-troubleshooting)

---

## Step 1: Prerequisites

### Install tools

```bash
make install
```

This installs Foundry, Soldeer dependencies, and Yarn packages.

### Configure environment

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
```

At a minimum, set:

| Variable | Purpose |
|----------|---------|
| `MAINNET_URL` | Ethereum RPC endpoint (required for fork tests, smoke tests, simulation, and mainnet deploys) |
| `SONIC_URL` | Sonic RPC endpoint (required for Sonic deploys) |
| `DEPLOYER_ADDRESS` | Address corresponding to your deployer private key |
| `ETHERSCAN_API_KEY` | Needed for contract verification on mainnet (`--verify` flag) |

### Import your deployer key

Foundry uses an encrypted keystore. Import your private key once:

```bash
cast wallet import deployerKey --interactive
```

You will be prompted for your private key and a password to encrypt it. The key name **must** be `deployerKey` — the Makefile references it by this name.

---

## Step 2: Write Your Deployment Script

### Naming convention

All three identifiers **must match exactly** — if they drift, the script will either fail to load or track execution under the wrong name:

| Component | Format | Example |
|-----------|--------|---------|
| **File** | `NNN_DescriptiveName.s.sol` | `017_UpgradeLidoARM.s.sol` |
| **Contract** | `$NNN_DescriptiveName` (prefixed with `$`) | `$017_UpgradeLidoARM` |
| **Constructor arg** | `"NNN_DescriptiveName"` (no `$`, no `.s.sol`) | `"017_UpgradeLidoARM"` |

Place the file in the correct network folder:
- Ethereum Mainnet → `script/deploy/mainnet/`
- Sonic → `script/deploy/sonic/`

### Minimal template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {AbstractDeployScript} from "script/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper, GovProposal} from "script/deploy/helpers/GovHelper.sol";

contract $017_UpgradeLidoARM is AbstractDeployScript("017_UpgradeLidoARM") {
    using GovHelper for GovProposal;

    bool public constant override skip = false;

    function _execute() internal override {
        // 1. Look up previously deployed contracts
        address proxy = resolver.resolve("LIDO_ARM");

        // 2. Deploy new contracts
        MyImpl impl = new MyImpl();

        // 3. Register each deployment (saved to JSON + available via resolver)
        _recordDeployment("LIDO_ARM_IMPL", address(impl));
    }

    function _buildGovernanceProposal() internal override {
        // Leave empty if no governance is needed
        govProposal.setDescription("Upgrade LidoARM");

        govProposal.action(
            resolver.resolve("LIDO_ARM"),
            "upgradeTo(address)",
            abi.encode(resolver.resolve("LIDO_ARM_IMPL"))
        );
    }

    function _fork() internal override {
        // Post-deployment verification (runs after governance simulation, fork modes only)
    }
}
```

### Key APIs

| Function | Where to use | Purpose |
|----------|-------------|---------|
| `resolver.resolve("NAME")` | `_execute()`, `_buildGovernanceProposal()`, `_fork()` | Get address of a previously deployed contract (reverts if not found) |
| `_recordDeployment("NAME", addr)` | `_execute()` | Register a newly deployed contract |
| `govProposal.setDescription(...)` | `_buildGovernanceProposal()` | Set the on-chain proposal description |
| `govProposal.action(target, sig, data)` | `_buildGovernanceProposal()` | Add a governance action |

See [`mainnet/000_Example.s.sol`](./mainnet/000_Example.s.sol) for a fully-commented reference template.

---

## Step 3: Test with Smoke Tests

```bash
make test-smoke
```

This forks the network, replays **all** deployment scripts (including yours) through `DeployManager`, and simulates any governance proposals end-to-end. If your script has a bug — wrong address, broken governance action, naming mismatch — it will revert here.

What to look for:
- **Green output** — all scripts replayed successfully.
- **Revert with `Resolver: unknown contract "..."`** — you're referencing a contract name that doesn't exist. Check spelling.
- **Governance simulation failure** — your proposal actions are invalid (wrong signature, bad parameters, etc.).

---

## Step 4: Simulate (Dry Run)

```bash
# Mainnet simulation
make simulate

# Sonic simulation
make simulate NETWORK=sonic
```

Simulation runs the full deployment pipeline on a fork using `vm.prank` instead of `vm.broadcast`. No real transactions are sent. Governance proposals are simulated through the entire Governor lifecycle (propose → vote → queue → execute).

This is identical to a real deployment except nothing goes on-chain. Check the logs for errors before proceeding.

---

## Step 5: Deploy

```bash
# Ethereum Mainnet
make deploy-mainnet

# Sonic
make deploy-sonic
```

This broadcasts real transactions and verifies contracts on Etherscan (mainnet) or the block explorer (Sonic).

**If your script includes governance actions:**
- The deploy command will print the `propose()` calldata.
- Submit this calldata to the Governor contract manually (e.g., via Gnosis Safe or Etherscan).

---

## Step 6: After Deployment

### Commit the updated deployment file

A successful deployment updates `build/deployments-{chainId}.json` (e.g., `build/deployments-1.json` for mainnet). Commit this file:

```bash
git add build/deployments-1.json
git commit -m "Add deployment: 017_UpgradeLidoARM"
```

### Governance metadata tracking

If your deployment includes a governance proposal, the JSON file will initially have `proposalId: 0` and `tsGovernance: 0`. These are filled in automatically:

- **CI** runs `make update-deployments` hourly, detects submitted proposals, and records their `proposalId` and execution timestamp.
- **Manual:** run `make update-deployments` yourself if you don't want to wait for CI.

---

## Step 7: Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `vm.deployCode()` fails to load script | File name, contract name, or constructor arg don't match | Verify all three follow the [naming convention](#naming-convention) |
| `Resolver: unknown contract "FOO"` | Typo in contract name, or the contract wasn't deployed by a previous script | Check the name in `build/deployments-{chainId}.json` or in the prior script's `_recordDeployment()` call |
| `DEPLOYER_ADDRESS not set in .env` | Missing env var | Add `DEPLOYER_ADDRESS=0x...` to `.env` |
| Governance simulation reverts | Proposal actions are invalid (wrong target, signature, or parameters) | Debug the `_buildGovernanceProposal()` function; check targets and signatures |
| `make deploy-mainnet` asks for password | Normal behavior — Foundry prompts for the `deployerKey` keystore password | Enter the password you chose during `cast wallet import` |
| Contract verification fails | Missing or invalid `ETHERSCAN_API_KEY` | Set `ETHERSCAN_API_KEY` in `.env` |
