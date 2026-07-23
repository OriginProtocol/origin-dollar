#!/usr/bin/env bash
set -euo pipefail

# Install all dependencies:
# 1. Soldeer-managed deps (forge-std, solmate, openzeppelin)
# 2. npm tgz packages that Soldeer cannot extract

cd "$(dirname "$0")"

echo "==> Running soldeer install..."
forge soldeer install

echo "==> Installing npm tgz packages..."

install_tgz() {
  local name="$1"
  local url="$2"

  if [ -d "dependencies/${name}/package" ]; then
    echo "    ${name} already installed, skipping"
    return
  fi

  echo "    Installing ${name}..."
  mkdir -p "dependencies/${name}"
  curl -sL "$url" | tar -xz -C "dependencies/${name}"
}

install_tgz "@chainlink-contracts-ccip-1.2.1" \
  "https://registry.npmjs.org/@chainlink/contracts-ccip/-/contracts-ccip-1.2.1.tgz"

echo "==> All dependencies installed."
