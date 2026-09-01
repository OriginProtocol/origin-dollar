# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Origin DeFi's OTokens monorepo containing smart contracts for:
- **OUSD** (Origin Dollar) - a yield-bearing stablecoin
- **OETH** (Origin Ether) - an Ethereum liquid staking token
- **OS** (Origin Sonic) - Sonic chain native token

Deployed on Ethereum Mainnet, Base, Arbitrum, Sonic, Plume, Hoodi, and HyperEVM. All smart contract work happens in the `contracts/` directory.

## Toolchain

**Foundry is the contract toolchain**: `forge` (driven by the `Makefile`) builds the contracts, runs the contract test suite, executes deployments, and generates the `@origin/defi` npm ABI package. Hardhat remains only for the ops task CLI (`tasks/*.js`, wired up in `hardhat.config.js`) and the local fork node. The committed `deployments/` descriptors are the address/ABI registry consumed by both toolchains; there are no Hardhat deployment scripts.

## Setup

```bash
cd contracts
cp dev.env .env          # Set MAINNET_PROVIDER_URL to an Alchemy/Infura endpoint
make install             # foundryup (v1.8.1), forge soldeer install, install-deps.sh, pnpm i
```

Key `.env` variables: `MAINNET_PROVIDER_URL` (required), `BASE_PROVIDER_URL`, `ARBITRUM_PROVIDER_URL`, `SONIC_PROVIDER_URL`, `HYPEREVM_PROVIDER_URL`, `BEACON_PROVIDER_URL` (beacon-proof fork tests), and optional `FORK_BLOCK_NUMBER_<CHAIN>` pins for Foundry fork tests (unset = latest block; refresh with `make update-fork-blocks`). The Hardhat task CLI resolves its mainnet RPC from `MAINNET_PROVIDER_URL` as well (legacy fallback: `PROVIDER_URL`).

Real deployments additionally need `DEPLOYER_ADDRESS` and the encrypted `deployerKey` keystore (`cast wallet import deployerKey --interactive`).

### `@oplabs/talos-client` (private, optional)

`pnpm i` deliberately does **not** install `@oplabs/talos-client`. It is declared
as an *optional peer dependency* so that CI and external contributors can install
this repo without GitHub Packages credentials.

**Nothing local needs it.** `hardhat`, `tsx tasks/run.ts <action>` and the tests
all load and run without it. Only the runner image does: `runner.ts` (container
entrypoint) imports it statically, and `tasks/lib/signer.ts` `require()`s it
lazily for the Postgres nonce queue, which is gated on `DATABASE_URL` — unset
locally, so the require never fires. `dockerfile-actions` installs it with the
`talos_package_token` build secret, reading the pinned version from
`peerDependencies`.

Keep it that way. Two regressions to avoid:

- Do not make the `signer.ts` require a static import. `tasks/run.ts` imports
  `getSigner` at the top level, so a static import makes every local action run
  fail with `Cannot find module '@oplabs/talos-client'`.
- Do not import it from `tasks/lib/network.ts`. That used to drag the
  requirement up through `utils/resolvers.js` → `utils/morpho.js` →
  `tasks/tasks.js` → `hardhat.config.js` and broke the Hardhat ops CLI for
  installs without GitHub Packages auth. #2954 replaced it with local
  `CHAIN_IDS` / `RPC_ENV_VARS` maps.

## Commands (run from `contracts/`)

### Build
```bash
make build                     # forge build everything
make build-contracts           # only contracts/ — fastest while iterating
make build-tests-unit          # also: build-tests, build-tests-fork, build-tests-smoke, build-scripts
```
`make` with no target runs `forge fmt scripts/ tests/` and then builds.

### Lint & Format
```bash
forge fmt scripts/ tests/      # Foundry-tree Solidity (tests + deploy scripts)
pnpm prettier:sol              # contracts/**/*.sol (prettier-plugin-solidity)
pnpm prettier:js               # JS (tasks, scripts, deploy, utils)
pnpm prettier:ts               # TS (tasks/actions, tasks/lib)
pnpm lint                      # eslint (JS + TS) and solhint
make lint-imports              # forge lint: unused imports in scripts/ and tests/
```

