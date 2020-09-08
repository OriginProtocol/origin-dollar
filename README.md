# origin-dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.


## Development

### Running local node

`cd contracts`
`yarn install && yarn run node`

Deploy contracts in another window

`cd contracts`
`yarn run deploy`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn dev`

Connect MetaMask to `http://localhost:8545`.

### Running local node in `main-net-fork-mode`

`cd contracts`
`yarn install && yarn run node:fork`

Deploy contracts in another window

`cd contracts`
`yarn run deploy:fork`


Transfer stable coins from Binance forked contract to first default 10 node accounts:
`cd contracts`
`yarn run grant-stable-coins:fork`


Start the DApp in another window:
`cd dapp`
`yarn install && npm run start`

Connect MetaMask to `http://localhost:7546`.

When switching between `default` local node mode and `main-net-fork-mode`. You need to restart the node process in contracts folder, redeploy the contracts, connect the MetaMask to the new network and reset MetaMask account. You do not need to restart the dapp process.