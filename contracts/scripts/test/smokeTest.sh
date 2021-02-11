#!/bin/bash

# Runs smoke tests to verify that contract changes don't break the basic functionality.
# They can be run 2 ways: 
#
# 1. With `deployid` parameter. Example: `scripts/test/smokeTest.sh --deployid 11`
# When this mode is used
# - all the before functions of smoke tests are ran.
# - contract upgrade specified by the `deployid` is executed
# - all the after functions of the smoke tests are ran. Verifying that the upgrade hasn't broken
#   the expected behavior
#
#
# 2. With no `deployid` parameter AKA the interactive mode.
# When this mode is used:
# - all the before functions of smoke tests are ran
# - process is waiting for user input, so user can connect to the node using hardhat console and
#   execute commands on contracts. 
# - user confirms with `Enter` that the after functions of the smoke tests can continue.
# - process waits for confirmation again to repeat the process


# any child processes created by this process are killed once the main process is terminated
trap "exit" INT TERM ERR
trap "kill 0" EXIT
nodeWaitTimeout=60

main()  
{
    if [ -z "$PROVIDER_URL" ]; then echo "Set PROVIDER_URL" && exit 1; fi
    if [ -z "$BLOCK_NUMBER" ]; then
        echo "It is recommended that BLOCK_NUMBER is set to a recent block to improve performance of the fork";
    fi

    SMOKE_TEST=true FORK=true npx hardhat smokeTestCheck --network localhost "$@"
    if [ $? -ne 0 ]
    then
      exit 1
    fi

    nodeOutput=$(mktemp "${TMPDIR:-/tmp/}$(basename 0).XXX")
    SMOKE_TEST=true yarn run node:fork &> $nodeOutput &

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

    SMOKE_TEST=true FORK=true npx hardhat smokeTest --network localhost "$@"
}

main "$@"