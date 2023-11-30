# Contract Development

## Prettier

Both Solidity and JavaScript code are formatted using [Prettier](https://prettier.io/).

The configuration for Prettier is in [.prettierrc](./.prettierrc).
This should already be configured in the VS Code settings file [.vscode/settings.json](../.vscode/settings.json). [.prettierignore](./.prettierignore) is used to ignore files from being formatted.

The following package scripts can be used to format code:

```
# Check for any formatting issues
yarn prettier:check

# Format all Solidity files
yarn prettier:sol

# Format all JavaScript files
yarn prettier:js

# Format both Solidity and JavaScript files
yarn prettier
```

## Linter

[solhit](https://protofire.github.io/solhint/) is used to lint Solidity code. The configuration for solhint is in [.solhint.json](./.solhint.json). [.solhintignore](./.solhintignore) is used to ignore Solidity files from being linted.

[eslint](https://eslint.org/) is used to lint JavaScript code. The configuration for eslint is in [.eslintrc.js](./.eslintrc.js).

```
# Check for any Solidity linting issues
yarn lint:sol

# Check for any JavaScript linting issues
yarn lint:sol

# Check for any Solidity or JavaScript linting issues
yarn lint
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
yarn slither
```

## Hardhat

[Hardhat](https://hardhat.org/) is used to compile, test, and deploy contracts. The configuration for Hardhat is in [hardhat.config.js](./hardhat.config.js).

```
# Compile changed contracts
npx hardhat compile

# Recompile all contracts
yarn clean
npx hardhat compile
```

Alternatively, the Hardhat companion npm package [hardhat-shorthand](https://www.npmjs.com/package/hardhat-shorthand) can be used as a shorthand for npx hardhat. Installation instructions can be found [here](https://hardhat.org/hardhat-runner/docs/guides/command-line-completion#installation).

```
## Compile
hh compile

## Tasks
hh task
```

## Testing

### Unit Tests

Hardhat tests are used for contract unit tests which are under the [test](./test) folder. Contract mocks are under the [contracts/mocks](./contracts/mocks) folder.

```
# Run all unit tests
yarn test
```

### Fork Tests

Set your `PROVIDER_URL` and desired `BLOCK_NUMBER` in your [.env](./.env) file. The can be copied from [dev.env](./dev.env).

```
# in one terminal
yarn run node

# in another terminal
yarn test:fork
```

See [Fork Tests](./fork-test.md) for more information.

### Hot Deploys

You can enable the "hot deploy" mode when doing fork testing development. The mode enables updating the contract code much faster and more conveniently comparing to running deploy scripts. Each time a fork test suite is ran, the configured contracts are updated

To enable Hot Deploys set the HOT_DEPLOY variable in the contracts/.env file. Enable various modes using comma separated flags to direct which contracts need source updated (in the node runtime): 
- strategy -> strategy contract associated to fixture
- vaultCore -> vaultCore or oethVaultCore depending on the nature of the fixture
- vaultAdmin -> vaultAdmin or oethVaultAdmin depending on the nature of the fixture
- harvester -> harvester or oethHarvester (not yet supported)

example: HOT_DEPLOY=strategy,vaultCore,vaultAdmin,harvester

#### Supporting new fixtures / contracts

Each fixture from the `_fixture.js` file needs to have custom support added for hot deploys. Usually that consists of creating constructor arguments for the associated strategy contract and mapping the fixture to strategy contracts needing the update. See how things work in "contracts/test/_hot-deploy.js"

### Echidna tests

[Echidna](https://github.com/crytic/echidna#echidna-a-fast-smart-contract-fuzzer-) is used for fuzzing tests.

Installation instructions can be found [here](https://github.com/crytic/echidna#installation).

```
# Run Echidna tests
yarn echidna
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
- test:unit:vault
- test:fork:vault
- test:fork:oeth:metapool

## Contract Sizes

The Hardhat plug-in [hardhat-contract-sizer](https://www.npmjs.com/package/hardhat-contract-sizer) is used to report the size of contracts.

This is not enabled by default. To enable, export the `CONTRACT_SIZE` environment variable.

```
export CONTRACT_SIZE=true
```

The contract sizes will be output after the contracts are compiled. Here's a sample of the first few.

```
Compiled 155 Solidity files successfully
 ·-----------------------------------------|--------------------------------|--------------------------------·
 |  Solc version: 0.8.7                    ·  Optimizer enabled: true       ·  Runs: 200                     │
 ··········································|································|·································
 |  Contract Name                          ·  Deployed size (KiB) (change)  ·  Initcode size (KiB) (change)  │
 ··········································|································|·································
 |  AaveStrategy                           ·                     11.427 ()  ·                     11.583 ()  │
 ··········································|································|·································
 |  AaveStrategyProxy                      ·                      2.438 ()  ·                      2.591 ()  │
 ··········································|································|·································
 |  Address                                ·                      0.084 ()  ·                      0.138 ()  │
```

## Gas Usage

The Hardhat plug-in [hardhat-gas-reporter](https://github.com/cgewecke/hardhat-gas-reporter#hardhat-gas-reporter) is used to report gas usage of unit and fork tests.

This is not enabled by default. To enable, export the `REPORT_GAS` environment variable.

```
export REPORT_GAS=true
```

If enabled, the gas usage will be output in a table after the tests have executed. For example

```
·--------------------------------|---------------------------|-------------|-----------------------------·
|      Solc version: 0.8.7       ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30000000 gas  │
·································|···························|·············|······························
|  Methods                                                                                               │
··············|··················|·············|·············|·············|···············|··············
|  Contract   ·  Method          ·  Min        ·  Max        ·  Avg        ·  # calls      ·  eur (avg)  │
··············|··················|·············|·············|·············|···············|··············
|  ERC20      ·  approve         ·      26080  ·      65406  ·      39783  ·           96  ·          -  │
··············|··················|·············|·············|·············|···············|··············
|  ERC20      ·  transfer        ·      51427  ·      88327  ·      61066  ·           90  ·          -  │
··············|··················|·············|·············|·············|···············|··············
|  MockVault  ·  mint            ·     554883  ·     576124  ·     564880  ·            4  ·          -  │
··············|··················|·············|·············|·············|···············|··············
|  MockWETH   ·  deposit         ·          -  ·          -  ·      27938  ·           10  ·          -  │
··············|··················|·············|·············|·············|···············|··············
|  OETHVault  ·  setVaultBuffer  ·      34984  ·      56956  ·      45970  ·            2  ·          -  │
··············|··················|·············|·············|·············|···············|··············
|  OETHVault  ·  swapCollateral  ·     482418  ·    1018400  ·     705017  ·           57  ·          -  │
··············|··················|·············|·············|·············|···············|··············
|  Deployments                   ·                                         ·  % of limit   ·             │
·································|·············|·············|·············|···············|··············
|  MockOETHOracleRouterNoStale   ·          -  ·          -  ·     529194  ·        1.8 %  ·          -  │
·································|·············|·············|·············|···············|··············
|  MockOracleRouterNoStale       ·          -  ·          -  ·     743016  ·        2.5 %  ·          -  │
```

## Signers

When using Hardhat tasks, there are a few options for specifying the wallet to send transactions from.

1. Primary key
2. Impersonate
3. Defender Relayer

### Primary Key

The primary key of the account to be used can be set with the `DEPLOYER_PK` or `GOVERNOR_PK` environment variables. These are traditionally used for contract deployments.

> Add `export HISTCONTROL=ignorespace` to your shell config, eg `~/.profile` or `~/.zprofile`, so any command with a space at the start won’t go into your history file.

When finished, you can unset the `DEPLOYER_PK` and `GOVERNOR_PK` environment variables so they aren't accidentally used.

```
unset DEPLOYER_PK
unset GOVERNOR_PK
```

### Impersonate

If using a fork test or node, you can impersonate any externally owned account or contract. Export `IMPERSONATE` with the address of the account you want to impersonate. The account will be funded with some Ether. For example

```
export IMPERSONATE=0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC
```

When finished, you can stop impersonating by unsetting the `IMPERSONATE` environment variable.

```
unset IMPERSONATE
```

### Defender Relayer

Open Zeppelin's [Defender](https://defender.openzeppelin.com/) product has a [Relayer](https://docs.openzeppelin.com/defender/v2/manage/relayers) service that is a managed wallet. It handles the nonce, gas, signing and sending of transactions.

To use a [Relayer](https://defender.openzeppelin.com/v2/#/manage/relayers) account, first log into Defender and create an API key for the account you want to use. Use the generated API key and secret to set the `DEFENDER_API_KEY` and `DEFENDER_API_SECRET` environment variables.

```
export DEFENDER_API_KEY=
export DEFENDER_API_SECRET=
```

Once you have finished sending your transactions, the API key for hte Relayer account should be deleted in Defender and the environment variables unset.

```
unset DEFENDER_API_KEY
unset DEFENDER_API_SECRET
```

## Contract Verification

The Hardhat plug-in [@nomiclabs/hardhat-etherscan](https://www.npmjs.com/package/@nomiclabs/hardhat-etherscan) is used to verify contracts on Etherscan.

There's an example

```
npx hardhat --network mainnet verify --contract contracts/vault/VaultAdmin.sol:VaultAdmin 0x31a91336414d3B955E494E7d485a6B06b55FC8fB
```

## Continuous Integration

[GitHub Actions](https://github.com/features/actions) are used for the build. The configuration for GitHub Actions is in [.github/workflows/defi.yml](../.github/workflows/defi.yml). The action workflows can be found at https://github.com/OriginProtocol/origin-dollar/actions.

There are separate actions for:

- Contract formatting and linting
- Dapp formatting and linting
- Slither static analysis
- Unit tests
- Fork tests

## Coverage

The Hardhat plug-in [solidity-coverage](https://github.com/sc-forks/solidity-coverage#solidity-coverage) is used to gather Solidity code coverage. The configuration is in [.solcover.js](./.solcover.js). The coverage output is written to `coverage.json`.

[Codecov](https://about.codecov.io/) is used to report Solidity code coverage. The coverage reports for this repository can be found [here](https://app.codecov.io/gh/OriginProtocol/origin-dollar).

```
# Unit test coverage
yarn test:coverage

# For test coverage
yarn test:fork:coverage
```

The CI will upload the coverage reports to Codecov if they complete successfully.
