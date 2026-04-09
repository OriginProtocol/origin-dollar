#!/bin/sh
set -eu

exec node -r ts-node/register /app/cron/cron-supervisor.ts
