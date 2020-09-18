## Getting Started

Compile the contracts to generate the dapp/network.json file and start a local blockchain.
```bash
cd ../contracts
yarn install
yarn run node
```

In a separate terminal, run the DApp development server:

```bash
yarn dev
```

### Run Dapp on Mainnet
```
$ npm run decrypt-secrets:prod
$ cp prod.env .env
$ yarn run build
$ yarn run start:production
```
## DevOps

Refer to the [playbook](https://docs.google.com/document/d/1sWLL0gAfm8A2CQ_HRPoExbF-jDIgu7F1uo61cW-lLWU/edit#heading=h.brahy16zdtg1).