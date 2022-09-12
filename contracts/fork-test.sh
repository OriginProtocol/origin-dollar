#!/bin/bash
trap "exit" INT TERM ERR
trap "kill 0" EXIT
#nodeWaitTimeout=120
nodeWaitTimeout=1200
RED='\033[0;31m'
NO_COLOR='\033[0m'

main()
{
    rm -rf deployments/hardhat

    ENV_FILE=.env
    source .env

    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED} File $ENV_FILE does not exist. Have you forgotten to rename the dev.env to .env? ${NO_COLOR}"
        exit 1
    fi
    if [ -z "$PROVIDER_URL" ] && [ -z "$LOCAL_PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
    
    params=()

    if [ -z "$LOCAL_PROVIDER_URL" ]; then
        cp -r deployments/mainnet deployments/hardhat
    else
        mineresp=$(curl -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"evm_mine"}' "$LOCAL_PROVIDER_URL")
        blockresp=$((curl -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"eth_blockNumber"}' "$LOCAL_PROVIDER_URL") | jq -r '.result')
        blocknum=$((16#${blockresp:2}))
        export FORK_BLOCK_NUMBER=$blocknum

        echo "Will be using block number: $FORK_BLOCK_NUMBER"

        # params+="--deploy-fixture "

        cp -r deployments/localhost deployments/hardhat
    fi

    if [ -z "$1" ]; then
        params+="test/**/*.fork-test.js"
    else
        params+=($1)
    fi

    FORK=true IS_TEST=true npx --no-install hardhat test ${params[@]}
}

main "$@"
