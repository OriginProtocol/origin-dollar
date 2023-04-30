#!/bin/sh
export NODE_ENV=production;
next start ./dist/apps/$APP_ID/ --port=$PORT


