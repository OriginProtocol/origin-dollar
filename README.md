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

The smart contracts and their associated code are located in the `<project-root>/contracts` directory. [Foundry](https://book.getfoundry.sh/) builds, tests, and deploys the contracts. The standalone `pnpm ops` CLI runs operational commands and Anvil provides the local forked EVM node.

A variety of operational commands are available to interact with the contracts. Run `pnpm ops help` from the `contracts/` directory to list them.
<br/><br/>

---

## Running the node

The dapp interacts with many third-party contracts (Uniswap, Curve, Sushiswap), so local development uses an Anvil fork rather than recreating Mainnet state. Set `BLOCK_NUMBER` to pin the fork; unset means latest.
<br/><br/>

Rename `contracts/dev.env` to `.env` and set `MAINNET_PROVIDER_URL` to a valid endpoint. To pin the fork to a specific mainnet block, set `BLOCK_NUMBER`. Open a separate terminal to run Anvil.
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
