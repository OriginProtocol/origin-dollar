# TypeScript Migration Plan

This document outlines the plan for incrementally migrating JavaScript files in `contracts/` to TypeScript.

## Current State

- **~311 JS files**, **~66K lines of code** in `contracts/`
- No TypeScript infrastructure (no `tsconfig.json`, no `.ts` files, no type definitions)
- All CommonJS (`require`/`module.exports`)
- Heavy use of Hardhat globals (`ethers`, `deployments`, `getNamedAccounts`)

## Scope by Category


| Category         | Files | LOC     | Migration Difficulty |
| ---------------- | ----- | ------- | -------------------- |
| Defender Actions | 13    | ~780    | Low                  |
| Utils            | 36    | ~7,050  | Low-Medium           |
| Config           | 4     | ~600    | Low                  |
| Deploy Scripts   | 121   | ~7,300  | Medium               |
| Tasks            | 35    | ~10,000 | Medium               |
| Tests            | 87    | ~38,900 | High                 |


## Strategy

Use `allowJs: true` in `tsconfig.json` so existing JS continues to work. Migrate files incrementally — no big bang required. The codebase can remain mixed JS/TS indefinitely.

CommonJS module format is retained (`require`/`module.exports`). TypeScript will be configured to emit CommonJS output, so migrated files stay compatible with non-migrated ones.

## Phase 1 — Foundation + Defender Actions (~1 day)

**Goal:** Establish TypeScript infrastructure and migrate the highest-priority files.

### Setup

- Add `tsconfig.json` with `allowJs: true`, targeting ES2020, CommonJS output
- Install dependencies: `typescript`, `ts-node`, `@types/node`
- Update `hardhat.config.js` → `hardhat.config.ts` (Hardhat natively supports this)
- Update rollup config (`scripts/defender-actions/rollup.config.cjs`) to handle `.ts` input

### Defender Actions (13 files, ~780 LOC)

Located in `scripts/defender-actions/`. These are small, isolated async handler functions for OpenZeppelin Defender automation. Average ~60 LOC each.

Files to migrate:

- `doAccounting.js` (91 LOC)
- `registerValidators.js` (96 LOC)
- `stakeValidators.js` (88 LOC)
- `harvest.js` (77 LOC)
- `crossChainRelay.js` (~72 LOC)
- `crossChainRelayHyperEVM.js` (~72 LOC)
- Remaining smaller utilities (21-42 LOC each)

Work involved:

1. Rename `.js` → `.ts`
2. Add types to function parameters and return values
3. Type ethers contract interactions
4. Verify rollup bundling still works

## Phase 2 — Utils (~2-3 days)

**Goal:** Type the shared foundation that all other code depends on.

Located in `utils/`. Key files:

- `addresses.js` (32KB) — Master address registry. Strong candidate for types: network-keyed maps of contract addresses
- `deploy.js` (44KB) — Core deployment helpers (`deployWithConfirmation`, `withConfirmation`)
- `validator.js` (25KB) — Validator management
- `beacon.js` (14KB) — Beacon-related utilities
- `deploy-l2.js` (14KB) — L2-specific deployment logic
- `hardhat-helpers.js` (7.9KB) — Hardhat utilities
- Remaining ~30 smaller utility files

Benefits:

- `addresses.js` gets compile-time validation of network/contract name lookups
- Shared helper function signatures become self-documenting
- Downstream code (deploy scripts, tasks) gets better IDE support even before migration

## Phase 3 — Deploy Scripts & Tasks (1-2 weeks, or ongoing)

**Goal:** Migrate operational scripts as they are touched.

### Deploy Scripts (121 files, ~7,300 LOC)

Located in `deploy/` with network-specific subdirectories (mainnet, base, sonic, plume, hoodi, arbitrum, holesky, hyperevm). All follow `hardhat-deploy` conventions.

Note: `hardhat-deploy` has limited TypeScript type definitions. Custom type helpers may be needed for the deploy function signature and `DeploymentsExtension`.

### Tasks (35 files, ~10,000 LOC)

Located in `tasks/`. Hardhat `task()` API with ethers contract interactions.

Key files by size: `tasks.js` (2,753 LOC), `beacon.js` (1,137 LOC), `validatorCompound.js` (888 LOC).

Both categories can be migrated file-by-file. No need to do them all at once.

## Phase 4 — Tests (ongoing, as files are touched)

**Goal:** Migrate test infrastructure first, then individual test files over time.

Located in `test/`. By far the largest category at ~39K LOC across 87 files.

Recommended order:

1. Fixture files (`_fixture.js`, `_fixture-base.js`, `_fixture-sonic.js`) — these are imported by everything
2. Helper files (`helpers.js`, `_hot-deploy.js`)
3. Behavioral test suites (`test/behaviour/`) — shared across strategies
4. Individual test files as they are modified

Dependencies: `chai`, `ethereum-waffle`, `ethers`, `hardhat`. All have TypeScript type definitions available.

## Key Considerations

- **ethers v5 has built-in types** — contract calls, signers, and BigNumber operations all benefit from TS
- **Hardhat has native TS support** — config, tasks, and scripts can all be `.ts` without extra setup beyond `ts-node`
- `**hardhat-deploy` typing is limited** — may need custom `.d.ts` declarations for deploy function patterns
- **Rollup bundling** for defender actions needs a TypeScript plugin (e.g., `@rollup/plugin-typescript`)
- **No ESM migration required** — TS can emit CommonJS, keeping compatibility with existing code
- **Prettier and ESLint** need updates: add `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`

