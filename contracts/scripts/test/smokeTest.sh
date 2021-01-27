#!/bin/bash

# any child processes created by this process are killed once the main process is terminated
trap "exit" INT TERM ERR
trap "kill 0" EXIT
nodeWaitTimeout=60

main()  
{
    nodeOutput=$(mktemp "${TMPDIR:-/tmp/}$(basename 0).XXX")
    yarn run node:fork &> $nodeOutput &
    NODE_PID=$!

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
    echo "🟢 Node initialized running smoke tests"

    FORK=true npx hardhat smokeTest --network localhost "$@"
}

main "$@"