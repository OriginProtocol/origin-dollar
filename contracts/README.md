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

## Slither

### Install slither

If you use the slither documented "pip3 install slither-analyzer" there might be problems with package collisions. Just use pipx that installs any package and all dependencies in sandbox to circumvent the issue: `pipx install slither-analyzer`

#### Troubleshooting

Run `slither --version` and make sure it is >= 0.10.0. If the version is lower it is possible that pipx has used an older version of the python to create a virtual environment and install the slither package. E.g. Slither 0.10.0 requires python >= 3.8.0 and if lower one is available a lower version of slither shall be installed. To mitigate:

```
# uninstall slither analyzer (which also uninstalls virtual environment)
pipx uninstall slither-analyzer

# make sure your python3 version is above 3.8.0 (if not update it)
python3 --version

# using python3 install slither-analyzer again - this will also create a new python virtual environment with the forced python version. Verbose flat can provide useful information
pipx install slither-analyzer --python [/usr/local/bin/python3 - adjust if required] --verbose
```

[Slither](https://github.com/crytic/slither#slither-the-solidity-source-analyzer) is used to for Solidity static analysis.

The [Slither installation](https://github.com/crytic/slither#how-to-install) instruction.

```
## Run Slither
pnpm slither
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

Run `pnpm ops help` for the full command catalogue. The legacy runtime remains
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
- Slither static analysis
- Unit tests
- Fork tests

## Active yield forwards

Here is the list of active yield forwards (which shall be removed once Monitoring shall be able to display it):
| Chain | From | To |
|-------|------------------------------------|-------------------------------------------|
| sonic | addresses.sonic.Shadow.OsEco.pool | addresses.sonic.Shadow.OsEco.yf_treasury |
| sonic | addresses.sonic.SwapX.OsHedgy.pool | addresses.sonic.SwapX.OsHedgy.yf_treasury |
| sonic | 0x51caf8b6d184e46aeb606472258242aacee3e23b (SwapX: MOON/OS ) | 0xa9d3b1408353d05064d47daf0dc98e104eb9c98a |
| sonic | 0x0666b11a59f02781854e778687ce312d6b306ce4 (SwapX: BOL/OS) | 0x3ef000Bae3e8105be55F76FDa784fD7d69CFf30e |
| sonic | 0x6feae13b486a225fb2247ccfda40bf8f1dd9d4b1 (SwapX: OS/EGGS) | 0x98Fc4CE3dFf1d0D7c9dF94f7d9b4E6E6468D5EfF |
| sonic | 0xbb9e9f35e5eda1eeed3d811366501d940866268f (Metropolis: BRUSH/OS) | 0x3b99636439FBA6314C0F52D35FEd2fF442191407 |
| sonic | 0x2e585b96a2ef1661508110e41c005be86b63fc34 (HOG Genesis reward pool) | 0xF0E3E07e11bFA26AEB0C0693824Eb0BF1653AE77 |
| sonic | SwapX.OsSfrxUSD.pool | address t.b.a (PB) |
| sonic | SwapX.OsScUSD.pool | address t.b.a (PB) |
| sonic | SwapX.OsSilo.pool | address t.b.a (PB) |
| sonic | SwapX.OsFiery.pool | address t.b.a (PB) |
| sonic | Equalizer.WsOs.pool | address t.b.a (PB) |
| sonic | Equalizer.ThcOs.pool | address t.b.a (PB) |
| | | |
