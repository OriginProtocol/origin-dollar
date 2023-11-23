# Origin DeFi's OTokens: Origin Dollar (OUSD) and Origin Ether (OETH)
 
For more details about the product, checkout [our docs](https://docs.oeth.com).

---

| Branch    | CI/CD Status                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master`  | [![Origin DeFi](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml/badge.svg)](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml)                                       |
| `staging` | [![Origin DeFi](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml/badge.svg?branch=staging)](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml?query=branch%3Astaging) |
| `stable`  | [![Origin DeFi](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml/badge.svg?branch=stable)](https://github.com/OriginProtocol/origin-dollar/actions/workflows/defi.yml?query=branch%3Astable)   |

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

The `origin-dollar` project is a mono repo that hosts both the `smart contracts` and `dapp` code bases. In order to run this project locally, you will need to run both the `Eth node` and the `dapp` in separate processes or terminals.

### Eth Node

The `smart contracts` and all of their associated code are located in the `<project-root>/contracts` directory. The Ethereum tests and the local Ethereum EVM node are managed by [Hardhat](https://hardhat.org/).

A variety of Hardhat [tasks](https://hardhat.org/guides/create-task.html) are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.
<br/><br/>

### dapp (Decentralized Application)

The code for `dapp` is located under the `/dapp` directory.
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
yarn install

# Run the node in forked mode
yarn run node
```

### Minting Stablecoins via hardhat task

This is an option, but a simpler way is to use the `ACCOUNTS_TO_FUND` setting described above.

```bash
# Mint 1000 worth of each supported stablecoin to each account defined in the mnemonic
npx hardhat fund --amount 1000 --network localhost
```

##### Requirements

- You will need your web3 wallet configured before you can interact with the dapp. Make sure that you have one - refer to [this section](#configure-web3-wallet) for `Metamask` instructions.
- You will also need the dapp to be running. Refer to [this section](#running-the-dapp-locally) for instructions.

### Configure Web3 Wallet

You will need a web3 wallet to interact with the dapp and sign transactions. Below are the instructions to setup `Metamask` to interact with the dapp running locally.

- Install `Metamask` Chrome extension [HERE](https://metamask.io/)
- Create/Open `Metamask` wallet
- Add a custom RPC endpoint
  - Name: `origin` - just an example
  - URL: `http://localhost:8545`
  - Chain ID: `1337`
    <br/><br/>

#### Add Accounts to Metamask

##### Forked mode

Just use the account(s) you normally use on mainnet.

##### Standalone mode

You can get all the accounts for the locally running node and their associated private keys by running the command

```bash
# For Standalone mode
npx hardhat accounts --network localhost
```

Choose a test account past index 3 (accounts 0-3 are reserved).
Copy the private key and import it into Metamask as follows:

- Click the current account icon in the upper right corner of `Metamask`
- Select `Import Account` => paste private key => Click `Import`

Make sure that you select your newly created RPC endpoint in the networks dropdown and use your newly imported account in `Metamask`. You should now be setup to use `Metamask` to interact with the dApp.

Note:
If you want to add all the accounts via a new `Metamask` wallet and import the `mnemonic` it is located in `contracts/hardhat.config.js`. Make sure that you use Account 4 and up for test accounts as 0-3 are reserved.
<br/><br/>

### Running the dapp

Open a separate terminal to run the dapp in.

```bash
# Enter the smart dapp dir (or oeth-dapp)
cd dapp

# Install the dependencies
yarn install

# Start the dapp
yarn run start
```

- Open http://localhost:3000 in your browser and connect your `Metamask` account. See [this section](#configure-web3-wallet) for instructions if you have not done that yet.
- Open http://localhost:3000/swap and verify that you have stablecoins in your account. See [this section](#minting-stablecoins-via-hardhat-task) for instructions if you don't see a balance.

If you see a `Runtime Error: underlying network changed`, then rename `dapp/dev.env` to `.env` and restart `yarn`

If you see an error resembling `digital envelope routines::unsupported`, you are likely using an incompatible Node.js version. At last check, v16.20.2 is good.

### Troubleshooting

When freshly starting a node it is usually necessary to also reset Metamask Account being used:

- `Metamask` => `Settings` => `Advanced` => `Reset Account`
  <br/><br/>
  This will reset the nonce number that is incorrect if you have submitted any transactions in previous runs of the ethereum node. (Wallet has a too high nonce number comparing to the nonce state on the node)

If you get an `error Command "husky-run" not found.` type of error:
Go to root of the project and run `npx husky install`

---

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

OUSD is an Open Source project and we welcome contributions of all sorts. There are many ways to help, from reporting issues, contributing to the code, and helping us improve our community.

The best way to get involved is to join the Origin Protocol [discord server](https://discord.gg/jyxpUSe) and head over to the channel named ORIGIN DOLLAR & DEFI

# Utils

## Git pre-commit hooks (using Husky)

### Setup
```
# install Husky
npx install husky

# from project root folder install Husky hooks
npx husky install

```

If the script in .husky/pre-commit returns non 0 exit the pre-commit hook will fail. Currently the script prevents a commit if there is an ".only" in the test scripts. Use "git commit --no-verify" if you have the hook enabled and you'd like to skip pre-commit check.
