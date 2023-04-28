#!/bin/sh
NODE_ENV=production yarn run nx run oeth-dapp:build:production --port=$PORT
