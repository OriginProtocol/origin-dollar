# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Origin DeFi's OTokens monorepo containing smart contracts for:
- **OUSD** (Origin Dollar) - a yield-bearing stablecoin
- **OETH** (Origin Ether) - an Ethereum liquid staking token
- **OS** (Origin Sonic) - Sonic chain native token

Deployed on Ethereum Mainnet, Base, Arbitrum, Sonic, Plume, Hoodi, and HyperEVM. All smart contract work happens in the `contracts/` directory.

## Setup

```bash
cd contracts
cp dev.env .env          # Set PROVIDER_URL to Alchemy/Infura endpoint
pnpm i
```

Key `.env` variables: `PROVIDER_URL`, `SONIC_PROVIDER_URL`, `BASE_PROVIDER_URL`, `BLOCK_NUMBER`, `ACCOUNTS_TO_FUND`.

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
  `tasks/tasks.js` → `hardhat.config.js` and broke `hardhat deploy` in the ABI
  publish workflow, which installs without GitHub Packages auth. #2954 replaced
  it with local `CHAIN_IDS` / `RPC_ENV_VARS` maps.

## Commands (run from `contracts/`)

### Build
```bash
pnpm hardhat compile           # Compile changed contracts
pnpm clean && pnpm hardhat compile  # Full recompile
```

### Lint & Format
```bash
pnpm lint                      # Run all linters (Solidity + JS)
pnpm lint:sol                  # solhint for Solidity
pnpm lint:js                   # eslint for JavaScript
pnpm prettier:check            # Check formatting
pnpm prettier                  # Format all files
```

### Unit Tests
```bash
pnpm test                      # Mainnet unit tests
pnpm test:base                 # Base network unit tests
pnpm test:sonic                # Sonic network unit tests
pnpm test:coverage             # Mainnet unit tests with coverage
pnpm test test/**/FILE_NAME.js # Running a specific test file
```

### Fork Tests (require `PROVIDER_URL` in `.env`)
```bash
# Option 1: Fork each time (like CI)
pnpm test:fork                                    # All mainnet fork tests
pnpm test:fork -- test/strategies/foo.fork-test.js  # Single fork test file

# Option 2: Nested forking (faster for dev iteration)
FORK=true pnpm run node        # Terminal 1: start forked node with deployments
pnpm test:fork                 # Terminal 2: tests reuse running node

# Other networks
pnpm test:arb-fork
pnpm test:base-fork
pnpm test:sonic-fork
pnpm test:hol-fork
```

### Useful Options
```bash
export DEBUG=origin:*          # Enable all debug logging
export REPORT_GAS=true         # Show gas usage in test output
export CONTRACT_SIZE=true      # Show contract sizes after compile
```

## Workflow Guidance

- Run repo commands from `contracts/` for smart contract work.
- After making code changes, run Prettier before finishing.
- For JS edits under `contracts/`, run `pnpm prettier:js`.
- For Solidity edits under `contracts/`, run `pnpm prettier:sol`.
- If both JS and Solidity files changed, run both commands.
- Prefer the smallest relevant verification after edits.
- Do not reformat or modify unrelated files just to satisfy style.
- Do not fix unrelated failing tests or lint issues unless explicitly asked.

## Architecture

### Core Pattern: Upgradeable Proxy Contracts
All major contracts use the OpenZeppelin upgradeable proxy pattern. Each has a `*Proxy` contract (minimal proxy) pointing to an implementation. Proxies are deployed via `hardhat-deploy` scripts in `deploy/`.

### Vaults (Central Component)
Vaults (`contracts/vault/`) are the core of each OToken. They handle:
- Minting/burning OTokens
- Managing collateral allocation across strategies
- Rebalancing via `allocate()`
- Yield accounting via `rebase()`

Each chain/token has its own vault: `OUSDVault`, `OETHVault`, `OETHBVault` (Base), `OETHSVault` (Sonic) and `OETPVault` (Plume). `OETPVault` is being shut down and will be removed from the repo after all funds are withdrawn.

Vault logic is split across two implementation contracts: `VaultCore` (user-facing mint/redeem) and `VaultAdmin` (governance functions).
`VaultCore` inherits from `VaultAdmin` and is now deployed as a single implementation contract for simplicity.
Previously they were deployed as separate implementations with a shared proxy. This was because the contract was too big to deploy as a single implementation, but after the simplification, it can now be deployed as one.

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
- `utils/deploy.js` - deployment helper functions (use these patterns when writing deploy scripts)
- `utils/constants.js` - protocol constants

