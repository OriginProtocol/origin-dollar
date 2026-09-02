#!/usr/bin/env bash
set -euo pipefail

HOST="${ANVIL_RPC_URL:-http://127.0.0.1:8545}"
NETWORKS=(
  "origin-anvil-mainnet:1"
  "origin-anvil-arbitrum:42161"
  "origin-anvil-base:8453"
  "origin-anvil-sonic:146"
  "origin-anvil-plume:98866"
  "origin-anvil-hoodi:560048"
  "origin-anvil-hyperevm:999"
)

for entry in "${NETWORKS[@]}"; do
  id="${entry%%:*}"
  chain_id="${entry##*:}"
  brownie networks delete "$id" >/dev/null 2>&1 || true
  brownie networks add Ethereum "$id" host="$HOST" chainid="$chain_id" >/dev/null
done

printf 'Configured Brownie networks at %s:\n' "$HOST"
printf '  %s\n' "${NETWORKS[@]%%:*}"