### Tests (Foundry)
```bash
make test-unit                 # tests/unit/ — mocked, no RPC needed
make test-fork-mainnet         # per chain: test-fork-mainnet|base|hyperevm|arbitrum; make test-fork for all
make test-smoke-mainnet        # per chain: test-smoke-mainnet|base|hyperevm; make test-smoke for all
make test-f-testSwap           # tests matching a function name
make test-c-OETHVault          # tests matching a contract name
make coverage                  # lcov; make coverage-html for a browsable report
make gas                       # forge test --gas-report
```

The `make test-*` targets rebuild the relevant trees first. Bare `forge test` does **not**: tests deploy contracts with `vm.deployCode`, which reads compiled artifacts, so after changing contract source you must `forge build contracts/` or a bare `forge test` silently tests stale code.

Fork and smoke tests fork the chain from the `*_PROVIDER_URL` variables and pin blocks via `FORK_BLOCK_NUMBER_<CHAIN>`. Test conventions (unit vs fork vs smoke, concrete vs fuzz, interface-only testing) are documented in `tests/README.md` — read it before writing tests.

### Hardhat task tests (`tasks/test/`)

`pnpm test:tasks` validates the ops task implementation. Smart-contract tests belong exclusively in the Foundry suite under `tests/`.

### Hardhat (ops task CLI only)
```bash
npx hardhat <task> --network mainnet   # ops tasks from tasks/*.js
pnpm run node                          # Hardhat fork node, for running tasks against a local fork
pnpm node:anvil                        # anvil mainnet fork (used by make deploy-local); node:anvil:base etc.
pnpm action <name>                     # Talos actions runner (tsx tasks/run.ts — viem, not Hardhat)
```

### Useful Options
```bash
export DEBUG=origin:*          # Debug logging in tasks and JS tooling
```

## Workflow Guidance

- Run repo commands from `contracts/` for smart contract work.
- After editing Solidity under `contracts/contracts/`, run `pnpm prettier:sol`.
- After editing Solidity under `scripts/` or `tests/`, run `forge fmt scripts/ tests/`.
- For JS edits run `pnpm prettier:js`; for TS under `tasks/`, `pnpm prettier:ts`.
- Prefer the smallest relevant verification after edits (targeted `make build-*`, a single `make test-c-...`).
- Do not reformat or modify unrelated files just to satisfy style.
- Do not fix unrelated failing tests or lint issues unless explicitly asked.

## Core contract stability (Vault & Token) — DESIGN PRINCIPLE

**Avoid changing the core contracts — the Vaults (`contracts/vault/`) and the
OTokens (`contracts/token/`) — whenever the same outcome can be reached without
touching them.** Keeping the core effectively frozen is a deliberate Origin
value, not an accident of the codebase.

Why: these contracts hold all user funds and all rebasing accounting. Every
change to them carries storage-layout risk, needs a full implementation upgrade
plus a governance proposal and timelock, invalidates prior audit coverage, and
adds bug surface to the most critical code in the protocol. The peripheral
contracts carry none of that.

**Before proposing a Vault or OToken change, work through these first and say in
the PR description which you ruled out and why:**

1. **Re-point an existing role.** `setStrategistAddr`, `setOperatorAddr`,
   `setTrusteeAddress` etc. can often produce the desired permission structure
   with a transaction instead of an upgrade.
2. **Put a Safe module on an existing multisig.** A module can grant scoped,
   delegable access to functions the multisig already has the right to call —
   including to third parties — with no core change. Scope modules by
   `(target, selector)` pair, never by target alone.
3. **Add a peripheral contract** (harvester, dripper, zapper, automation
   contract) that composes with the existing core interface.

Only when none of those work should the core change be made — and then it should
be as small as possible.

Note the protocol-wide reach of the role addresses when evaluating option 1:
`IVault.strategistAddr()` is the strategist source of truth for `OUSD.sol`,
`InitializableAbstractStrategy` (so every strategy), the Curve/Aerodrome/Algebra
AMO strategies, `ValidatorRegistrator`, `SonicValidatorDelegator` and
`FixedRateDripper`. Re-pointing it is a cheap transaction but a wide blast
radius — enumerate the affected call sites before recommending it.

Worked example: PR #2973 added an `adminAddr` role to `VaultAdmin`/`VaultStorage`
(storage-layout change + 3 vault upgrades) to make unpause a 5/8 action. The same
result was achievable with no core change by re-pointing the Vault's strategist
to the 5/8 Admin Safe and hosting a Safe module for the 2/8 and the operator EOA.

