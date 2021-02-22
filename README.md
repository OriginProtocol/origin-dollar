# Origin Dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.

## Requirements
- Node Version
  - `^8.11.2 >= node <=^14.0.0`
  - Recommended `^14.0.0`
- Web3 Wallet
  - Recommended [Metamask](https://metamask.io/) 

---

## Installation
```bash
# Clone the origin-dollar project
git clone git@github.com:OriginProtocol/origin-dollar.git
```  

---

## Description

The `origin-dollar` project is a mono repo that houses both the `smart contracts` and `dApp` codebases. In order to run this project locally, you will need to run both the `node` and the `dapp` in separate processes or terminals. 


### Eth Node
The `smart contracts` and all of their associated code is located in the `<project-root>/contracts` directory.Ethereum tests and local Ethereum EVM are managed by [Hardhat](https://hardhat.org/).

A variety of Hardhat [tasks](https://hardhat.org/guides/create-task.html) are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.
<br/><br/>

### dApp(Decentralized Application)
The `dApp` and it's associated code is located in the `<project-root>/contracts` directory.
<br/><br/>

---
## Developing Locally

You have two options for running the Ethereum node locally via hardhat.
- Standalone mode - A private blockchain with a clean slate
- Forked mode - A forked version of mainnet at a particular block height

The dApp will be started in development mode by default with debugging enabled and runs in `standalone` or `forked` as well - depending on the mode that the underlying hardhat node is running.
<br/><br/>

### Running a Local Hardhat Node
Open a separate teminal to run the hardhat node in.
```bash
# Enter the smart contracts dir
cd contracts

# Install the dependencies - Note your Node version 'Requirements' 
yarn install
```

#### Standalone Mode
```bash
# Run the local hardhat node
yarn run node
```

#### Forked Mode

You will need a provider to run in forked mode. Check out [Infura](https://infura.io/) or similar. You can do this on mainnet or a testnet.

```bash
# export your provider(Infura, Truffle Teams, Alchemy, etc)
export PROVIDER_URL=<provider url>

# optional - set the block number you want to fork at - 6 confirmations are suggested
export BLOCK_NUMBER=<block number>

# Run the local hardhat node in forked mode
yarn run node:fork
```

### Minting Stablecoins on the Local Hardhat Node
You will be needing stablecoins such as `USDT`, `USDC`, `DAI`, etc to mint the `OUSD` coin for usage in the dApp. You can do this in several ways:
- run a hardhat task
- visit http://localhost:3000/dashboard
<br/><br/>

#### Hardhat Task
Open a new terminal with your local hardhat node still running.
```bash
cd contracts
```

##### Standalone Mode
```bash
# Mint 1000 of each supported stablecoin to each account defined in the mnemonic
npx hardhat fund --amount 1000 --network localhost
```

##### Forked Mode
```bash
# Mint 1000 of each supported stablecoin to each account defined in the mnemonic
HARDHAT_NETWORK=localhost npx hardhat fund --amount 1000
FORK=true npx hardhat fund --amount 1000 --network localhost
```

#### Mint with the Dashboard
This is an easier way to mint more stablecoins than running the task if you have everything setup and need to quickly mint some stablecoins.

##### Requirements
- You will need your web3 wallet configured before you can do this. Make sure that you have one configured - refer [HERE](### Configure Web3 Wallet) for `Metamask` instructions.
- You will also need the dApp to be running, so refer [HERE](### Running the dApp Locally) for instructions.

##### Using the Dashboard
Once you have the above requirements fulfilled:
- navigate to http://localhost:3000/dashboard
- Input the amount and mint the desired stablecoin
<br/><br/>

### Configure Web3 Wallet
You will need a web3 wallet to interact with the dApp and sign transactions. Below are the instructions to setup `Metamask` to interact with the dApp running locally.

- Install `Metamask` Chrome extension [HERE](https://metamask.io/)
- Create/Open `Metamask` wallet
- Add a custom RPC endpoint 
  - Name: `origin` - just an example
  - URL: `http://localhost:8545`
  - Chain ID: `31337`
<br/><br/>

#### Add Accounts to Metamask
You can get all the accounts for the locally running node and their associate private keys by running the command 
```bash
# For Standalone mode
npx hardhat accounts --network localhost

# For Forked mode
FORK=true npx hardhat accounts --network localhost
```

Choose a test account past index 3 - accounts 0-3 are reserved.
Copy the private key and import it into Metamask as follows:
- Click the current account icon in the uppor right corner of `Metamask`
- Select `Import Account` => paste private key => Click `Import`

Make sure that you select your newly created RPC endpoint in the networks dropdown and use your newly imported account in `Metamask`. You should now be setup to use `Metamask` to interact with the dApp.

Note: 
If you want to add all the accounts via a new `Metamask` wallet and import the `mnemonic` it is located in `contracts/hardhat.config.js`. Make sure that you use Account 4 and up for test accounts as 0-3 are reserved.
<br/><br/>

### Running the dApp Locally

Open a separate teminal to run the dApp in.

```bash
# Enter the smart dApp dir
cd dApp

# Install the dependencies - Note your Node version 'Requirements' 
yarn install
```

The dApp will need to be started in standalone or forked mode - depending on how the hardhat node is running.
#### Standalone Mode
```bash
# Start the dApp in standalone mode
yarn run start
```

#### Forked Mode
```bash
# Start the dApp in forked mode
yarn run start:fork
```

- Open http://localhost:3000 in your browser and connect your `Metamask` account. See [HERE](### Configure Web3 Wallet) for instructions if you have not done that yet.
- Open http://localhost:3000/mint and verify that you have stablecoins in your account. See [HERE](### Minting Stablecoins on the Local Hardhat Node) for instructions if you don't see a balance.

Note:
When freshly starting a node it is usually necessary to also reset Metamask Account being used:
- `Metamask` => `Settings` => `Advanced` => `Reset Account`
<br/><br/>

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
Want to hack on Origin? Awesome!

Origin is an Open Source project and we welcome contributions of all sorts. There are many ways to help, from reporting issues, contributing code, and helping us improve our community.

If you are thinking about contributing see our [Contribution page](https://docs.originprotocol.com/guides/getting_started/contributing.html)