# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Origin DeFi's OTokens monorepo containing smart contracts for:
- **OUSD** (Origin Dollar) - a yield-bearing stablecoin
- **OETH** (Origin Ether) - an Ethereum liquid staking token
- **OS** (Origin Sonic) - Sonic chain native token

Deployed on Ethereum Mainnet, Base, Arbitrum, Sonic, Plume, Holesky, and Hoodi. All smart contract work happens in the `contracts/` directory.

## Setup

```bash
cd contracts
cp dev.env .env          # Set PROVIDER_URL to Alchemy/Infura endpoint
pnpm i
```

Key `.env` variables: `PROVIDER_URL`, `SONIC_PROVIDER_URL`, `BASE_PROVIDER_URL`, `BLOCK_NUMBER`, `ACCOUNTS_TO_FUND`.

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

### OTokens
`contracts/token/OUSD.sol` and `contracts/token/OETH.sol` - rebasing ERC-20 tokens. OUSD rebases to all holders; OETH uses a similar mechanism for ETH-denominated yield.

### Oracle System
`contracts/oracle/` - price feed aggregation. `OracleRouter` routes price queries to appropriate Chainlink feeds or Curve pool oracles, with staleness checks. Each network has its own router.

### Harvesters
`contracts/harvest/` - collect reward tokens from strategies and swap to yield-bearing assets. `Harvester` for OUSD, `OETHHarvester` for OETH, network-specific variants exist.

### Automation (Defender Actions)
`scripts/defender-actions/` - OpenZeppelin Defender automation scripts for:
- `doAccounting` - periodic vault accounting
- `harvest` - automated harvesting
- `sonicRequestWithdrawal` / `sonicClaimWithdrawals` - Sonic staking lifecycle
- `crossChainRelay` - Base ↔ Mainnet CCTP relay

Bundle with: `pnpm rollup -c ./scripts/defender-actions/rollup.config.cjs`

### Cross-Chain
- CCTP (Circle) for USDC bridging
- Network-specific bridge contracts in `contracts/bridges/`
- LayerZero OApp was planned to be used for Plume but is no longer going to be used.

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