## Architecture

### Core Pattern: Upgradeable Proxy Contracts
All major contracts use the OpenZeppelin upgradeable proxy pattern. Each has a `*Proxy` contract (minimal proxy) pointing to an implementation. Deployments and upgrades go through the Foundry deployment framework in `scripts/deploy/`; committed descriptors in `deployments/` are the machine-readable historical registry.

### Vaults (Central Component)
Vaults (`contracts/vault/`) are the core of each OToken. They handle:
- Minting/burning OTokens
- Managing collateral allocation across strategies
- Rebalancing via `allocate()`
- Yield accounting via `rebase()`

Each chain/token has its own vault contract: `OUSDVault`, `OETHVault`, `OETHBaseVault` (Base), `OSVault` (Sonic) and `OETHPlumeVault` (Plume). `OETHPlumeVault` is being shut down and will be removed from the repo after all funds are withdrawn.

Inheritance: `VaultStorage` → `VaultInitializer` → `VaultCore` (user-facing mint/redeem) → `VaultAdmin` (governance functions) → the concrete per-chain vault, deployed as a **single implementation** behind the proxy. (They were historically two implementations sharing one proxy because the combined contract exceeded the size limit; that split is gone.)

### Strategies (Yield Generation)
Located in `contracts/strategies/`. Each strategy:
- Inherits from `InitializableAbstractStrategy`
- Implements `deposit()`, `withdraw()`, `withdrawAll()`, `checkBalance()`, `collectRewardTokens()`
- Is registered with a vault and allocated collateral

Key strategies: Aave, Compound, Convex/Curve, Balancer, Morpho, Native Staking (SSV validators).
- For SSV Cluster migrations to ETH billing, use the SSV ETH payment calculator: https://ssv-eth-forecasting.vercel.app/

### OTokens
`contracts/token/OUSD.sol` and `contracts/token/OETH.sol` - rebasing ERC-20 tokens. OUSD rebases to all holders; OETH uses a similar mechanism for ETH-denominated yield.

### Harvesters
`contracts/harvest/` - collect reward tokens from strategies and swap to yield-bearing assets. `Harvester` for OUSD, `OETHHarvester` for OETH, network-specific variants exist.

### Automation (Talos)
The Talos runner's cron/manual actions live in `contracts/tasks/actions/*.ts`,
are scheduled in `contracts/migrations/seed_schedules.sql`, and are catalogued
in `contracts/docs/ACTIONS.md`. Update that doc in the same change whenever a
scheduled action is added, removed, or its behaviour changes.

### Cross-Chain
- CCTP (Circle) for USDC bridging
- Network-specific bridge contracts in `contracts/bridges/`

### Pool Boosters
`contracts/poolBooster/` - Merkl distribution contracts for incentivizing liquidity pools. `PoolBoostCentralRegistry` tracks all boosters.

### Key Utility Files
- `utils/addresses.js` - master address registry for all networks/contracts (~32KB)
- `utils/constants.js` - protocol constants

## Test Organization

```
tests/                     # Foundry suite (canonical)
  Base.t.sol               # root test contract: actors, common setup
  unit/                    # mocked unit tests — aim for ~100% coverage here
  fork/                    # integration tests on a chain fork; deploy our contracts fresh, use real external protocols
  smoke/                   # live-deployment health checks; deploy nothing, use only what is on chain
  invariant/
  mocks/
  utils/                   # Addresses.sol, shared helpers
tasks/test/                # Mocha tests for Hardhat ops tasks only
```

Layout mirrors `<type>/<chain>/<area>/<Contract>/{concrete,fuzz}/<Behaviour>.t.sol`, with a per-contract `shared/Shared.t.sol` base. Tests interact with contracts **through interfaces** (`IVault`, `IOToken`, `IWOToken`, `IProxy`) and deploy implementations with `vm.deployCode` — never import a concrete contract into a test file; it drags the whole dependency tree into the test's compilation unit and destroys build caching. Full rules and gotchas: `tests/README.md`.

## Deployment Scripts

