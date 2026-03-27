#!/bin/sh
set -eu

exec node -r ts-node/register /app/scripts/cron-supervisor.ts
