#!/usr/bin/env bash
set -euo pipefail

# ── Known addresses ───────────────────────────────────────────────────────────
OUSD="0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86"
OETH="0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3"

# ── Defaults (overridable via flags) ──────────────────────────────────────────
REWARD_TOKEN=""
FEE_COLLECTOR="0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971"
FEE="0"
CAMPAIGN_REMOTE_MANAGER="0x53aD4Cd1F1e52DD02aa9FC4A8250A1b74F351CA2"
VOTEMARKET="0x8c2c5A295450DDFf4CB360cA73FCCC12243D14D9"
FACTORY="0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289"
RPC_URL=""
SAFE="0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971"
GAUGES=()

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage: generate-pool-booster-safe.sh [OPTIONS] GAUGE_ADDRESS...

Options:
  --reward-token ADDRESS       Override auto-detected reward token (OUSD/OETH)
  --fee-collector ADDRESS      (default: 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971)
  --fee UINT16                 (default: 0)
  --campaign-remote-manager ADDRESS (default: 0x53aD4Cd1F1e52DD02aa9FC4A8250A1b74F351CA2)
  --votemarket ADDRESS         (default: 0x8c2c5A295450DDFf4CB360cA73FCCC12243D14D9)
  --factory ADDRESS            (default: 0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289)
  --rpc-url URL
  --safe ADDRESS               (default: 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971)
  -h, --help                   Show this help

Positional arguments are gauge addresses (one or more).

The reward token is auto-detected by inspecting pool coins for OUSD or OETH.
All gauges must use the same reward token.

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
if [[ -z "$RPC_URL" ]]; then
  echo "Error: --rpc-url is required" >&2
  exit 1
fi

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

# ── Auto-detect reward token from first gauge's pool coins ──────────────────
if [[ -z "$REWARD_TOKEN" ]]; then
  first_gauge="${GAUGES[0]}"
  detect_pool=$(cast call "$first_gauge" "lp_token()(address)" --rpc-url "$RPC_URL")
  echo "Auto-detecting reward token from pool $detect_pool..." >&2

  OUSD_LOWER=$(echo "$OUSD" | tr '[:upper:]' '[:lower:]')
  OETH_LOWER=$(echo "$OETH" | tr '[:upper:]' '[:lower:]')
  found_token=""

  for i in 0 1 2 3; do
    coin=$(cast call "$detect_pool" "coins(uint256)(address)" "$i" --rpc-url "$RPC_URL" 2>/dev/null || break)
    coin_lower=$(echo "$coin" | tr '[:upper:]' '[:lower:]')
    if [[ "$coin_lower" == "$OUSD_LOWER" ]]; then
      found_token="$OUSD"
      break
    elif [[ "$coin_lower" == "$OETH_LOWER" ]]; then
      found_token="$OETH"
      break
    fi
  done

  if [[ -z "$found_token" ]]; then
    echo "Error: could not find OUSD or OETH in pool $detect_pool coins" >&2
    exit 1
  fi

  REWARD_TOKEN="$found_token"
  echo "Reward token: $REWARD_TOKEN" >&2
fi

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

# ── Example usage ─────────────────────────────────────────────────────────────
# OUSD gauges (reward token auto-detected):
#
#   ./generate-pool-booster-safe.sh \
#     --rpc-url https://ethereum-rpc.publicnode.com \
#     0x0e0fd7517e9b0e206e5ee8c7df7348f6f32c3caf \
#     0x7738ca93e0a122d3e66bb4e863f1572958f2c150 \
#     0x5e54eb89fb1ba7f735c96a45e6641b362009b228 \
#     0x8605c1fde3bed25b4cde604daec1599644629159 \
#     0xc58cb38c462c27baee0abb9790402f2e80cfb471 \
#     0x12c3cfd7a60c4d85f9bdbd8d799cd2f7824fd4b7 \
#     0x35e4b1bc8818fc098efcf9ad9784b28d8b4bf639 \
#     0xab704870d468fc3b6c313d5e63fd550ffe3d513b \
#     > safe-create-pool-boosters-ousd.json
#
# With overrides:
#
#   ./generate-pool-booster-safe.sh \
#     --rpc-url https://ethereum-rpc.publicnode.com \
#     --reward-token 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3 \
#     --fee 500 \
#     --safe 0x1234...abcd \
#     0xGAUGE1 0xGAUGE2 \
#     > output.json
