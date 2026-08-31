# Origin DeFi's OTokens: Origin Dollar (OUSD) and Origin Ether (OETH)

For more details about the product, checkout [our docs](https://docs.oeth.com).

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

The smart contracts and their associated code are located in the `<project-root>/contracts` directory. [Foundry](https://book.getfoundry.sh/) builds, tests, and deploys the contracts. [Hardhat](https://hardhat.org/) remains available for operational tasks and the local forked EVM node.

A variety of Hardhat [tasks](https://hardhat.org/guides/create-task.html) are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.
<br/><br/>

---

## Running the node

The dapp interacts with many 3rd party contracts (Uniswap, Curve, Sushiswap) and it would be too cumbersome to initialize all those contracts in a fresh node environment and set them to a state that mimics the Mainnet. For that reason we are using Hardhat's forked mode. By setting the `BLOCK_NUMBER` environment variable, the node will download part of the mainnet state that it requires to fulfill the requests. It is less reliable since the node isn't as stable in forked mode (and sometimes requires restarts), but mimicking the mainnet is a huge benefit. We used to develop with fresh state node, but the behavior discrepancies between fresh node and mainnet have started to become too large. For that reason, we have deprecated the fresh state development.
<br/><br/>

Rename `contracts/dev.env` to `.env` and set `PROVIDER_URL` to a valid one (sign up for an Alchemy or Infura account, create an API key, and use the URL they provide). To pin the fork to a specific mainnet block, set `BLOCK_NUMBER`. Open a separate terminal to run the Hardhat node.
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

## Running Contract Tests

The contract test suite uses Foundry. From the `contracts/` directory:

```bash
make test-unit
make test-fork-mainnet
make test-smoke-mainnet
```

Equivalent fork and smoke targets exist for the other supported networks. See
[contracts/tests/README.md](contracts/tests/README.md) for the test conventions
and complete command list.

---

## Contributing

Want to contribute to OUSD? Awesome!

OUSD is an Open Source project and we welcome contributions of all sorts. There are many ways to help, from reporting issues, contributing code, and helping us improve our community.

The best way to get involved is to join the Origin Protocol [discord server](https://discord.gg/jyxpUSe) and head over to the channel named ORIGIN DOLLAR & DEFI

# Utils

## Git pre-commit hooks (using Husky)

[husky](https://typicode.github.io/husky/) is a development dependency in the root project folder. To install, run `pnpm` in the project root folder.

If the [.husky/pre-commit](.husky/pre-commit) script returns non-zero, the pre-commit hook will fail. Currently, the script runs the contracts linter. Use `git commit --no-verify` if you have the hook enabled and you'd like to skip the pre-commit check.
