# origin-dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.


## Development

### Running local node using BuidlerEVM

`cd contracts`
`yarn install && yarn run node`

Deploy contracts in another window

`cd contracts`
`yarn run deploy`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn start`

Connect MetaMask to `http://localhost:8545`.

When freshly starting a node it is usually nedessary to also reset Metamask Account being used:
- Click on Account top right icon -> settings -> advanced -> Reset Account

### Running Ganache or Ganache fork

This repository also supports running a local node via Ganache or a Ganache fork of [mainnet](https://medium.com/ethereum-grid/forking-ethereum-mainnet-mint-your-own-dai-d8b62a82b3f7).

#### Ganache

`cd contracts`
`yarn install`
`yarn run node:ganache`

Deploy contracts in another window:

`cd contracts`
`yarn run deploy:ganache`

Fund accounts with stablecoins:

`cd contracts`
`yarn run fund`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn run start`

Connect MetaMask to `http://localhost:7546`.

#### Ganache Fork

`cd contracts`
`yarn install`
`yarn run node:fork`

There is a shortcut helper to bring the Ganache fork to the same state as mainnet. This will copy the mainnet state to the fork deployments directory, fund all accounts and deploy any local changes:

`cd contracts`
`yarn run setup:fork`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn run start:fork`

Connect MetaMask to `http://localhost:7545`.

When switching between `default` local node mode and Ganache You need to restart the node process in contracts folder, redeploy the contracts, connect the MetaMask to the new network and reset MetaMask account. You do not need to restart the DApp process.
