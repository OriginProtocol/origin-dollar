# Origin Dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.

## Development

Ethereum tests and local Ethereum EVM are managed by Hardhat.

A variety of Hardhat tasks are available to interact with the contracts. Additional information can be found by running `npx hardhat` from the `contracts/` directory.


### Running local node using Hardhat EVM

`cd contracts`

`yarn install && yarn run node`

Start the DApp in another window:

`cd dapp`

`yarn install && yarn start`

Connect MetaMask to `http://localhost:8545`.

When freshly starting a node it is usually necessary to also reset Metamask Account being used:
- Click on Account top right icon -> settings -> advanced -> Reset Account

You can find the mnemonic for test accounts under `contracts/hardhat.config.js`.
Note that accounts 0 thru 3 are reserved and test accounts start at index 4 (In Metamask that is Account 5).

To fund your test accounts with mock DAI/USDT/USDC stablecoins you can either
  - Go to the DApp dashboard at http://localhost:3000/dashboard
  - Run the hardhat `fund` task:
```
cd ../contracts
HARDHAT_NETWORK=localhost npx hardhat fund --amount 10000
```


### Running Smoke Tests

Smoke tests can be ran in 2 modes: 
- Run `scripts/test/smokeTest.sh` to launch interactive mode. All the "before contract changes" parts of tests
  will execute and wait for the user to manually using a console performs contract changes. Once those are done
  hit "Enter" in the smoke test console and the second part of the tests shall be ran that validate that contract
  changes haven't broken basic functionality.
- Run `scripts/test/smokeTest.sh --deployid [numeric_id_of_deploy]` will run smoke tests against a specific
  deployid. Validating that that deploy didn't break basic functionality.

### Runnning on Mainnet fork

This repository also supports running a local node via the Hardhat EVM fork implementation.

Set PROVIDER_URL to point to Mainnet.

`export PROVIDER_URL="https://eth-mainnet.alchemyapi.io/v2/...`

Setting BLOCK_NUMBER in your environment before running the fork will aid performance due to better caching. It is recommended to set it to something that hast at least 6 confirmations.

`export BLOCK_NUMBER=...`

Start the Fork node:

`cd contracts`

`yarn install`

`yarn run node:fork`

You can run tasks against the fork. Make sure to set `FORK=true` in your environment before running any tasks. For example:

`FORK=true npx hardhat debug --network localhost`

Additionally, you may need to remove [this line](https://github.com/nomiclabs/hardhat/blob/fc50a94a688ed5007a429857b808aae76441095c/packages/hardhat-core/src/internal/core/providers/http.ts#L119) from `node_modules/hardhat` if you experience timeouts running on the fork. Timeouts occur because of how long it takes to retrieve the blockchain state from the provider.

Fund accounts with stablecoins:

`cd contracts`

`FORK=true npx hardhat fund --network localhost`

Start the DApp in another window:

`cd dapp`

`yarn install && yarn run start:fork`

Connect MetaMask to `http://localhost:8545`.

