## Getting Started

Compile the contracts to generate the dapp/network.json file and start a local blockchain.
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

### Environment variables
- On local use `.env` file
- On prod use `prod.env` file. Check DevOps playbook to see how to encrypt/decrypt it.

## DevOps
Refer to the [playbook](https://docs.google.com/document/d/1sWLL0gAfm8A2CQ_HRPoExbF-jDIgu7F1uo61cW-lLWU/edit#heading=h.brahy16zdtg1).