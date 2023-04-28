#!/bin/bash

startApp() {
  if [[$APP_ID == 'oeth-dapp']]; then
    cd "dapp-oeth";
  else
    cd "dapp";
  fi
  export NODE_ENV=production;
  yarn run start --port $PORT;
}

startApp