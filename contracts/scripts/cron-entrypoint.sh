#!/bin/sh
set -eu

node /app/scripts/render-crontab.js

echo "[cron-entrypoint] Generated /etc/cronjob:"
cat /etc/cronjob

exec supercronic /etc/cronjob
