startApp() {
  if [[ $APP_ID == "oeth-dapp" ]]:
    cd dapp-oeth;
  else
    cd dapp;
  export NODE_ENV=production;
  yarn run start;
}

startApp