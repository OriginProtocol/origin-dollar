# Automaton observability cookbook

How to answer operational questions about the Automaton (see [`README.md`](./README.md)) using Loki + Grafana. The same schema is emitted by the sibling Automaton in `arm-oeth` — swap `app="origin-dollar"` for `app="arm-oeth"` and every query below works there too.

## Event model

Every scheduled invocation produces:

1. **Exactly one `action.start`** from the supervisor, the moment the child is spawned.
2. **Exactly one terminal event** from the supervisor: `action.success` (exit 0) or `action.failure` (non-zero exit, signal, or spawn error).
3. **Optionally, one `action.error`** from the task wrapper if it threw — carries the error class, message, stack, chain, and network.
4. Any number of in-flight `info`/`debug` lines the task itself emitted.

All events for one run share the same `run_id`. Use it as the join key when investigating.

The supervisor owns events 1 and 2. **Even if the child crashes, OOMs, segfaults, or never starts**, the supervisor still produces both — counts and rates stay correct on the worst days.

## Field schema

| Field | Type | Label? | Appears on | Notes |
|---|---|---|---|---|
| `app` | string | **label** | all | Always `origin-dollar` (or `arm-oeth` in the sibling repo). |
| `action` | string | **label** | all | The job name from `cron-jobs.ts`. |
| `event` | string | **label** | start/success/failure/error | One of `action.start`, `action.success`, `action.failure`, `action.error`. |
| `source` | string | **label** | start/success/failure/error | `supervisor` for run-lifecycle events, `task` for `action.error`. |
| `run_id` | UUID | field | all | Correlation key. Field, not label, to keep cardinality bounded. |
| `duration_ms` | number | field | success/failure/error | Wall-clock from supervisor spawn (or task wrapper start) to terminal event. |
| `exit_code` | number\|null | field | success/failure | From the child process. `null` on spawn failure. |
| `signal` | string\|null | field | success/failure | e.g. `SIGKILL` (often = OOM-killed when paired with code 137). |
| `spawn_failed` | bool | field | failure | Set when the child couldn't be spawned at all. |
| `schedule` | string | field | start | The cron expression for the job. |
| `command` | string | field | start | The shell command being executed. |
| `chain_id` | number | field | error | Resolved chain id, if signer setup got that far. |
| `network` | string | field | error | Human network name (`mainnet`, `base`, `sonic`, …). |
| `error_name` | string | field | error | Error class (`Error`, `ProviderError`, …). |
| `error_message` | string | field | error | The thrown message. |
| `error_stack` | string | field | error | Full JS stack trace. |

**Why labels are restricted to `action`, `event`, `source`:** Loki indexes labels, so high-cardinality labels blow up the index. `run_id` (UUIDs), `error_message` (free text), and numeric fields like `duration_ms` would all be cardinality bombs. They're still queryable via `| json` extraction; you just can't use them in stream selectors.

## Common questions → queries

### How many runs of X happened this week?

```logql
sum(count_over_time({app="origin-dollar", action="healthcheck", event="action.start"}[7d]))
```

### How many of those failed?

```logql
sum(count_over_time({app="origin-dollar", action="healthcheck", event="action.failure"}[7d]))
```

### Why did a particular run fail?

Find recent failures, then pivot on `run_id`:

```logql
{app="origin-dollar", event="action.error"}
  | json
  | line_format "{{.action}} [{{.run_id}}] {{.error_name}}: {{.error_message}}"
```

Pick a `run_id` from the result, then:

```logql
{app="origin-dollar"} | json | run_id="<that-uuid>"
```

That returns the full breadcrumb in time order: `action.start` → in-flight info lines from the task → `action.error` (with stack) → supervisor's `action.failure` (with exit code/signal). Usually enough to fix without rerunning locally.

### Average runtime per action

```logql
avg by (action) (
  avg_over_time(
    {app="origin-dollar", event=~"action.success|action.failure", source="supervisor"}
      | json | unwrap duration_ms [7d]
  )
)
```

p95 instead:

```logql
quantile_over_time(0.95,
  {app="origin-dollar", event=~"action.success|action.failure", source="supervisor"}
    | json | unwrap duration_ms [7d]
) by (action)
```

### Success rate per action

```logql
sum by (action) (count_over_time({app="origin-dollar", event="action.success"}[7d]))
/
sum by (action) (count_over_time({app="origin-dollar", event="action.start"}[7d]))
```

Using `action.start` as the denominator (rather than success+failure) catches the pathological case where a run started but no terminal event was ever emitted — the ratio drops below 1.0 and you notice.

### Crashed-without-explanation runs

Runs that produced an `action.failure` with **no** preceding `action.error`. These are the ones where the child died before reaching the task wrapper (OOM, parse error, missing env var, signal). Fewest moving parts:

```logql
{app="origin-dollar", event="action.failure", source="supervisor"} | json | exit_code=137
```

Code 137 + `SIGKILL` is almost always OOM. Code 1 with no `action.error` for the same `run_id` usually means the hardhat process failed before importing the task wrapper.

## Known limitation: log loss on hard kill

Log shipping is direct from the supervisor process to Loki via winston-loki's HTTP transport, batched on a 5ms interval. On graceful `SIGTERM` we `await flushLogger()` before exiting. On `SIGKILL` (OOM-killer, `kill -9`, container force-stop) the in-flight batch dies with the process and those events are lost. Fully fixing this would require a stdout-scraping sidecar (promtail / grafana-agent / alloy) — out of scope. In practice the gap is small: supervisor lifecycle events are emitted at job boundaries, not mid-job, so the window for loss is narrow.

## When to graduate to Prometheus

Symptoms that mean log queries have outgrown their usefulness:

- Grafana panels are slow to render because they re-scan the log stream.
- You want recording rules so dashboards don't recompute on every refresh.
- You want alerts on "no successful run in the last N minutes" with cheap evaluation.
- You want long-retention metrics (months) without paying log-storage costs.

When that happens, add a `/metrics` endpoint to `cron-supervisor.ts` exposing `automaton_runs_total{action,status}`, `automaton_run_duration_seconds{action}` (histogram), and `automaton_last_success_timestamp_seconds{action}` (gauge). The log schema stays as-is for debugging — metrics complement it, they don't replace it.
