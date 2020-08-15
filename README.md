# origin-dollar

OUSD is a new kind of stablecoin that passively accrues yield while you are holding it.


## Development

Run a local node full of contracts:

`cd contracts`
`yarn install && yarn run start`

Start the DApp in another window:

`cd dapp`
`yarn install && yarn run start`

Connect MetaMask to `localhost:8545`.

Or use the playground DApp in another window:

`cd playground`
`yarn install && yarn run dev`

No metamask required, browser to `localhost:5000`. To use, drag a person onto a contract, then pick your transaction to call.

## Accounts

### Deployer

Deploys all contracts

Address `0xc783df8a850f42e7F7e57013759C285caa701eB6`
Private key `0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122`

### Governor

Use this account to get yield deposit option in the UI.

Address `0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4`
Private key `0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb`
