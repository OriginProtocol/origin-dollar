#!/bin/bash
trap "exit" INT TERM ERR
trap "kill 0" EXIT
#nodeWaitTimeout=120
nodeWaitTimeout=1200
RED='\033[0;31m'
NO_COLOR='\033[0m'


main()
{
    rm -rf deployments/localhost
    if  [[ $1 == "fork" ]]
    then
        # Fetch env variables like PROVIDER_URL and BLOCK_NUMBER from .env file so they don't
        # need to be separately set in terminal environment
        ENV_FILE=.env
        source .env
        if [ ! -f "$ENV_FILE" ]; then
            echo -e "${RED} File $ENV_FILE does not exist. Have you forgotten to rename the dev.env to .env? ${NO_COLOR}"
            exit 1
        fi

        params=()
        if [ -z "$FORK_NETWORK_NAME" ]; then
          FORK_NETWORK_NAME=mainnet
        fi

        if [[ $FORK_NETWORK_NAME == "arbitrumOne" ]]; then
          PROVIDER_URL=$ARBITRUM_PROVIDER_URL;
          BLOCK_NUMBER=$ARBITRUM_BLOCK_NUMBER;
          params+=" --tags arbitrumOne";
        elif [[ $FORK_NETWORK_NAME == "holesky" ]]; then
          PROVIDER_URL=$HOLESKY_PROVIDER_URL;
          BLOCK_NUMBER=$HOLESKY_BLOCK_NUMBER;
        elif [[ $FORK_NETWORK_NAME == "base" ]]; then
          PROVIDER_URL=$BASE_PROVIDER_URL;
          BLOCK_NUMBER=$BASE_BLOCK_NUMBER;
          params+=" --tags base";
        elif [[ $FORK_NETWORK_NAME == "sonic" ]]; then
          PROVIDER_URL=$SONIC_PROVIDER_URL;
          BLOCK_NUMBER=$SONIC_BLOCK_NUMBER;
          params+=" --tags sonic";
        elif [[ $FORK_NETWORK_NAME == "plume" ]]; then
          PROVIDER_URL=$PLUME_PROVIDER_URL;
          BLOCK_NUMBER=$PLUME_BLOCK_NUMBER;
          params+=" --tags plume";
        elif [[ $FORK_NETWORK_NAME == "hoodi" ]]; then
          PROVIDER_URL=$HOODI_PROVIDER_URL;
          BLOCK_NUMBER=$HOODI_BLOCK_NUMBER;
        fi
        
        echo "Fork Network: $FORK_NETWORK_NAME"

        if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
        if [[ "$TRACE" == "true" ]]; then
            params+=" --trace"
        fi
        params+=(--fork ${PROVIDER_URL})
        if [ -z "$BLOCK_NUMBER" ]; then
            echo "It is recommended that BLOCK_NUMBER is set to a recent block to improve performance of the fork";
        else
            echo "Forking from block $BLOCK_NUMBER";
            params+=(--fork-block-number ${BLOCK_NUMBER});
        fi
        if [ -z "$STACK_TRACE" ]; then params+=( --show-stack-traces); fi

        cp -r deployments/$FORK_NETWORK_NAME deployments/localhost

        nodeOutput=$(mktemp "${TMPDIR:-/tmp/}$(basename 0).XXX")
        # the --no-install is here so npx doesn't download some package on its own if it can not find one in the repo
        FORK_NETWORK_NAME=$FORK_NETWORK_NAME FORK=true npx --no-install hardhat node --no-reset ${params[@]} > $nodeOutput 2>&1 &
        tail -f $nodeOutput &

        i=0
        until grep -q -i 'Started HTTP and WebSocket JSON-RPC server at' $nodeOutput
        do
          if grep -q -i 'VM Exception while processing transaction' $nodeOutput; then
            printf "\n"
            echo "🔴 Error detected node exiting."
            exit 1
          fi

          let i++
          sleep 1
          if (( i > nodeWaitTimeout )); then
            printf "\n"
            echo "$newLine Node failed to initialize in $nodeWaitTimeout seconds"
            exit 1
          fi
        done
        printf "\n"
        echo "🟢 Node initialized"
        
        # wait for subprocesses to finish
        for job in `jobs -p`
          do
            wait $job || let "FAIL+=1"
          done


    else
        npx --no-install hardhat node
    fi
}

main "$@"