## Test Organization

```
test/
  _fixture.js              # Main fixture: deploys all contracts + mocks for unit tests
  _fixture-base.js         # Base network fixture
  _fixture-sonic.js        # Sonic network fixture
  _hot-deploy.js           # Hot deploy support for dev iteration
  vault/                   # Vault tests (unit + fork)
  strategies/              # Strategy tests (unit + fork)
  behaviour/               # Shared behavioral test suites (used across strategies)
```

**Fork test files** are named `*.fork-test.js` and run against real deployed contracts on a network fork.

**Unit test files** are named `*.js` (without `.fork-test`) and run against local mocks.

**Behavior tests** (`test/behaviour/`) define reusable test suites (e.g., `shouldBehaveLikeStrategy`) that are composed into strategy-specific test files.

**Fixtures**: Each test file imports from `_fixture.js` which uses `loadFixture()` for snapshot-based test isolation. The fixture deploys mocks and wires up contracts identically to mainnet structure.

## Deployment Scripts

Located in `deploy/` and numbered sequentially (e.g., `001_ousd.js`, `002_vault.js`). Each script uses `hardhat-deploy` plugin conventions - exports a deploy function and tags.

When adding a new deployment script, increment the number and follow existing patterns in `utils/deploy.js` (especially `deployWithConfirmation` and `withConfirmation`).

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
- **Deployer** - deploys contracts (set via `DEPLOYER_PK` env var)
- **Governor** - timelock-controlled governance address (set via `GOVERNOR_PK` env var)
- **Strategist** - multisig for day-to-day operations
- **Guardian** - emergency pause capability

For fork tests, these addresses are impersonated. Set `IMPERSONATE=0x...` env var to impersonate any account on a running fork node.

## Contract Verification

Use `yarn` (not `pnpm`) for verification. Always pass `--contract` flag to avoid slowdowns:
```bash
yarn hardhat --network mainnet verify --contract contracts/vault/VaultAdmin.sol:VaultAdmin 0xADDRESS
```

Auto-verify on deploy: `VERIFY_CONTRACTS=true pnpm deploy:mainnet`

## Logger Pattern

```js
const log = require("../utils/logger")("module-name");
log("something happened");
// Enable: export DEBUG=origin:module-name*
```

## Foundry deploy files vs. Talos actions (MANDATORY CHECK)

The Talos ops automation (`contracts/tasks/actions/**` — harvest, rebases, `doAccounting`, validator ops, cross-chain relays, etc.) resolves the contracts it operates on from the hardhat-deploy artifacts in `contracts/deployments/<network>/<Name>.json` (addresses) and pinned entries in `contracts/utils/addresses.js` / action-local `*_BY_CHAIN_ID` maps. Foundry deploys write only `contracts/build/deployments-<chainId>.json` (addresses, **no ABI**) and do **not** update `deployments/` or `addresses.js`. So redeploying a contract via Foundry can silently point a live Talos action at a stale address.

**Whenever you create or modify a Foundry deploy script (`contracts/scripts/deploy/**/*.s.sol`), you MUST:**
1. List every contract the deploy script deploys or upgrades (proxy or implementation).
2. Grep `contracts/tasks/actions/**` and the utils they import for those contract/deployment names and any pinned addresses (`utils/addresses.js`, action-local `*_BY_CHAIN_ID` maps, `abi/*.json` call surfaces).
3. For any overlap, update the corresponding `deployments/<network>/<Name>.json` address (and the curated `abi/<Interface>.json` if the callable interface changed) or the pinned address in the action/`addresses.js`, and call it out explicitly in the PR description.
4. If you cannot verify whether an action is affected, say so explicitly in the PR — never assume "no impact".

Talos action ABIs come from curated interface ABIs in `contracts/abi/*.json` or inline human-readable ABIs — never from `deployments/*.json` `.abi` (proxy artifacts are admin-only and concrete artifacts can be stale) and never from `artifacts/` (not shipped in the actions image). Addresses are the deployed truth (`deployments/*.json` `.address` / pinned).
