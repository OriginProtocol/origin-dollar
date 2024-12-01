# Performing upgrade tests

The purpose of upgrade tests is to verify that the token contract upgrades will not change the token balances of any of the existing accounts. Such confirmation can be achieved by performing the following general steps: 
1. fetch all accounts from Sub Squid which have positive token balance
2. run a forked node on the same block number and add actual/precise on-chain token balances to those addresses (there are errors / deviations in SubSquid)
3. run a forked node with token contracts upgraded and compare balances

## 1. Fetch data from SubSquid

Run
```
yarn run fetch-pre-upgrade
```
This will execute the `scripts/yield-delegation/fetchAllAddresses.js` which fetches the accounts with positive balances and their SubSquid balances. This script should create files: `oethBalances.csv`, `ousdBalances.csv`, `soethBalances.csv`. They are all of format `address, token_balance, block_number`

## 2. & 3. Supplement account with pre-upgrade on-chain data and verify with post upgrade balances

Since this is a 1 off test there is less automation and more manual work required. Open the 3 token upgrade file: 
- contracts/deploy/mainnet/109_ousd_upgrade.js
- contracts/deploy/mainnet/110_oeth_upgrade.js
- contracts/deploy/base/021_upgrade_oeth.js

and set `forceSkip` to true preventing the token contracts to be upgraded in forked mode. 

In the env file (`contracts.env`) increase the timeout of the mocha tests: 
```
MOCHA_TIMEOUT=120000000
```

### OUSD verification
#### Add pre-upgrade OUSD token balances
run
```
head ousdBalances.csv
```
and pick the block number (last column) of any of the accounts displayed. Set that block number to env file: 
```
BLOCK_NUMBER=[BLOCK_NUMBER]
```
Open test file (`contracts/test/token/ousd.mainnet.fork-test.js`) and add the `.only` modifier to `Fetch the actual on chain data` test. 
run 
```
yarn run test:fork
```
This will create a `ousdBalancesCombined.csv` file which adds on-chain pre upgrade OUSD token balances.

#### Verify post-upgrade token balances
Open `contracts/deploy/mainnet/109_ousd_upgrade.js` and set `forceSkip=false`
Open test file (`contracts/test/token/ousd.mainnet.fork-test.js`) and remove the previous `.only` modifier and set the `.only` modifier to `Compare the data before and after the upgrade` test. 

run 
```
yarn run test:fork
```

After the script executes there should be 0 accounts with not matching balances: 
```
Accounts with difference balances: 0
```

### OETH verification
#### Add pre-upgrade OETH token balances
run
```
head oethBalances.csv
```
and pick the block number (last column) of any of the accounts displayed. Set that block number to env file: 
```
BLOCK_NUMBER=[BLOCK_NUMBER]
```
Open test file (`contracts/test/token/oeth.mainnet.fork-test.js`) and add the `.only` modifier to `Fetch the actual on chain data` test. 
run 
```
yarn run test:fork
```
This will create a `oethBalancesCombined.csv` file which adds on-chain pre upgrade OETH token balances.

#### Verify post-upgrade token balances
Open `contracts/deploy/mainnet/110_oeth_upgrade.js` and set `forceSkip=false`
Open test file (`contracts/test/token/oeth.mainnet.fork-test.js`) and remove the previous `.only` modifier and set the `.only` modifier to `Compare the data before and after the upgrade` test. 

run 
```
yarn run test:fork
```

After the script executes there should be 0 accounts with not matching balances: 
```
Accounts with difference balances: 0
```

### Super OETH verification
#### Add pre-upgrade Super OETH token balances
run
```
head soethBalances.csv
```
and pick the block number (last column) of any of the accounts displayed. Set that block number to env file: 
```
BASE_BLOCK_NUMBER=[BLOCK_NUMBER]
```
Open test file (`contracts/test/token/oeth.base.fork-test.js`) and add the `.only` modifier to `Fetch the actual on chain data` test. 
run 
```
yarn run test:base-fork
```
This will create a `soethBalancesCombined.csv` file which adds on-chain pre upgrade Super OETH token balances.

#### Verify post-upgrade token balances
Open `contracts/deploy/base/021_upgrade_oeth.js` and set `forceSkip=false`
Open test file (`contracts/test/token/oeth.base.fork-test.js`) and remove the previous `.only` modifier and set the `.only` modifier to `Compare the data before and after the upgrade` test. 

run 
```
yarn run test:base-fork
```

After the script executes there should be 0 accounts with not matching balances: 
```
Accounts with difference balances: 0
```