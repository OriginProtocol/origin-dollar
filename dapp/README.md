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
$ yarn run decrypt-secrets:prod
$ yarn run build
$ yarn run start:production
```

### Environment variables
- On local use `.env` file
- On prod use `prod.env` file. Check DevOps playbook to see how to encrypt/decrypt it.

## DevOps
Refer to the [playbook](https://docs.google.com/document/d/1sWLL0gAfm8A2CQ_HRPoExbF-jDIgu7F1uo61cW-lLWU/edit#heading=h.brahy16zdtg1).