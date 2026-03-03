#!/usr/bin/env bash
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
REWARD_TOKEN=""
FEE_COLLECTOR=""
FEE=""
CAMPAIGN_REMOTE_MANAGER=""
VOTEMARKET=""
FACTORY=""
RPC_URL=""
SAFE=""
GAUGES=()

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage: generate-pool-booster-safe.sh [OPTIONS] GAUGE_ADDRESS...

Options:
  --reward-token ADDRESS
  --fee-collector ADDRESS
  --fee UINT16
  --campaign-remote-manager ADDRESS
  --votemarket ADDRESS
  --factory ADDRESS
  --rpc-url URL
  --safe ADDRESS               Safe address (used in meta.createdFromSafeAddress)
  -h, --help                   Show this help

Positional arguments are gauge addresses (one or more).

Output: Safe Transaction Builder JSON written to stdout.

Dependencies: cast (foundry), jq
EOF
  exit 0
}

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reward-token)            REWARD_TOKEN="$2";             shift 2 ;;
    --fee-collector)           FEE_COLLECTOR="$2";            shift 2 ;;
    --fee)                     FEE="$2";                      shift 2 ;;
    --campaign-remote-manager) CAMPAIGN_REMOTE_MANAGER="$2";  shift 2 ;;
    --votemarket)              VOTEMARKET="$2";               shift 2 ;;
    --factory)                 FACTORY="$2";                  shift 2 ;;
    --rpc-url)                 RPC_URL="$2";                  shift 2 ;;
    --safe)                    SAFE="$2";                     shift 2 ;;
    -h|--help)                 usage ;;
    -*)                        echo "Unknown option: $1" >&2; exit 1 ;;
    *)                         GAUGES+=("$1");                shift ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────────
for var in REWARD_TOKEN FEE_COLLECTOR FEE CAMPAIGN_REMOTE_MANAGER VOTEMARKET FACTORY RPC_URL SAFE; do
  if [[ -z "${!var}" ]]; then
    echo "Error: --$(echo "$var" | tr '_' '-' | tr '[:upper:]' '[:lower:]') is required" >&2
    exit 1
  fi
done

