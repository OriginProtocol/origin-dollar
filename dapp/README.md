## Getting Started

Compile the contracts to generate the dapp/network.json file and start a local blockchain:
```bash
cd ../contracts
yarn install
yarn run clean //a lot of times contracts do not get deployed properly without this
yarn run node
```

In a separate terminal, deploy the contracts: 
```bash
cd ../contracts
yarn run deploy
```

In a separate terminal, run the DApp development server:

```bash
yarn run start
```

### Local Dev/Test of stake functionality
- start node & deploy the contracts in a separate terminal as stated above
- go to "/dashboard" page and find "Staking" section
- Click on "Mint hella OGN" to supply your account with OGN
- click on "Supply staking contract with OGN" to supply staking contract with 10k OGN. If staking contract runs out of OGN or more OGN is staked by users than the contract owns an error is thrown(At the step when user tries to stake OGN).
- click on the "Approve staking contract to move OGN" to approve ognStaking to move ogn around. On mainnet this is not necessary since the OGN contract has ogn staking contract whiteslited.

Good to know: In local environment there is a staking option where users stake OGN for only 10 minutes. This will not happen in production or forked environment. The purpose of it is to easen the testing / development.

### Translations

Translations are updated in the dapp with 3 steps
- cd dapp && yarn run translate (This command extracts new translations from the code). When those are pushed to master the Crowdin website picks up the new strings and translators can translate them
- cd dapp && git fetch && git checkout master && git merge origin/crowdin (with this command the new Crowdin strings are merged to master but not yet usable by our translation engine)
- cd dapp && yarn run translate (this command extracts translations and also integrates data from Crowdin in a format that can be used by the dapp)

### Run Dapp on Mainnet
```
$ yarn run decrypt-secrets:prod
$ yarn run build
$ yarn run start:production
```

### Dapp compensation setup
Note: the main testing accounts (0x17BAd8cbCDeC350958dF0Bfe01E284dd8Fec3fcD, 0x3d89e78a9Feb7Be032D5aC01A10Ee2Ca97Ab35FD) already have an entry in the `airDrop.js` file and there is no need to do anything additional. If you want to change the compensation stake amounts or add new compensations do the following:

- in contracts npm package there is a `compute-merkle-proofs` command that takes addresses specified in `scripts/staking/airDrop.js` and creates an output consumed by the dapp `dapp/src/constants/merkleProofedAccountsToBeCompensated.json`. That file contains merkle proof data that are necessary to create stakes. We expose that file via dapp side api publicly and it is ok, since the contract verifies the wallet owner, so another wallet can not claim OGN compensation for anyone else.
- the output of the above file will also generate a root hash and tree depth that needs to be fed to the contract. Open `004_single_asset_staking.js` and modify `dropRootHash` and `dropRootDepth` variables to whatever running the script in the previous step produced.
- with that redeploy the contracts: `yarn run deploy`
- go to debug dashboard: /dashboard
- mint 20m or more USDT
- go to /swap page and exchange that USDT for OUSD
- go to /dashboard page and click "Send 20m OUSD to contract". Contract must have more than "Total claims in the contract" OUSD to be able to start claim periods
- switch to governor account. It is the first account that mnemonic in harhat.config.js  produces
- unlock the adjuster
- start claim period

Visit the /compensation page and run "Claim & Stake"

### Environment variables
- On local use `local.env` file (copy initial contents from dev.env)
- On prod use `prod.env` file. Check DevOps playbook to see how to encrypt/decrypt it.

## DevOps
Refer to the [playbook](https://docs.google.com/document/d/1sWLL0gAfm8A2CQ_HRPoExbF-jDIgu7F1uo61cW-lLWU/edit#heading=h.brahy16zdtg1).

## Test functionality
Set the `override_best_tx_route` local storage variable to `true` to enable user overriding the best route: 
```
localStorage.setItem('override_best_tx_route', 'true')
```
## Publish to IPFS

Build and export dapp for the IPFS by running

```
yarn run ipfs-export
```

Above command produces a browser run-able (feel free to test in Chrome) dapp located in `dapp/out`

Upload the output folder to IPFS using Pinata service by running (you need to have PINATA_API_KEY and PINATA_API_SECRET_KEY setup. Ping @domeng or @franck to get that):
```
node scripts/deployToIpfs
```

That should produce an output in format of: Dapp uploaded to IPFS hash: https://ipfs.io/ipfs/[CID]/

The Dapp is now accessible on IPFS! But the CID hash that links to it changes each time the file is uploaded. For that reason we also need to publish it to IPNS so on non mutable link will always point to the latest version.

To achieve that first: 
1. Install the go version of IPFS cmd line tools [link](https://docs.ipfs.io/install/command-line/).
- Start the daemon in another terminal `ipfs daemon`

2. Get the IPNS publishing key (ask @domeng or @franck) and import it to local IPFS:
```
ipfs key import ousd-dapp-key dapp/keys/ousd-dapp-key.key[change the key path when necessary]
```

3. Publish the Pinata uploaded IPFS files to IPNS: 
```
ipfs name publish [CID that the node script produced few steps before] --key ousd-dapp-key
```

It takes some time (20minutes+) for the IPNS record to update. The last version of the dapp should now be available on: https://ipfs.io/ipns/k51qzi5uqu5dlucbjl0gzy5sl8pulu4omhgazvmb67gp5t626ogr7tyaad3twv/swap.html

Picking a different key (currently `ousd-dapp-key`) for publishing, also changes the IPNS link location.






