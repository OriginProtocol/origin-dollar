startApp() {
  if [[ $APP_ID == "oeth-dapp" ]]:
    cd dapp-oeth;
  else
    cd dapp;
  fi
  export NODE_ENV=production;
  yarn run start;
}

startApp