if [[ ${#GAUGES[@]} -eq 0 ]]; then
  echo "Error: at least one gauge address is required" >&2
  exit 1
fi

# ── Fetch all registered gauges from the gauge controller ────────────────────
GAUGE_CONTROLLER="0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB"
n_gauges=$(cast call "$GAUGE_CONTROLLER" "n_gauges()(int128)" --rpc-url "$RPC_URL")
echo "Fetching $n_gauges gauges from gauge controller..." >&2

# Fetch in parallel batches for speed
registered_gauges_file=$(mktemp)
trap 'rm -f "$registered_gauges_file"' EXIT

seq 0 $((n_gauges - 1)) | xargs -P 20 -I{} sh -c \
  'cast call "'"$GAUGE_CONTROLLER"'" "gauges(uint256)(address)" {} --rpc-url "'"$RPC_URL"'" | tr "[:upper:]" "[:lower:]"' \
  >> "$registered_gauges_file"

for gauge in "${GAUGES[@]}"; do
  gauge_lower=$(echo "$gauge" | tr '[:upper:]' '[:lower:]')
  if ! grep -qi "$gauge_lower" "$registered_gauges_file"; then
    echo "Error: gauge $gauge is not registered on the gauge controller" >&2
    exit 1
  fi
done
echo "All gauges verified on gauge controller." >&2

# ── JSON templates ────────────────────────────────────────────────────────────
create_tx_template=$(cat <<'TMPL'
{
  "to": $factory,
  "value": "0",
  "data": null,
  "contractMethod": {
    "inputs": [
      { "internalType": "address", "name": "_rewardToken", "type": "address" },
      { "internalType": "address", "name": "_gauge", "type": "address" },
      { "internalType": "address", "name": "_feeCollector", "type": "address" },
      { "internalType": "uint16", "name": "_fee", "type": "uint16" },
      { "internalType": "address", "name": "_campaignRemoteManager", "type": "address" },
      { "internalType": "address", "name": "_votemarket", "type": "address" },
      { "internalType": "bytes32", "name": "_salt", "type": "bytes32" },
      { "internalType": "address", "name": "_expectedAddress", "type": "address" }
    ],
    "name": "createCurvePoolBoosterPlain",
    "payable": false
  },
  "contractInputsValues": {
    "_rewardToken": $rewardToken,
    "_gauge": $gauge,
    "_feeCollector": $feeCollector,
    "_fee": $fee,
    "_campaignRemoteManager": $campaignRemoteManager,
    "_votemarket": $votemarket,
    "_salt": $salt,
    "_expectedAddress": $expectedAddress
  }
}
TMPL
)

delegate_tx_template=$(cat <<'TMPL'
{
  "to": $rewardToken,
  "value": "0",
  "data": null,
  "contractMethod": {
    "inputs": [
      { "internalType": "address", "name": "_from", "type": "address" },
      { "internalType": "address", "name": "_to", "type": "address" }
    ],
    "name": "delegateYield",
    "payable": false
  },
  "contractInputsValues": {
    "_from": $pool,
    "_to": $expectedAddress
  }
}
TMPL
)

# ── Salt: factory address (20 bytes) + timestamp-based counter (12 bytes) ────
# Format: 0x<factory_lowercase><hash_based_counter_24hex>
# keccak256(timestamp) provides the base; each gauge increments by 1.
FACTORY_LOWER=$(echo "${FACTORY#0x}" | tr '[:upper:]' '[:lower:]')
TIMESTAMP=$(date +%s)
BASE_HASH=$(cast keccak "$(cast abi-encode 'f(uint256)' "$TIMESTAMP")")
# Use last 12 bytes (24 hex chars) of the hash as base counter
BASE_COUNTER=$(( 16#${BASE_HASH:42:24} ))

echo "Salt prefix: $FACTORY_LOWER | base counter from timestamp $TIMESTAMP" >&2

# ── Build transactions array ─────────────────────────────────────────────────
txs="[]"
salt_counter=0

for gauge in "${GAUGES[@]}"; do
  salt_counter=$((salt_counter + 1))
  salt="0x${FACTORY_LOWER}$(printf '%024x' $(( BASE_COUNTER + salt_counter )))"

  # Get lp_token (pool address) from gauge
  pool=$(cast call "$gauge" "lp_token()(address)" --rpc-url "$RPC_URL")

  # Compute expected pool booster address
  expected_address=$(cast call "$FACTORY" \
    "computePoolBoosterAddress(address,address,bytes32)(address)" \
    "$REWARD_TOKEN" "$gauge" "$salt" \
    --rpc-url "$RPC_URL")

  echo "Gauge: $gauge → Pool: $pool → Booster: $expected_address (salt: $salt_counter)" >&2

  # createCurvePoolBoosterPlain tx
  create_tx=$(jq -n \
    --arg factory    "$FACTORY" \
    --arg rewardToken "$REWARD_TOKEN" \
    --arg gauge      "$gauge" \
    --arg feeCollector "$FEE_COLLECTOR" \
    --arg fee        "$FEE" \
    --arg campaignRemoteManager "$CAMPAIGN_REMOTE_MANAGER" \
    --arg votemarket "$VOTEMARKET" \
    --arg salt       "$salt" \
    --arg expectedAddress "$expected_address" \
    "$create_tx_template")

  # delegateYield tx
  delegate_tx=$(jq -n \
    --arg rewardToken "$REWARD_TOKEN" \
    --arg pool       "$pool" \
    --arg expectedAddress "$expected_address" \
    "$delegate_tx_template")

  txs=$(echo "$txs" | jq --argjson c "$create_tx" --argjson d "$delegate_tx" '. + [$c, $d]')
done

# ── Assemble final JSON ──────────────────────────────────────────────────────
jq -n \
  --arg safe "$SAFE" \
  --argjson txs "$txs" \
  '{
    version: "1.0",
    chainId: "1",
    createdAt: 1741011600000,
    meta: {
      name: "Create CurvePoolBoosterPlain for gauges",
      description: "Deploy CurvePoolBoosterPlain instances and delegate yield from pools to boosters",
      txBuilderVersion: "1.16.5",
      createdFromSafeAddress: $safe,
      createdFromOwnerAddress: ""
    },
    transactions: $txs
  }'
