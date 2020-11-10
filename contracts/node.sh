#!/bin/bash

rm -rf deployments/localhost
if  [[ $1 == "fork" ]]
then
    if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
    params=()
    params+=(--fork ${PROVIDER_URL})
    if [ -z "$BLOCK_NUMBER" ]; then
        echo "It is recommended that BLOCK_NUMBER is set to a recent block to improve performance of the fork";
    else
        params+=(--fork-block-number ${BLOCK_NUMBER})
    fi
    cp -r deployments/mainnet deployments/localhost
    FORK=true npx hardhat node --export '../dapp/network.json' ${params[@]}
else
    npx hardhat node --export '../dapp/network.json'
fi
