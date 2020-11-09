#!/bin/bash

if  [[ $1 -eq "fork" ]]
then
    if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
fi
rm -rf deployments/localhost
cp -r deployments/mainnet deployments/localhost
npx hardhat node --export '../dapp/network.json'
