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
    is_trace=("$TRACE" == "true");

    if $is_local; then
        # When not running on CI/CD, make sure there's an env file
        if [ ! -f "$ENV_FILE" ]; then
            echo -e "${RED} File $ENV_FILE does not exist. Have you forgotten to rename the dev.env to .env? ${NO_COLOR}"
            exit 1
        fi
        source .env
    fi

    if [ -z "$FORK_NETWORK_NAME" ]; then
        FORK_NETWORK_NAME=mainnet
    fi
    echo "Fork Network: $FORK_NETWORK_NAME"

    # There must be a provider URL in all cases
    if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
    
    params=()
    if [[ $FORK_NETWORK_NAME == "arbitrumOne" ]]; then
      PROVIDER_URL=$ARBITRUM_PROVIDER_URL;
      BLOCK_NUMBER=$ARBITRUM_BLOCK_NUMBER;
    elif [[ $FORK_NETWORK_NAME == "holesky" ]]; then
      PROVIDER_URL=$HOLESKY_PROVIDER_URL;
      BLOCK_NUMBER=$HOLESKY_BLOCK_NUMBER;
    elif [[ $FORK_NETWORK_NAME == "base" ]]; then
      PROVIDER_URL=$BASE_PROVIDER_URL;
      BLOCK_NUMBER=$BASE_BLOCK_NUMBER;
    elif [[ $FORK_NETWORK_NAME == "sonic" ]]; then
      PROVIDER_URL=$SONIC_PROVIDER_URL;
      BLOCK_NUMBER=$SONIC_BLOCK_NUMBER;
    elif [[ $FORK_NETWORK_NAME == "plume" ]]; then
      PROVIDER_URL=$PLUME_PROVIDER_URL;
      BLOCK_NUMBER=$PLUME_BLOCK_NUMBER;
    elif [[ $FORK_NETWORK_NAME == "hoodi" ]]; then
      PROVIDER_URL=$HOODI_PROVIDER_URL;
      BLOCK_NUMBER=$HOODI_BLOCK_NUMBER;
    fi

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

    if [[ ! -z "${FORK_BLOCK_NUMBER}" ]]; then
        echo "You shouldn't manually set FORK_BLOCK_NUMBER"
    fi

    if [ -z "$LOCAL_PROVIDER_URL" ]; then
        cp -r deployments/$FORK_NETWORK_NAME deployments/hardhat
        echo "No running node detected spinning up a fresh one"
    else
        cp -r deployments/localhost deployments/hardhat
    fi

    # Run specific files when a param is given
    if [[ ! -z "$1" ]]; then
        if [[ $is_coverage == "true" ]]; then
            params+="--testfiles $@"
        else
            params+="$@"
        fi
    fi

    # Add trace flag if enabled
    if [[ $is_trace == "true" ]]; then
        params+=" --trace"
    fi
    
    echo "Test params: ${params[@]}"

    if [[ $is_coverage == "true" ]]; then
        echo "Running tests and generating coverage reports..."
        FORK=true IS_TEST=true npx --no-install hardhat coverage "${params[@]}"
    else
        echo "Running fork tests..."
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