#!/bin/bash

rm -rf deployments/localhost
if  [[ $1 == "fork" ]]
then
    if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
    cp -r deployments/mainnet deployments/localhost
    FORK=true npx hardhat node --export '../dapp/network.json' --fork ${PROVIDER_URL}
else
    npx hardhat node --export '../dapp/network.json'
fi
