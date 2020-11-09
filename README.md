# Origin Dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.

## Development

### Running local node using Hardhat EVM

`cd contracts`
`yarn install && yarn run node`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn start`

Connect MetaMask to `http://localhost:8545`.

When freshly starting a node it is usually nedessary to also reset Metamask Account being used:
- Click on Account top right icon -> settings -> advanced -> Reset Account

### Runnning on Mainnet fork

This repository also supports running a local node via the HardhatEVM fork implementation.

`cd contracts`
`yarn install`
`yarn run node:fork`

Fund accounts with stablecoins:

`cd contracts`
`yarn run fund`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn run start:fork`

Connect MetaMask to `http://localhost:8545`.
