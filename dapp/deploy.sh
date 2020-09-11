#!/bin/sh
set -e
mode=$1
branch=$(git branch | awk '/\*/ { print $2; }') 

if [ $branch != "master" ]; then
  if [ $mode == "staging" ]; then
    echo "Deploying non-master branch '$branch'"
  else
    echo "You are on '$branch'. Switch to 'master' branch before you deploy"
    exit 1
  fi
fi

echo "Decrypting secrets..."
npm run decrypt-secrets:$mode

echo "Generating ABIs..."
cd ../contracts
yarn install
yarn run deploy

echo "Starting deployment..."
cd ../dapp
npm run deploy:$mode

echo "Deployment done."
