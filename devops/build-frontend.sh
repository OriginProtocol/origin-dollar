#!/bin/sh

buildContracts() {
  if [[ $APP_ID == "ousd-dapp" || $APP_ID == "oeth-dapp" ]]
  then
    echo "Building contract for the DApp";
    cd contracts;
    NODE_ENV=development yarn install;
    yarn build;
    cd --;
  fi
}

buildApp() {
  buildContracts;
  yarn install;
  NODE_ENV=production nx build $APP_ID;
}

buildApp