Foundry deploy scripts live in `scripts/deploy/<network>/` and are numbered. The file, contract, and constructor deployment ID must match: file `017_UpgradeVault.s.sol`, contract `$017_UpgradeVault`, constructor ID `"017_UpgradeVault"`. Start from `000_Example.s.sol` in the chain directory. Record every new address with `_recordDeployment("Name", addr)` and resolve prior entries with `resolver.resolve("Name")`.

`DeployManager.s.sol` discovers scripts, skips completed ones (state in `build/deployments-<chainId>.json`), and simulates pending governance on forks. Mainnet governance proposals go through GovernorSix; Base and HyperEVM use their chain TimelockController; Sonic scripts apply fork-only governance effects in `_fork()`.

```bash
make simulate                  # fork simulation, no broadcast (NETWORK=base|hyperevm for other chains)
make deploy-mainnet            # real deploy + Etherscan verify; also: deploy-base, deploy-hyperevm
make deploy-local              # against a running pnpm node:anvil
```

For upgrades, call `_assertStorageSafe(type(X).name)` before `new X()` — see Storage Layout Checks below. After a real deploy the make target regenerates the Hardhat-format descriptors in `deployments/<network>/` (see the Talos section at the bottom). Framework internals: `scripts/deploy/README.md` and `scripts/deploy/ARCHITECTURE.md`.

Hardhat deployment scripts are no longer part of the repository. Do not recreate a `deploy/` tree; use the Foundry framework above.

## Storage Layout Checks

**The baseline is the descriptor.** `deployments/<network>/<Name>.json` holds
`{address, abi, storageLayout}` — the layout is what is deployed at that address
right now, written by `scripts/create-hardhat-format-descriptors.js` in the same
step that records the address, so the write side cannot silently stop.

**The gate runs per deployed contract, before broadcast.** Call
`_assertStorageSafe(type(X).name)` in a deploy script before `new X()`. It shells
out to `scripts/check-storage-upgrade.js` over `vm.ffi`; a non-zero exit aborts
the whole forge script, so nothing is broadcast and the ledger is untouched.
Checking the deployed contract is sufficient — its layout is the flattened layout
of every source file it inherits (e.g. `OUSDVault` = `VaultStorage` 37 slots +
`Initializable` 3).

For a deliberate break — retiring a slot behind a `uint256` placeholder and
abandoning the data — use `_allowStorageBreak(type(X).name, "<reason>")`. The
reason is required and lands in the PR diff next to the deployment.

Comparison is `@openzeppelin/upgrades-core`, which supplies the `__gap` shrink
arithmetic. Two policies are ours: a rename is ignored only when the new label is
derived from the old (`assets` -> `_deprecated_assets`); an unrelated rename is
not, because two same-typed variables trading labels also reports as two renames.
Enum member data is absent from solc layouts and is ignored — an enum is one byte
regardless of variant count, so no slot moves; what is given up is noticing that a
stored value now decodes to a different variant.

Prefer `__gap` for new gaps, but any number of leading underscores works — labels
matching `/^_+[a-z]*gap$/i` are normalised to `__gap` **in memory** at comparison
time, because OZ's `isGap()` matches only `__gap`/`__gap_*` while contracts
deployed before the rename still carry `______gap` on chain. Stored layouts stay
faithful to their source, so a bug in that normalisation never costs a re-fetch.

Storage-slot checks cover **Ethereum mainnet and Base** only. ArbitrumOne, Sonic,
Plume, Hoodi and HyperEVM are out of scope; the gate is a no-op there.

