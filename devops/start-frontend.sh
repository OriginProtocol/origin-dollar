#!/bin/sh
cd dist/apps/$APP_ID;
yarn run start -- --port $PORT;
