#!/usr/bin/env bash
set -euo pipefail

NETWORK="${1:-${FORK_NETWORK_NAME:-mainnet}}"
PORT="${PORT:-8545}"
HOST="${ANVIL_HOST:-127.0.0.1}"
TIMEOUT="${ANVIL_READY_TIMEOUT:-1200}"
MNEMONIC="replace hover unaware super where filter stone fine garlic address matrix basic"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

case "$NETWORK" in
  mainnet) CHAIN_ID=1; RPC="${MAINNET_PROVIDER_URL:-${PROVIDER_URL:-}}"; BLOCK="${MAINNET_BLOCK_NUMBER:-${BLOCK_NUMBER:-}}" ;;
  arbitrum|arbitrumOne) NETWORK=arbitrumOne; CHAIN_ID=42161; RPC="${ARBITRUM_PROVIDER_URL:-}"; BLOCK="${ARBITRUM_BLOCK_NUMBER:-}" ;;
  base) CHAIN_ID=8453; RPC="${BASE_PROVIDER_URL:-}"; BLOCK="${BASE_BLOCK_NUMBER:-}" ;;
  sonic) CHAIN_ID=146; RPC="${SONIC_PROVIDER_URL:-}"; BLOCK="${SONIC_BLOCK_NUMBER:-}" ;;
  plume) CHAIN_ID=98866; RPC="${PLUME_PROVIDER_URL:-}"; BLOCK="${PLUME_BLOCK_NUMBER:-}" ;;
  hoodi) CHAIN_ID=560048; RPC="${HOODI_PROVIDER_URL:-}"; BLOCK="${HOODI_BLOCK_NUMBER:-}" ;;
  hyperevm) CHAIN_ID=999; RPC="${HYPEREVM_PROVIDER_URL:-}"; BLOCK="${HYPEREVM_BLOCK_NUMBER:-}" ;;
  *) echo "Unsupported Anvil network: $NETWORK" >&2; exit 2 ;;
esac

ARGS=(
  --host "$HOST"
  --port "$PORT"
  --chain-id "$CHAIN_ID"
  --mnemonic "$MNEMONIC"
  --block-base-fee-per-gas 0
  --auto-impersonate
  --disable-block-gas-limit
  --disable-code-size-limit
  --silent
)
if [[ "${ANVIL_NO_FORK:-false}" != "true" ]]; then
  if [[ -z "$RPC" ]]; then
    echo "Missing RPC URL for $NETWORK; configure its *_PROVIDER_URL" >&2
    exit 1
  fi
  ARGS+=(--fork-url "$RPC")
  if [[ -n "$BLOCK" ]]; then ARGS+=(--fork-block-number "$BLOCK"); fi
fi

LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/origin-anvil.XXXXXX")"
anvil "${ARGS[@]}" >"$LOG_FILE" 2>&1 &
ANVIL_PID=$!
cleanup() {
  kill "$ANVIL_PID" 2>/dev/null || true
  wait "$ANVIL_PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT INT TERM

deadline=$((SECONDS + TIMEOUT))
while (( SECONDS < deadline )); do
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
    cat "$LOG_FILE" >&2
    exit 1
  fi
  response="$(curl --silent --show-error --max-time 2 \
    --header 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
    "http://$HOST:$PORT" 2>/dev/null || true)"
  if [[ "$response" == *"\"result\":\"0x$(printf '%x' "$CHAIN_ID")\""* ]]; then
    echo "Anvil ready: $NETWORK chainId=$CHAIN_ID http://$HOST:$PORT"
    cat "$LOG_FILE"
    wait "$ANVIL_PID"
    exit $?
  fi
  sleep 0.2
done
cat "$LOG_FILE" >&2
echo "Anvil JSON-RPC readiness timed out after ${TIMEOUT}s" >&2
exit 1
