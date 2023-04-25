#!/bin/sh
cd dist/apps/$APP_ID;
yarn run next serve --port $PORT;
