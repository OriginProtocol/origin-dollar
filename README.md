# Origin Dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.

## Development

Ethereum tests and local Ethereum EVM are managed by Hardhat.

A variety of Hardhat tasks are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.

If running on the fork it is necessary to set `FORK=true` in your environment before running any tasks (and also to start a fork node). For example:

`FORK=true npx hardhat debug --network localhost`

Additionally, you may need to remove [this line](https://github.com/nomiclabs/hardhat/blob/fc50a94a688ed5007a429857b808aae76441095c/packages/hardhat-core/src/internal/core/providers/http.ts#L119) from `node_modules/hardhat` if you experience timeouts running on the fork. Timeouts occur because of how long it takes to retrieve the blockchain state from the provider.

Setting BLOCK_NUMBER in your environment before running the fork will aid performance due to better caching
. It is recommended to set it to something that hast at least 6 confirmations.

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

`FORK=true npx hardhat fund --network localhost`

Start the DApp in another window:

`cd dapp`

`yarn install && yarn run start:fork`

Connect MetaMask to `http://localhost:8545`.
