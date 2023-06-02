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

    is_coverage=("$REPORT_COVERAGE" == "true");

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
    else
        if ! command -v jq &> /dev/null
        then
            echo "jq could not be found try installing it"
            exit 1
        fi
        # Fetch latest block number from hardhat instance
        blockresp=$((curl -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"eth_blockNumber"}' "$LOCAL_PROVIDER_URL") | jq -r '.result')
        blocknum=$((16#${blockresp:2}))
        export FORK_BLOCK_NUMBER=$blocknum

        # Mine 40 blocks so hardhat wont complain about block fork being too recent
        for run in {1..40}; do
          response=$(curl -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"evm_mine"}' "$LOCAL_PROVIDER_URL")
        done
        
        # Hardhat has the habit of not using blocks with less than 32 confirmations
        # Force it to use the latest block
        echo "Connecting to node $LOCAL_PROVIDER_URL using block number: $FORK_BLOCK_NUMBER"

        cp -r deployments/localhost deployments/hardhat
    fi

    #if [ -z "$1" ] || [ "$1" = --* ]; then
    if [ -z "$1" ] || [[ $1 == --* ]]; then
        # Run all files with `.fork-test.js` suffix when no file name param is given
        # pass all other params along
        params+="test/**/*.fork-test.js $@"
    else
        # Run specifc files when a param is given
        params+=($1)
        params+=" $@"
    fi

    if $is_coverage; then
        echo "Running tests and generating coverage reports..."
        FORK=true IS_TEST=true npx --no-install hardhat coverage --testfiles "${params[@]}"
    else
        FORK=true IS_TEST=true npx --no-install hardhat test ${params[@]}
    fi

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
