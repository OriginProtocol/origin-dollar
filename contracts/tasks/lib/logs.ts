/**
 * Backwards `eth_getLogs` search that survives a load-balanced RPC (dRPC
 * routes each call to one of several upstreams).
 *
 * - Chunks span at most `MAX_LOG_CHUNK` blocks: some upstreams reject a
 *   wider range ("query block range exceeds server limit ... 10000").
 * - The newest `headLag` blocks are queried on their own, so only that small
 *   range can hit an upstream that lags the head ("block range extends beyond
 *   current head block"). It is retried, not skipped: an event there is our
 *   own previous run, and missing it would read a burned position.
 * - Every call is retried with a backoff on transient errors (HTTP 5xx,
 *   "Temporary internal error", head lag). A range-limit error halves the
 *   chunk instead of counting as a failure.
 */

/** Widest range an upstream accepts: `to - from + 1 <= 10000`. */
export const MAX_LOG_CHUNK = 9_999;

const RANGE_LIMIT =
  /range (exceeds|is too (large|wide))|block range|narrow your filter|too many (blocks|results)/i;
const TRANSIENT =
  /temporary|try again|retry|timeout|timed out|rate limit|too many requests|beyond current head|header not found|unknown block|server error|bad gateway|service unavailable|gateway time|ECONNRESET|ETIMEDOUT|socket hang up/i;

function errorText(err: unknown): string {
  const e = err as {
    message?: string;
    body?: string;
    code?: string | number;
    status?: number;
    error?: unknown;
  };
  const parts = [
    e?.message,
    e?.body,
    String(e?.code ?? ""),
    String(e?.status ?? ""),
  ];
  if (e?.error && e.error !== err) parts.push(errorText(e.error));
  return parts.filter(Boolean).join(" ");
}

/** "query block range exceeds server limit, narrow your filter: 10000". */
export function isRangeLimitError(err: unknown): boolean {
  const text = errorText(err);
  return RANGE_LIMIT.test(text) && !/beyond current head/i.test(text);
}

/** HTTP 5xx, JSON-RPC code 19, lagging upstream, network blips. */
export function isTransientLogError(err: unknown): boolean {
  const text = errorText(err);
  return (
    TRANSIENT.test(text) ||
    /SERVER_ERROR|TIMEOUT|NETWORK_ERROR/.test(text) ||
    /\b5\d\d\b/.test(text)
  );
}

export interface LatestLogOptions<T> {
  /** One `eth_getLogs` over `[from, to]`, oldest first. */
  query: (from: number, to: number) => Promise<T[]>;
  /** Newest block to search. */
  latest: number;
  /** Oldest block to search. */
  floor: number;
  /** Blocks per call, capped at `MAX_LOG_CHUNK`. */
  chunk?: number;
  /** Newest blocks queried on their own (lagging upstreams). */
  headLag?: number;
  /** Attempts per range before giving up. */
  attempts?: number;
  /** First backoff; doubles on each retry. */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (msg: string) => void;
}

/** The newest log in `[floor, latest]`, or undefined when there is none. */
export async function findLatestLog<T>({
  query,
  latest,
  floor,
  chunk = MAX_LOG_CHUNK,
  headLag = 5,
  attempts = 3,
  backoffMs = 500,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  onRetry = () => {},
}: LatestLogOptions<T>): Promise<T | undefined> {
  let size = Math.max(1, Math.min(chunk, MAX_LOG_CHUNK));
  let to = latest;
  let first = true;
  while (to >= floor) {
    const width = first ? Math.max(1, Math.min(headLag, size)) : size;
    const from = Math.max(floor, to - width + 1);
    let logs: T[] | undefined;
    for (let attempt = 1; logs === undefined; attempt++) {
      try {
        logs = await query(from, to);
      } catch (err) {
        if (isRangeLimitError(err) && to > from) {
          size = Math.max(1, Math.floor((to - from + 1) / 2));
          onRetry(`getLogs [${from}, ${to}] too wide; chunk now ${size}`);
          break;
        }
        if (attempt >= attempts || !isTransientLogError(err)) throw err;
        const wait = backoffMs * 2 ** (attempt - 1);
        onRetry(
          `getLogs [${from}, ${to}] failed (attempt ${attempt}/${attempts}), retrying in ${wait}ms: ${
            (err as Error)?.message ?? err
          }`
        );
        await sleep(wait);
      }
    }
    // Range-limit error: retry the same `to` with the halved chunk.
    if (logs === undefined) continue;
    if (logs.length > 0) return logs[logs.length - 1];
    first = false;
    to = from - 1;
  }
  return undefined;
}
