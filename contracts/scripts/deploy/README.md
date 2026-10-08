# Foundry Deployment Guide

Run all commands in this guide from `contracts/`. For framework internals, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Setup

Install dependencies:

```bash
make install
```

Copy the tracked environment template and fill in the values needed for the
target chain:

```bash
cp dev.env .env
```

Foundry RPC aliases use these variables:

| Chain | RPC variable |
|---|---|
| Ethereum | `MAINNET_PROVIDER_URL` |
| Base | `BASE_PROVIDER_URL` |
| Arbitrum | `ARBITRUM_PROVIDER_URL` |
| HyperEVM | `HYPEREVM_PROVIDER_URL` |

The ops CLI uses `MAINNET_PROVIDER_URL` for Ethereum.

Real Foundry deployments also require `DEPLOYER_ADDRESS` and the encrypted
`deployerKey` keystore:

```bash
cast wallet import deployerKey --interactive
```

Set the relevant explorer API key when using verification.

## Write a deployment script

Place scripts under the chain-specific directory:

```text
scripts/deploy/
├── mainnet/
├── base/
├── sonic/
└── hyperevm/
```

The file, contract, and constructor deployment ID must match:

| Component | Example |
|---|---|
| File | `017_UpgradeVault.s.sol` |
| Contract | `$017_UpgradeVault` |
| Constructor ID | `"017_UpgradeVault"` |

Start from the `000_Example.s.sol` in the intended chain directory. Record every
new address with `_recordDeployment("NAME", address)`, and resolve prior entries
with `resolver.resolve("NAME")`.

Mainnet governance proposals use GovernorSix. Base and HyperEVM proposals use
their chain TimelockController. Sonic scripts currently apply fork-only
governance effects explicitly in `_fork()`; follow the existing Sonic script
pattern rather than copying a Mainnet proposal.

## Build and test

Build contracts and deployment scripts:

```bash
make build-contracts
make build-scripts
```

Run the smallest smoke suite for the affected supported chain:

```bash
make test-smoke-mainnet
make test-smoke-base
make test-smoke-hyperevm
```

`make test-smoke` runs all smoke tests and therefore requires every configured
RPC endpoint used by the suite.

Smoke tests create a fork, load `build/deployments-<chainId>.json`, replay
pending deployment scripts through `DeployManager`, apply supported governance,
and then test the resulting deployed state.

## Simulate

The Makefile simulation target supports Mainnet, Base, and HyperEVM:

```bash
make simulate
make simulate NETWORK=base
make simulate NETWORK=hyperevm
```

Simulation executes against a fork and does not broadcast transactions.

## Deploy

Available real deployment targets are:

```bash
make deploy-mainnet
make deploy-base
make deploy-hyperevm
```

For a local node:

```bash
make deploy-local
```

There is currently no `deploy-sonic` Make target. Add and review a target before
attempting another Sonic Foundry deployment.

## After deployment

A successful deployment updates:

```text
build/deployments-<chainId>.json
```

Review and commit the intended JSON change. There is currently no active
`make update-deployments` target or hourly metadata workflow; governance
proposal IDs and execution timestamps must be maintained through the reviewed
deployment process.

### Talos compatibility check

Talos does not resolve addresses from Foundry’s
`build/deployments-<chainId>.json`. Actions use committed deployment descriptors,
`utils/addresses.js`, and action-local address maps.

For every Foundry deployment or upgrade:

1. List every proxy and implementation deployed or changed.
2. Search `tasks/actions/` and imported utilities for those contract names.
3. Update the applicable `deployments/<network>/<Name>.json` address or pinned
   address.
4. Update the curated `abi/*.json` interface if the callable surface changed.
5. Describe the Talos impact explicitly in the PR.

Do not use a proxy artifact’s admin-only ABI for implementation calls, and do
not make Talos depend on `artifacts/`, which is not shipped in the action image.

## Troubleshooting

| Problem | Check |
|---|---|
| `vm.deployCode()` cannot load a script | File, `$Contract`, and constructor ID match |
| Resolver reports an unknown contract | Name exists in the chain deployment JSON or an earlier script |
| Fork creation fails | Correct `*_PROVIDER_URL` is non-empty |
| Deployment asks for a password | Enter the password for the `deployerKey` keystore |
| Verification fails | Correct explorer API key and chain configuration are set |
| A smoke test uses stale code | Build `contracts/` and `scripts/` before running it |