**Re-supporting a chain means re-fetching every layout.** The legacy
`storageLayout/` tree has been deleted; baselines now live only in descriptors.
To bring a chain back, run
`scripts/fetch-onchain-storage-layouts.js --network <net>` (reads each deployed
implementation's layout from its verified source) then
`scripts/seed-descriptor-storage-layouts.js --network <net>`, and add the chain to
`NETWORK_BY_CHAIN` in both that script and `check-storage-upgrade.js`.

`scripts/check-storage-layout.js` remains for ad-hoc "what did this PR change"
investigation between two git refs. It is **not** the gate: it compares type
identifier strings, which embed AST node ids that shift between compilations, so
it false-positives on any contract with an enum or struct in storage.

### Tests

Two suites, both `node --test` (`scripts/test/`), because this is JSON handling
rather than on-chain behaviour:

- `pnpm test:scripts` — the gate's policy. Runs in its own CI job with **no**
  Foundry setup: `forge` is faked by a shim on `PATH`, so if these ever come to
  need a real toolchain the job breaks loudly instead of absorbing a build.
- `pnpm test:layouts` — pins the layouts of `OUSDVault`, `OUSD`, `WOETH` and
  `CompoundingStakingSSVStrategy`. Appended to the `unit-tests` job, which has
  just rebuilt `contracts/`. **A diff in `layout-pinned.test.js` means storage
  moved; say why in the PR.** It pins the working tree, so it is a tripwire, not
  a compatibility check — the deploy-time gate remains the authority on what is
  safe against what is deployed. Regenerate a block with the one-liner in that
  file's header.

Two traps worth knowing before editing either suite. The gate's whole agreement
with Solidity is *two bytes on stdout*, and upgrades-core prints advisory notes
that currently go to stderr — one test exists solely to catch a library bump
that reroutes them. And OZ classifies two variables swapping labels as a
`rename` pair **only** when another variable sits between them; adjacent
same-typed ones come back as delete/insert, so a fixture of the wrong shape
tests nothing.

## Roles & Access Control

Four key roles used across all contracts:
- **Deployer** - deploys contracts. Foundry deploys sign with the `deployerKey` keystore + `DEPLOYER_ADDRESS`; the legacy Hardhat CLI reads `DEPLOYER_PK`
- **Governor** - timelock-controlled governance address
- **Strategist** - multisig for day-to-day operations
- **Guardian** - emergency pause capability

Foundry fork and smoke tests impersonate these with `vm.prank`. For Hardhat tasks against a running fork node, set `IMPERSONATE=0x...` to run as any account.

## Contract Verification

`make deploy-mainnet|base|hyperevm` verifies as part of the deploy (`--verify`; set the explorer API keys in `.env`). To check whether a local contract matches what is deployed:
```bash
make match file=contracts/vault/VaultCore.sol addr=0xADDRESS
```
For manual contract verification, use Foundry's `forge verify-contract` (see README.md).

## Logger Pattern

```js
const log = require("../utils/logger")("module-name");
log("something happened");
// Enable: export DEBUG=origin:module-name*
```

## Foundry deploy files vs. Talos actions (MANDATORY CHECK)

The Talos ops automation (`contracts/tasks/actions/**` — harvest, rebases, `doAccounting`, validator ops, cross-chain relays, etc.) resolves the contracts it operates on from the descriptors in `contracts/deployments/<network>/<Name>.json` (addresses) and pinned entries in `contracts/utils/addresses.js` / action-local `*_BY_CHAIN_ID` maps. Foundry's own broadcast state lives in `contracts/build/deployments-<chainId>.json`.

The `make deploy-mainnet|base|hyperevm` targets close most of this gap automatically: after the broadcast they run `scripts/create-hardhat-format-descriptors.js`, which rewrites `deployments/<network>/<Name>.json` for whatever was just deployed (even when verification fails; `make deploy-local` deliberately skips it). What is **not** automatic — and can silently point a live Talos action at a stale address or ABI:
- a raw `forge script` run outside the make targets never updates descriptors;
- pinned addresses in `utils/addresses.js` and action-local `*_BY_CHAIN_ID` maps;
- the curated `abi/<Interface>.json` files when a callable interface changes.

**Whenever you create or modify a Foundry deploy script (`contracts/scripts/deploy/**/*.s.sol`), you MUST:**
1. List every contract the deploy script deploys or upgrades (proxy or implementation).
2. Grep `contracts/tasks/actions/**` and the utils they import for those contract/deployment names and any pinned addresses (`utils/addresses.js`, action-local `*_BY_CHAIN_ID` maps, `abi/*.json` call surfaces).
3. For any overlap, confirm the descriptor refresh covers it, update pinned addresses and the curated `abi/<Interface>.json` if the callable interface changed, and call it out explicitly in the PR description.
4. If you cannot verify whether an action is affected, say so explicitly in the PR — never assume "no impact".

Talos action ABIs come from curated interface ABIs in `contracts/abi/*.json` or inline human-readable ABIs — never from `deployments/*.json` `.abi` (proxy artifacts are admin-only and concrete artifacts can be stale) and never from `artifacts/` (not shipped in the actions image). Addresses are the deployed truth (`deployments/*.json` `.address` / pinned).
