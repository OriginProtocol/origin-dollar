# Origin DeFi's OTokens: Origin Dollar (OUSD) and Origin Ether (OETH)

For more details about the product, checkout [our docs](https://docs.oeth.com).

---

| Branch   | CI/CD Status                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master` | [![Origin DeFi](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml/badge.svg)](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml) |

## Requirements

- Node Version
  - `^16.0.0 >= node <=^18.0.0`
  - Recommended: `^18.0.0`
- Web3 Wallet
  - Recommended: [Metamask](https://metamask.io/)

---

## Installation

```bash
# Clone the origin-dollar project
git clone git@github.com:OriginProtocol/origin-dollar.git
cd origin-dollar
```

---

## Description

The `origin-dollar` project is a repo that hosts the smart contracts of some Origin DeFi projects including OUSD and OETH. For Governance related contracts, head over to (origin-dollar-governance)[https://github.com/OriginProtocol/ousd-governance]. In order to run this project locally, you will need to run the `Eth node`.

### Eth Node

The `smart contracts` and all of their associated code are located in the `<project-root>/contracts` directory. The Ethereum tests and the local Ethereum EVM node are managed by [Hardhat](https://hardhat.org/).

A variety of Hardhat [tasks](https://hardhat.org/guides/create-task.html) are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.
<br/><br/>

---

## Running the node

The dapp interacts with many 3rd party contracts (Uniswap, Curve, Sushiswap) and it would be too cumbersome to initialize all those contracts in a fresh node environment and set them to a state that mimics the Mainnet. For that reason we are using Hardhat's forked mode. By setting the `BLOCK_NUMBER` environment variable, the node will download part of the mainnet state that it requires to fulfill the requests. It is less reliable since the node isn't as stable in forked mode (and sometimes requires restarts), but mimicking the mainnet is a huge benefit. We used to develop with fresh state node, but the behavior discrepancies between fresh node and mainnet have started to become too large. For that reason, we have deprecated the fresh state development.
<br/><br/>

Rename `contracts/dev.env` to `.env` and set PROVIDER_URL to a valid one (Sign up for a free Alchemy or Infura account, create a new API key, and use the URL they provide). If you would like the forked net to mimic a more recent state of mainnet update the `BLOCK_NUMBER` to a more recent Ethereum block. Also add your mainnet testing account(s) (if more than one, comma separate them) under the `ACCOUNTS_TO_FUND`. After the node starts up, the script will transfer 100k of USDT, OUSD and DAI to those accounts. Open a separate terminal to run the hardhat node in.
<br/><br/>

Run the node:

```bash
# Enter the smart contracts dir
cd contracts

# Install the dependencies
pnpm i

# Do NOT run `pnpm approve-builds` as per the warning

# Run the node in forked mode
pnpm run node
```

### Minting Stablecoins via hardhat task

This is an option, but a simpler way is to use the `ACCOUNTS_TO_FUND` setting described above.

```bash
# Mint 1000 worth of each supported stablecoin to each account defined in the mnemonic
npx hardhat fund --amount 1000 --network localhost
```

## Running Smoke Tests

Smoke tests can be run in 2 modes:

- Run `scripts/test/smokeTest.sh` to launch interactive mode. All the "before contract changes" parts of tests
  will execute and wait for the user to manually using a console performs contract changes. Once those are done,
  hit "Enter" in the smoke test console and the second part of the tests shall be run that validate that contract
  changes haven't broken basic functionality.
- Run `scripts/test/smokeTest.sh --deployid [numeric_id_of_deploy]` will run smoke tests against a specific
  deployment validating that basic functionality didn't break.
  <br/><br/>

---

## Fork Tests

Head over to [contracts/fork-test.md](contracts/fork-test.md)

---

## Contributing

Want to contribute to OUSD? Awesome!

OUSD is an Open Source project and we welcome contributions of all sorts. There are many ways to help, from reporting issues, contributing code, and helping us improve our community.

The best way to get involved is to join the Origin Protocol [discord server](https://discord.gg/jyxpUSe) and head over to the channel named ORIGIN DOLLAR & DEFI

# Utils

## Git pre-commit hooks (using Husky)

[husky](https://typicode.github.io/husky/) is a development dependency in the root project folder. To install, run `pnpm` in the project root folder.

If the [.husky/pre-commit](.husky/pre-commit) script returns non-zero, the pre-commit hook will fail. Currently, the script runs the contracts linter. Use `git commit --no-verify` if you have the hook enabled and you'd like to skip the pre-commit check.
