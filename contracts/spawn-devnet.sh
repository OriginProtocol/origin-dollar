#!/bin/bash

source ${PWD}/.env

# Call CLI command and store response in variable
response=$(tenderly devnet spawn-rpc --template $TENDERLY_DEVNET_TEMPLATE --project $TENDERLY_PROJECT_SLUG 2>&1)

# Set an environment variable with the RPC URL response
# DEVNET_RPC_URL is used to store the RPC URL of the newly spawned devnet
export DEVNET_RPC_URL="$response"

# Replace the existing DEVNET_RPC_URL environment variable in the .zshrc file
# If it already exists, replace it with the new value; if not, add it to the file
if grep -q "export DEVNET_RPC_URL=" $HOME/.zshrc; then
  sed -i.bak "s|export DEVNET_RPC_URL=.*|export DEVNET_RPC_URL=\"$DEVNET_RPC_URL\"|" $HOME/.zshrc
  rm $HOME/.zshrc.bak
else
  # The following environment variable is used to store the RPC URL of the newly spawned devnet
  echo "# DEVNET_RPC_URL is used to store the RPC URL of the newly spawned devnet" >> $HOME/.zshrc
  echo "export DEVNET_RPC_URL=\"$DEVNET_RPC_URL\"" >> $HOME/.zshrc
fi

# Reload the .zshrc file to use the new environment variable
source $HOME/.zshrc

echo "Successfully spawned devnet with RPC URL: $DEVNET_RPC_URL"