#!/bin/sh
NODE_ENV=production yarn run nx run oeth-dapp:build:production --port=$PORT
export NODE_ENV=production; 
cd apps/$APP_ID;
yarn run start --port=$PORT
