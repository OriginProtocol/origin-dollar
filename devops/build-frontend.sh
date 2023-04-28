#!/bin/sh

buildContracts() {
  if [[ $APP_ID == "ousd-dapp" || $APP_ID == "oeth-dapp" ]]
  then
    echo "Building contract for the DApp";
    cd contracts;
    NODE_ENV=development yarn install;
    yarn run deploy;
    cd --;
    cp -R dapp/abis apps/$APP_ID/abis
    rm -rf contracts/node_modules # Purge
  fi
}

buildApp() {
  # buildContracts;
  cd apps/$APP_ID;
  export NODE_ENV=production;
  yarn install;
  yarn run build;
}

buildApp
