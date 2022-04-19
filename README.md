# Origin Dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.
Checkout our [docs](https://docs.ousd.com) for more details about the product.

## Requirements
- Node Version
  - `^8.11.2 >= node <=^14.0.0`
  - Recommended: `^14.0.0`
- Web3 Wallet
  - Recommended: [Metamask](https://metamask.io/) 

---

## Installation
```bash
# Clone the origin-dollar project
git clone git@github.com:OriginProtocol/origin-dollar.git
```  

---

## Description

The `origin-dollar` project is a mono repo that hosts both the `smart contracts` and `dApp` code bases. In order to run this project locally, you will need to run both the `Eth node` and the `dapp` in separate processes or terminals. 


### Eth Node
The `smart contracts` and all of their associated code are located in the `<project-root>/contracts` directory. The Ethereum tests and the local Ethereum EVM node are managed by [Hardhat](https://hardhat.org/).

A variety of Hardhat [tasks](https://hardhat.org/guides/create-task.html) are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.
<br/><br/>

### dApp(Decentralized Application)
The code for `dApp` is located under the `/dapp` directory.
<br/><br/>

---
## Running the node

 The dapp interacts with many 3rd party contracts (Uniswap, Curve, Sushiswap) and it would be too cumbersome to initialize all those contracts in a fresh node environment and set them to a state that mimics the Mainnet. For that reason we are using Hardhat's forked mode. By setting the `BLOCK_NUMBER` the node will download part of the mainnet state that it requires to fulfill the requests. It is less reliable since the node isn't as stable in forked mode (and sometimes requires restarts), but mimicking the mainnet is a huge benefit. We used to develop with fresh state node, but the behavior discrepancies between fresh node and mainnet have started to become too large. For that reason we have deprecated the fresh state development. 
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
- You will also need the dApp to be running. Refer to [this section](#running-the-dapp-locally) for instructions.

### Configure Web3 Wallet
You will need a web3 wallet to interact with the dApp and sign transactions. Below are the instructions to setup `Metamask` to interact with the dApp running locally.

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
You can get all the accounts for the locally running node and their associate private keys by running the command 
```bash
# For Standalone mode
npx hardhat accounts --network localhost
```

Choose a test account past index 3 (accounts 0-3 are reserved).
Copy the private key and import it into Metamask as follows:
- Click the current account icon in the uppor right corner of `Metamask`
- Select `Import Account` => paste private key => Click `Import`

Make sure that you select your newly created RPC endpoint in the networks dropdown and use your newly imported account in `Metamask`. You should now be setup to use `Metamask` to interact with the dApp.

Note: 
If you want to add all the accounts via a new `Metamask` wallet and import the `mnemonic` it is located in `contracts/hardhat.config.js`. Make sure that you use Account 4 and up for test accounts as 0-3 are reserved.
<br/><br/>

### Running the dApp

Open a separate terminal to run the dApp in.

```bash
# Enter the smart dApp dir
cd dApp

# Install the dependencies
yarn install

# Start the dApp
yarn run start
```

- Open http://localhost:3000 in your browser and connect your `Metamask` account. See [this section](#configure-web3-wallet) for instructions if you have not done that yet.
- Open http://localhost:3000/swap and verify that you have stablecoins in your account. See [this section](#minting-stablecoins-via-hardhat-task) for instructions if you don't see a balance.

If you see a `Runtime Error: underlying network changed`, then rename `dApp/dev.env` to `.env` and restart `yarn` 

### Troubleshooting
When freshly starting a node it is usually necessary to also reset Metamask Account being used:
- `Metamask` => `Settings` => `Advanced` => `Reset Account`
<br/><br/>
This will reset the nonce number that is incorrect if you have submitted any transactions in previous runs of the ethereum node. (Wallet has a too high nonce number comparing to the nonce state on the node)

If you get an `error Command "husky-run" not found.` type of error: 
Go to root of the project and run `npx husky install`

---
## (Core Contributors) Running dApp in Production/Staging Mode Locally
There may be a time that you will need to run the dApp in production/staging mode to test out a certain feature or do verification before a deploy. In this case there is no need for a local node as you will connect directly to the mainnet/testnet. 

### Requirements
- `Google Cloud` CLI tool installed as explained [HERE](https://cloud.google.com/sdk/docs/quickstart)
- Permission to the Origin GCP Account to decrypt `*.secrets.enc` and deploy infrastructure

#### Login to Google Cloud
```
# Login to GCP
gcloud auth login
```

#### Staging
```
# Decrypt staging secrets to local
yarn run decrypt-secrets:staging

# Start local dApp in Staging mode
yarn run start:staging
```

#### Production
```
# Decrypt staging secrets to local
yarn run decrypt-secrets:production

# Start local dApp in Production mode
yarn run start:production
```
---

## Running Smoke Tests

Smoke tests can be run in 2 modes: 
- Run `scripts/test/smokeTest.sh` to launch interactive mode. All the "before contract changes" parts of tests
  will execute and wait for the user to manually using a console performs contract changes. Once those are done
  hit "Enter" in the smoke test console and the second part of the tests shall be ran that validate that contract
  changes haven't broken basic functionality.
- Run `scripts/test/smokeTest.sh --deployid [numeric_id_of_deploy]` will run smoke tests against a specific
  deployid. Validating that that deploy didn't break basic functionality.
<br/><br/>

---

## Contributing
Want to contribute to OUSD? Awesome!

OUSD is an Open Source project and we welcome contributions of all sorts. There are many ways to help, from reporting issues, contributing to the code, and helping us improve our community.

The best way to get involved is to join the Origin Protocol [discord server](https://discord.gg/jyxpUSe) and head over to the channel named ORIGIN DOLLAR & DEFI


