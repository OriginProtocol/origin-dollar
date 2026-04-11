# Cron Actions (Automaton)

Containerized scheduler for running hardhat tasks on a schedule. Replaces OpenZeppelin Defender actions. Internally referred to as **Automaton**; a sibling Automaton with the same shape and log schema lives in the `arm-oeth` repo. Keep field names (`event`, `source`, `action`, `run_id`, `duration_ms`, `error_*`) in sync across both so a single Grafana dashboard can serve both.

## How it works

1. **`cron-jobs.ts`** — Defines all scheduled jobs (name, cron schedule, command, enabled flag) with full TypeScript typing
2. **`render-crontab.ts`** — Imports jobs from `cron-jobs.ts`, filters to enabled jobs, writes a supercronic-compatible crontab file
3. **`cron-supervisor.ts`** — Starts supercronic with the generated crontab, runs an HTTP API for triggering actions on-demand and checking run status
4. **`cron-entrypoint.sh`** — Docker entrypoint that boots the supervisor

Each job runs a hardhat task (e.g. `pnpm hardhat healthcheck`). Signing uses the existing KMS signer from `utils/signers.js` when `AWS_ACCESS_KEY_ID` is set.

## Running locally

```bash
cd contracts
docker compose up actions
```

## API

The supervisor exposes an HTTP API (default port 8080):

```bash
# Health check (no auth)
curl http://localhost:8080/healthz

# List all actions (requires bearer token)
curl -H 'Authorization: Bearer $ACTION_API_BEARER_TOKEN' \
  http://localhost:8080/api/v1/actions

# Trigger an action
curl -X POST -H 'Authorization: Bearer $ACTION_API_BEARER_TOKEN' \
  http://localhost:8080/api/v1/actions/healthcheck/runs

# Check run status
curl -H 'Authorization: Bearer $ACTION_API_BEARER_TOKEN' \
  http://localhost:8080/api/v1/runs/<runId>
```

## Adding a new job

Add an entry to the `cronJobs` array in `cron-jobs.ts`:

```ts
{
  name: "my_new_job",
  schedule: "0 */6 * * *",
  enabled: true,
  command: "cd /app && pnpm hardhat myTask --network mainnet",
}
```

Set `enabled: false` to define a job that can only be triggered via the API.

## Environment variables

| Variable | Description |
|----------|-------------|
| `ACTION_API_BEARER_TOKEN` | Required. Auth token for the HTTP API |
| `PROVIDER_URL` | Mainnet RPC endpoint |
| `HARDHAT_NETWORK` | Default network for tasks |
| `LOKI_URL` | Grafana Loki push endpoint (optional) |
| `LOKI_USER` | Loki basic auth user (optional) |
| `LOKI_API_KEY` | Loki basic auth key (optional) |
| `AWS_ACCESS_KEY_ID` | For KMS signer (optional) |
| `AWS_SECRET_ACCESS_KEY` | For KMS signer (optional) |
| `AUTOMATON_RUN_ID` | Set automatically by the supervisor when spawning a job; correlates task-side logs with the supervisor's lifecycle events |

## Observability

Every scheduled invocation produces exactly one `action.start` and exactly one terminal event (`action.success` or `action.failure`) from the supervisor, plus an `action.error` (with stack, chain, network) from the task wrapper if it threw. All four events share a `run_id` for correlation.

See [`OBSERVABILITY.md`](./OBSERVABILITY.md) for the field schema, the LogQL cookbook, and the recipe for debugging a single failed run end-to-end.
