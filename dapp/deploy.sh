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

# .next/cache is only needed for local development. Deleting it circumvents the following error:
# Error Response: [3] The directory [.next/cache/next-babel-loader] has too many files (greater than 1000)..
# The actual .next folder is useful because it contains pre-rendered static versions of all pages that
# can be staticly rendered, which is most of OUSD.com
echo "Deleting .next folder..."
rm -rf .next/cache

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
