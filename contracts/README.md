# Contract Development

## Prettier

Both Solidity and JavaScript code are formatted using [Prettier](https://prettier.io/).

The configuration for Prettier is in [.prettierrc](./.prettierrc).
This should already be configured in the VS Code settings file [.vscode/settings.json](../.vscode/settings.json). [.prettierignore](./.prettierignore) is used to ignore files from being formatted.

The following package scripts can be used to format code:

```
# Check for any formatting issues
pnpm prettier:check

# Format all Solidity files
pnpm prettier:sol

# Format all JavaScript files
pnpm prettier:js

# Format both Solidity and JavaScript files
pnpm prettier
```

## Linter

[solhit](https://protofire.github.io/solhint/) is used to lint Solidity code. The configuration for solhint is in [.solhint.json](./.solhint.json). [.solhintignore](./.solhintignore) is used to ignore Solidity files from being linted.

[eslint](https://eslint.org/) is used to lint JavaScript code. The configuration for eslint is in [.eslintrc.js](./.eslintrc.js).

```
# Check for any Solidity linting issues
pnpm lint:sol

# Check for any JavaScript linting issues
pnpm lint:sol

# Check for any Solidity or JavaScript linting issues
pnpm lint
```

## Toolchains

[Foundry](https://book.getfoundry.sh/) is the contract toolchain. It builds,
tests, and deploys contracts:

```sh
make build
make test-unit
make simulate
```

Operational commands use the standalone TypeScript CLI. Local forks use Anvil:

```sh
pnpm ops <command> --network <network>
pnpm node:mainnet
```

Run `pnpm ops help` for the full command catalogue and
`pnpm ops <command> --help` for a command's options. The legacy runtime remains
available only as a temporary A/B oracle during this migration.

## Testing

Foundry is the contract test runner. From this directory:

```sh
make test-unit
make test-fork-mainnet
make test-fork-base
```

Tests live under [`tests/`](./tests). Contract mocks live under [`contracts/mocks/`](./contracts/mocks) and Foundry-specific mocks under [`tests/mocks/`](./tests/mocks).

The remaining Mocha suite validates the standalone ops implementation, not smart contracts:

```sh
pnpm test:tasks
```

## Logger

A logger using the [debug](https://www.npmjs.com/package/debug) packages is used for logging tests and tasks.

To use, import the [utils/logger.js](./utils/logger.js) file and specify the module you are logging from. For example

```js
const log = require("../utils/logger")("module-name");
log("something interesting happened");
```

The module name is appended to `origin:`, so the above example would log `origin:module-name something interesting happened`.

To enable, export the `DEBUG` environment variable.

```
# enable all logging
export DEBUG=origin*

# enable logging for a specific module
export DEBUG=origin:module-name*
```

Example module names

- utils:1inch
- utils:curve
- task:token
- utils:deploy

## Contract Sizes

Foundry reports deployed and init code sizes during compilation:

```sh
forge build --sizes
```


## Signers

When using standalone ops commands, there are a few options for specifying the wallet to send transactions from.

1. Primary key
2. AWS KMS signer
3. Impersonate

### Primary Key

The primary key of the account to be used can be set with the `DEPLOYER_PK` or `GOVERNOR_PK` environment variables. These are traditionally used for contract deployments.

> Add `export HISTCONTROL=ignorespace` to your shell config, eg `~/.profile` or `~/.zprofile`, so any command with a space at the start won’t go into your history file.

When finished, you can unset the `DEPLOYER_PK` and `GOVERNOR_PK` environment variables so they aren't accidentally used.

```
unset DEPLOYER_PK
unset GOVERNOR_PK
```

### AWS KMS Signer

Standalone ops commands can sign transactions with AWS KMS when both `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` are set.

The default `relayer-id` is `origin-relayer-production-evm`. Some tasks can be mapped
to different defaults in code, and a user-provided task parameter always wins:

```
pnpm ops <command> --network <network> --relayer-id <kms-key-id-or-alias>
```

The relayer resolution precedence is:

1. `--relayer-id`
2. task-name based override map
3. global default (`origin-relayer-production-evm`)

### Impersonate

If using a fork test or node, you can impersonate any externally owned account or contract. Export `IMPERSONATE` with the address of the account you want to impersonate. The account will be funded with some Ether. For example

```
export IMPERSONATE=0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC
```

When finished, you can stop impersonating by unsetting the `IMPERSONATE` environment variable.

```
unset IMPERSONATE
```

### Automated Actions (Talos)

The standalone actions under `contracts/tasks/actions/` are driven in
production by a container that imports
[`@oplabs/talos-client`](https://github.com/oplabs/talos):

- **`contracts/runner.ts`** calls `runContainer({ product: "origin-dollar", workdir: "/app" })`. The library reads enabled rows from the shared Talos Postgres, fires them via croner, and runs the command stored with each schedule.
- **`contracts/migrations/seed_schedules.sql`** seeds those commands using `pnpm exec tsx tasks/run.ts <name> --network <chain>`.
- **`contracts/tasks/lib/signer.ts`** wraps the standalone signer with `wrapSignerWithNonceQueueV5` when `DATABASE_URL` is set. That routes `signer.sendTransaction` through Postgres row-locked nonce coordination across concurrent runs.

Every scheduled action — its cadence and one-line purpose — is catalogued in [`docs/ACTIONS.md`](docs/ACTIONS.md).

Run an action locally through the standalone CLI:

```
pnpm action harvest --network mainnet
pnpm action healthcheck --network mainnet
```

**No Postgres required for local runs.** The library's nonce queue is gated by `process.env.DATABASE_URL`: if unset, the action uses a raw ethers signer with ethers' own nonce handling. The gate is a single `if (!process.env.DATABASE_URL) return null` check at the top of the handler — no DB connection is opened. If you want to opt in locally (e.g., via `docker compose up`), set `DATABASE_URL` and the queue engages; `unset DATABASE_URL` to go back.

Building the runner image installs the optional `@oplabs/talos-client` peer
dependency from GitHub Packages. Set `TALOS_PACKAGE_TOKEN` to a PAT with
`read:packages` access before running `docker compose build`.

Actions that propose transactions through the Safe Transaction Service require
`SAFE_API_KEY`. The active Talos signer must be registered separately on each
chain as a delegate for the target Safe. A delegate can submit a proposal but
does not provide an owner confirmation or reduce the Safe threshold.

## Contract Verification

### Auto-verification

The Foundry deployment targets verify newly deployed contracts automatically:

```
make deploy-mainnet
```

Equivalent targets exist for the other supported networks; see `scripts/deploy/README.md`.

### Manual verification

Use Foundry's `forge verify-contract`; see the [Foundry verification documentation](https://getfoundry.sh/forge/reference/verify-contract/) for supported explorers and constructor arguments.

### Deployed contract code verification

To verify the deployed contract against the locally compiled contracts sol2uml from Nick Addison is convenient:

```
sol2uml diff [0x_address_of_the_deployed_contract] .,node_modules
```

## Continuous Integration

[GitHub Actions](https://github.com/features/actions) are used for the build.
Workflow definitions are in [`.github/workflows/`](../.github/workflows/). The
action workflows can be found at https://github.com/OriginProtocol/origin-dollar/actions.

There are separate actions for:

- Contract formatting and linting
- Unit tests
- Fork tests
