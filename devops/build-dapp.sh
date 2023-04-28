buildContracts() {
  if [[ $APP_ID == "ousd-dapp" || $APP_ID == "oeth-dapp" ]]; then
    echo "Building contract for the DApp";
    cd contracts;
    NODE_ENV=development yarn install;
    yarn run deploy;
    cd --;
    rm -rf contracts/node_modules # Purge
  fi
}

buildApp() {
  buildContracts;
  if [[ $APP_ID == "oeth-dapp" ]]; then
    cd dapp-oeth;
  else
    cd dapp;
  fi
  export NODE_ENV=production;
  yarn install;
  yarn run build;
}

buildApp