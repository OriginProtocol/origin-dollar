-- contracts/migrations/raise_hardhat_heap.sql
-- Prefix every origin-dollar schedule command with
-- NODE_OPTIONS=--max-old-space-size=8096 so the hardhat child process
-- gets an 8 GB V8 old-space regardless of whether the runner container
-- env var is in effect. (The current running image is capping at the
-- Node default ~2 GB; verifyBalances hits that ceiling while building
-- the mainnet beacon-state tree and OOMs.)
--
-- Apply against the shared talos Postgres:
--   psql "$DATABASE_URL" -f contracts/migrations/raise_hardhat_heap.sql
--
-- Idempotent: the WHERE clause skips rows that already carry NODE_OPTIONS=.

UPDATE schedules
SET
  command = REPLACE(
    command,
    'cd /app && pnpm hardhat',
    'cd /app && NODE_OPTIONS=--max-old-space-size=8096 pnpm hardhat'
  ),
  updated_at = NOW()
WHERE product = 'origin-dollar'
  AND command LIKE 'cd /app && pnpm hardhat%'
  AND command NOT LIKE '%NODE_OPTIONS=%';
