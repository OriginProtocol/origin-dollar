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
    
    if [ -z "$LOCAL_PROVIDER_URL" ]; then
        cp -r deployments/mainnet deployments/hardhat
    else
        cp -r deployments/localhost deployments/hardhat
    fi

    rm deployments/hardhat/.chainId
    echo "31337" > deployments/hardhat/.chainId

    params=()

    if [ -z "$1" ]; then
        params+="test/**/*.fork-test.js"
    else
        params+=($1)
    fi

    FORK=true IS_TEST=true npx --no-install hardhat test --deploy-fixture ${params[@]}
}

main "$@"
