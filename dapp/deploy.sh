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

# .next folder is only needed for local development. Deleting it circumvents the following error:
# Error Response: [3] The directory [.next/cache/next-babel-loader] has too many files (greater than 1000)..
echo "Deleting .next folder..."
rm -rf .next

echo "Decrypting secrets..."
yarn run decrypt-secrets-deploy:$mode

echo "Generating ABIs..."
cd ../contracts
yarn install
yarn run deploy

echo "Starting deployment..."
cd ../dapp
npm run deploy:$mode

echo "Deployment done."
