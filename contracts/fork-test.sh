#!/bin/bash
RED='\033[0;31m'
NO_COLOR='\033[0m'

main()
{
    rm -rf deployments/hardhat

    ENV_FILE=.env

    is_ci=false
    is_local=true
    if [ "$GITHUB_ACTIONS" = "true" ]; then
        is_ci=true
        is_local=false
    fi

    if $is_local; then
        # When not running on CI/CD, make sure there's an env file
        if [ ! -f "$ENV_FILE" ]; then
            echo -e "${RED} File $ENV_FILE does not exist. Have you forgotten to rename the dev.env to .env? ${NO_COLOR}"
            exit 1
        fi
        source .env
    fi

    # There must be a provider URL in all cases
    if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
    
    params=()
    if $is_local; then
        # Check if any node is running on port 8545
        defaultNodeUrl=http://localhost:8545

        # If local node is running, $resp is a non empty string
        resp=$(curl -X POST --connect-timeout 3 -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}' "$defaultNodeUrl")

        if [ ! -z "$resp" ]; then
            # Use the running node, if found
            echo "Found node running on $defaultNodeUrl"
            export LOCAL_PROVIDER_URL="$defaultNodeUrl"
        fi
    fi

    if [ -z "$LOCAL_PROVIDER_URL" ]; then
        cp -r deployments/mainnet deployments/hardhat
        echo "No running node detected spinning up a fresh one"
        params+="--deploy-fixture "
    else
        # Fetch latest block number from hardhat instance
        blockresp=$((curl -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"eth_blockNumber"}' "$LOCAL_PROVIDER_URL") | jq -r '.result')
        blocknum=$((16#${blockresp:2}))
        export FORK_BLOCK_NUMBER=$blocknum

        # Hardhat has the habit of not using blocks with less than 32 confirmations
        # Force it to use the latest block
        echo "Connecting to node $LOCAL_PROVIDER_URL using block number: $FORK_BLOCK_NUMBER"

        cp -r deployments/localhost deployments/hardhat
    fi

    if [ -z "$1" ]; then
        # Run all files with `.fork-test.js` suffix when no param is given
        params+="test/**/*.fork-test.js"
    else
        # Run specifc files when a param is given
        params+=($1)
    fi

    FORK=true IS_TEST=true npx --no-install hardhat test ${params[@]}

    if [ ! $? -eq 0 ] && $is_ci; then
        echo "Test suite has failed"
        exit 1;
    elif $is_ci; then
        exit 0;
    else
        # Cleanup
        rm -rf deployments/hardhat
    fi
}

main "$@"
