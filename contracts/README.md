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

## Hardhat

[Hardhat](https://hardhat.org/) is used to compile, test, and deploy contracts. The configuration for Hardhat is in [hardhat.config.js](./hardhat.config.js).

```
# Compile changed contracts
npx hardhat compile

# Recompile all contracts
pnpm clean
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
pnpm test
```

### Fork Tests

Set your `PROVIDER_URL` and desired `BLOCK_NUMBER` in your [.env](./.env) file. The can be copied from [dev.env](./dev.env).

```
# in one terminal
pnpm run node

# in another terminal
pnpm test:fork
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

Each fixture from the `_fixture.js` file needs to have custom support added for hot deploys. Usually that consists of creating constructor arguments for the associated strategy contract and mapping the fixture to strategy contracts needing the update. See how things work in "contracts/test/\_hot-deploy.js"

### Echidna tests

[Echidna](https://github.com/crytic/echidna#echidna-a-fast-smart-contract-fuzzer-) is used for fuzzing tests.

Installation instructions can be found [here](https://github.com/crytic/echidna#installation).

```
# Run Echidna tests
pnpm echidna
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

### Deploying Defender Actions

Actions are used to run operational jobs are specific times or intervals.

[rollup](https://rollupjs.org/) is used to bundle Actions source code in
[/scripts/defender-actions](./scripts/defender-actions) into a single file that can be uploaded to Defender. The
implementation was based off
[Defender Actions example using Rollup](https://github.com/OpenZeppelin/defender-autotask-examples/tree/master/rollup).
The rollup config is in [/scripts/defender-actions/rollup.config.cjs](./scripts/defender-actions/rollup.config.cjs). The
outputs are written to task specific folders under [/scripts/defender-actions/dist](./scripts/defender-actions/dist/).

The [defender-autotask CLI](https://www.npmjs.com/package/@openzeppelin/defender-autotask-client) is used to upload the
Action code to Defender. For this to work, a Defender Team API key with `Manage Actions` capabilities is needed. This
can be generated by a Defender team admin under the `Manage` tab on the top right of the UI and then `API Keys` on the
left menu. Best to unselect all capabilities except `Manage Actions`.

Save the Defender Team API key and secret to your `.env` file.

```
# Open Zeppelin Defender Team API key
DEFENDER_TEAM_KEY=
DEFENDER_TEAM_SECRET=
```

The following will bundle the Actions code ready for upload.

```
cd ./scripts/defender-actions

npx rollup -c
```

The following will upload the different Action bundles to Defender.

```sh
# change to the defender-actions folder
cd ./scripts/defender-actions
npx rollup -c

# Export the DEFENDER_TEAM_KEY and DEFENDER_TEAM_SECRET environment variables
export DEFENDER_TEAM_KEY=
export DEFENDER_TEAM_SECRET=
# Alternatively, the following can be used but it will export all env var including DEPLOYER_PRIVATE_KEY
# set -o allexport && source ../../.env && set +o allexport

# Set the DEBUG environment variable to oeth* for the Defender Action
npx hardhat setActionVars --id 38e44420-f38b-4d4a-86b0-6012a8897ad9
npx hardhat setActionVars --id f4b5b8d4-82ff-483f-bfae-9fef015790ca
npx hardhat setActionVars --id 191d9631-70b9-43c5-9db4-1dd985fde05c
npx hardhat setActionVars --id e2929f53-db56-49b2-b054-35f7df7fc4fb
npx hardhat setActionVars --id 12c153c8-c5ca-420b-9696-e80c827996d1
npx hardhat setActionVars --id 6e4f764d-4126-45a5-b7d9-1ab90cd3ffd6
npx hardhat setActionVars --id 84988850-6816-4074-8e7b-c11cb2b32e7e
npx hardhat setActionVars --id f92ea662-fc34-433b-8beb-b34e9ab74685
npx hardhat setActionVars --id b1d831f1-29d4-4943-bb2e-8e625b76e82c

# The Defender autotask client uses generic env var names so we'll set them first from the values in the .env file
export API_KEY=${DEFENDER_TEAM_KEY}
export API_SECRET=${DEFENDER_TEAM_SECRET}
# Holesky
npx defender-autotask update-code 38e44420-f38b-4d4a-86b0-6012a8897ad9 ./dist/registerValidators
npx defender-autotask update-code 191d9631-70b9-43c5-9db4-1dd985fde05c ./dist/doAccounting
# Mainnet
npx defender-autotask update-code f4b5b8d4-82ff-483f-bfae-9fef015790ca ./dist/registerValidators
npx defender-autotask update-code 12c153c8-c5ca-420b-9696-e80c827996d1 ./dist/stakeValidators
npx defender-autotask update-code e2929f53-db56-49b2-b054-35f7df7fc4fb ./dist/doAccounting
npx defender-autotask update-code 6e4f764d-4126-45a5-b7d9-1ab90cd3ffd6 ./dist/harvest
npx defender-autotask update-code 84988850-6816-4074-8e7b-c11cb2b32e7e ./dist/sonicRequestWithdrawal
npx defender-autotask update-code f92ea662-fc34-433b-8beb-b34e9ab74685 ./dist/sonicClaimWithdrawals
npx defender-autotask update-code b1d831f1-29d4-4943-bb2e-8e625b76e82c ./dist/claimBribes
```

`rollup` and `defender-autotask-client` can be installed globally to avoid the `npx` prefix.

### Encrypting / decrypting validator private keys

When handling secrets, it is important they can not be compromised. For that reason, we have put security in place to make sure that private keys of validators are encrypted at rest and can be securely decrypted.

P2P's API uses a Elliptic-curve Diffie–Hellman (ECDH) protocol to encrypt the validator private keys.

The process is as follows:

1. Origin creates an Elliptic-curve key using the secp256r1 (prime256v1) curve.
2. The public key is encoded to P2P's required format.
3. The encoded public key is included in the `ecdhPublicKey` field of P2P's Create SSV API requests.
4. P2P includes the encrypted validator private key in the response to Check Status API requests. Specifically, the `ecdhEncryptedPrivateKey` field of the `encryptedShares` array of validators.
5. Origin stores the encrypted validator private key in an AWS S3 bucket.
6. Origin uses the private key to decrypt the encrypted validator private keys if ever needed.

#### Storing encrypted validator private keys

Defender Action that operates the validators will by default request a validator with encrypted private keys and store those encrypted keys in the `validator-keys` S3 bucket. Each validator private key is one S3 object and the name of the object is the pubkey (schema: [pubkey].json) of the validator. The S3 bucket has versioning enabled so we can always retrieve possibly overwritten / deleted objects.

#### Storing the master private key

The master private key is used to decrypt the validator private keys. It is encrypted using AWS KMS

1. The master private key is generated locally using the `genECDHKey` Hardhat task
2. The master private key is encrypted using AWS KMS using the `encryptMasterPrivateKey` Hardhat task
3. The encrypted master private key is kept out of the repo and securely shared with the team members who need it.

#### Decrypting validator private keys

The process is as follows:

1. The encrypted master private key is decrypted using AWS KMS
2. The master private key is used to decrypt the encrypted validator private key

In order to obtain the private key (for decrypting validator private keys), one needs to obtain the AWS KMS encrypted private key and store it in an `VALIDATOR_MASTER_ENCRYPTED_PRIVATE_KEY` environment variable (ask around in smart contract engineering to get it).

Fetch the API keys for AWS IAM user `validator_key_manager` and set them in the `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` environment variables.
Now you should be able to decrypt validator private keys that are stored in the `validator-keys` S3 bucket by running `npx hardhat masterDecrypt --message [ENCRYPTED_PRIVATE_KEY_FROM_BUCKET]`

**Example**: to test that the decryption works correctly and master key is setup right run the following

```
npx hardhat masterDecrypt --message BC8uniIOqEqqdt6/5MFtZRFpw9jCvVQsGpl893hQTo/MAMDefyyjGkngH39qBHPClDDdUFa9sEPJcS0qUrHJc9SXatYRvINprXTEPSUqbTAAUpBfiuX0gHyAW5cLJp5SAYsgU4rMxZAjtSof56oHQ0c3PGzz/9CBhEeSbFiboz7a/CDYm4adDUt1CbQdN0tKaQ==

#should produce
Validator public key: 90db8ae56a9e741775ca37dd960606541306974d4a998ef6a6227c85a973fc1d9d9b400cd38a2bfa337cc594cf060437
```

## Contract Verification

The Hardhat plug-in [@nomiclabs/hardhat-verify](https://www.npmjs.com/package/@nomiclabs/hardhat-etherscan) is used to verify contracts on Etherscan. Etherscan has migrated to V2 api where all the chains use the same endpoint. Hardhat verify should be run with `--contract` parameter otherwise there is a significant slowdown while hardhat is gathering contract information. 

**IMPORTANT:** 
 - Currently only yarn works. Do not use npx/pnpm
 - Also if you switch package manager do run "hardhat compile" first to mitigate potential bytecode missmatch errors

There's an example

```
yarn hardhat --network mainnet verify --contract contracts/vault/VaultAdmin.sol:VaultAdmin 0x31a91336414d3B955E494E7d485a6B06b55FC8fB
```

Example with constructor parameters passed as command params
```
yarn hardhat verify --network mainnet 0x0FC66355B681503eFeE7741BD848080d809FD6db --contract contracts/poolBooster/PoolBoosterFactoryMerkl.sol:PoolBoosterFactoryMerkl 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971 0xAA8af8Db4B6a827B51786334d26349eb03569731 0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd
```

Example with constructor parameters saved to file and file path passed to the command
```
echo "module.exports = [[
  \"0x0000000000000000000000000000000000000001\",
  \"0xe75d77b1865ae93c7eaa3040b038d7aa7bc02f70\"
}]" > flux-args.js
npx hardhat --network mainnet verify --contract contracts/strategies/FluxStrategy.sol:FluxStrategy --constructor-args flux-args.js 0x57d49c28Cf9A0f65B1279a97eD01C3e49a5A173f
```



`hardhat-deploy` package offers a secondary way to verify contracts, where contructor parameters don't need to be passed into the verification call. Since Etherscan has migrated to V2 api this approach is no longer working. `etherscan-verify` call uses `hardhat verify` under the hood.
```
yarn hardhat etherscan-verify --network mainnet --api-url https://api.etherscan.io
```

#### Addressing verification slowdowns

Profiling the `hardhat-verify` prooved that when the `hardhat verify` is ran without --contract parameter 
it can take up to 4-5 minutes to gather the necessary contract information. 
Use `--contract` e.g. `--contract contracts/vault/VaultAdmin.sol:VaultAdmin` to mitigate the issue.

#### Migration to full support of Etherscan V2 api

Migrating to Etherscan V2 has been attempted with no success.
Resources:
 - migration guid by Etherscan: https://docs.etherscan.io/v2-migration
 - guide for Hardhat setup: https://docs.etherscan.io/contract-verification/verify-with-hardhat. (note upgrading @nomicfoundation/hardhat-verify to 2.0.14 didn't resolve the issue last time) 
 - openzeppelin-upgrades claims to have solved the issue in 3.9.1 version of the package: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/1165 Not only does this not solve the verification issue, it is also a breaking change for our repo.

Good luck when attempting to solve this. 

### Deployed contract code verification

To verify the deployed contract against the locally compiled contracts sol2uml from Nick Addison is convenient:

```
sol2uml diff [0x_address_of_the_deployed_contract] .,node_modules
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
pnpm test:coverage

# For test coverage
pnpm test:fork:coverage
```

The CI will upload the coverage reports to Codecov if they complete successfully.

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
