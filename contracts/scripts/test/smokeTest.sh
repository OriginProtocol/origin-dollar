#!/bin/bash

yarn run node:fork & 
NODE_PID=$!

echo $NODE_PID
wait 