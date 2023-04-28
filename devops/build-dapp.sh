#!/bin/bash

buildContracts() {
  echo "Building contract for the DApp";
  cd contracts;
  NODE_ENV=development yarn install;
  if [ "$APP_ID" = "oeth-dapp" ]; then
  echo "Generating ABI for the OETH DApp";
    yarn run deploy:oeth
  else
    echo "Generating ABI for the OUSD DApp";
    yarn run deploy
  fi
  cd ..
  rm -rf contracts/node_modules # Purge
}

buildApp() {
  buildContracts;
  if [ "$APP_ID" = "oeth-dapp" ]; then
    cd "dapp-oeth";
  else
    cd "dapp";
  fi
  export NODE_ENV=production;
  yarn install;
  yarn run build;
}

buildApp
