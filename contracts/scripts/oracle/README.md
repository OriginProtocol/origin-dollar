# Oracle scripts

## Usage

### Local network
First deploy the oracles.
```
BUIDLER_NETWORK="ganache" deploy-mix-oracle.js
```
Then run all-price.js to get prices of ETH, DAI, USDT and USDC from the oracles:
```
BUIDLER_NETWORK="ganache" node all-price.js
```

### Ganache fork
Start a ganache fork in a terminal window:
```
yarn run node:fork
```
In a separate terminal, deploy the contracts then get the prices from the oracle by running"
```
yarn run deploy:fork
BUIDLER_NETWORK=ganache FORK=true node all-price.js
```

### Mainnet
Get prices by running:
```
BUIDLER_NETWORK=mainnet MAINNET=true node all-price.js
```

