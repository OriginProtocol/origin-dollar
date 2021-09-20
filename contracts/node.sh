#!/bin/bash
trap "exit" INT TERM ERR
trap "kill 0" EXIT
nodeWaitTimeout=60

main()
{
    source .env
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

        nodeOutput=$(mktemp "${TMPDIR:-/tmp/}$(basename 0).XXX")
        # the --no-install is here so npx doesn't download some package on its own if it can not find one in the repo
        FORK=true npx --no-install hardhat node --export '../dapp/network.json' ${params[@]} > $nodeOutput 2>&1 &

        echo "Node output: $nodeOutput"
        echo "Waiting for node to initialize:"
        i=0
        until grep -q -i 'Started HTTP and WebSocket JSON-RPC server at' $nodeOutput
        do
          let i++      
          printf "."
          sleep 1
          if (( i > nodeWaitTimeout )); then
            printf "\n"
            echo "$newLine Node failed to initialize in $nodeWaitTimeout seconds"
            exit 1
          fi
        done
        printf "\n"
        echo "🟢 Node initialized"

        FORK=true npx hardhat fund --amount 100000 --network localhost --accountsfromenv true &
        cat $nodeOutput
        tail -f -n0 $nodeOutput

    else
        npx --no-install hardhat node --export '../dapp/network.json'
    fi
}

main "$@"