#!/usr/bin/env bash
#
# Installs the private @oplabs/talos-client package from GitHub Packages.
#
# The package is declared as an *optional* peer dependency, so `pnpm install`
# deliberately skips it: CI and external contributors must be able to install
# this repo without GitHub Packages auth. Engineers who run Talos actions (or
# anything that loads tasks/lib/signer.ts) locally need it.
#
# The install is intentionally NOT persisted — package.json and pnpm-lock.yaml
# are restored afterwards. Committing the package as a normal dependency would
# break CI, which has no GitHub Packages credentials.
#
# Re-run this after any `pnpm install`, which prunes the unlisted package.
#
set -euo pipefail

cd "$(dirname "$0")/.."

PKG="@oplabs/talos-client"
VERSION=$(node -p "require('./package.json').peerDependencies['${PKG}']")

# Token: an explicit NODE_AUTH_TOKEN wins, else fall back to the gh CLI.
if [ -z "${NODE_AUTH_TOKEN:-}" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "error: no NODE_AUTH_TOKEN set and the gh CLI is not installed." >&2
    echo "  fix: export NODE_AUTH_TOKEN=<PAT with read:packages>" >&2
    exit 1
  fi
  NODE_AUTH_TOKEN=$(gh auth token)
  export NODE_AUTH_TOKEN
fi

# `gh auth login` does not request read:packages by default, so a working gh
# session is not sufficient. Probe the registry before letting pnpm fail with a
# less obvious error.
if ! curl -sf -o /dev/null \
    -H "Authorization: Bearer ${NODE_AUTH_TOKEN}" \
    "https://npm.pkg.github.com/@oplabs%2ftalos-client"; then
  echo "error: token cannot read ${PKG} from GitHub Packages." >&2
  echo "  Your token needs the 'read:packages' scope on the oplabs org." >&2
  echo "  fix: gh auth refresh -s read:packages" >&2
  exit 1
fi

# Auth goes in a throwaway user config rather than the committed .npmrc: pnpm
# emits a "Failed to replace env in config" warning on *every* command when an
# .npmrc references an unset variable, which would hit CI and anyone without a
# token. Keep the noise scoped to this script.
NPMRC=$(mktemp)

# Snapshot the manifest + lockfile by copy, not via git. `git checkout --` would
# restore from the index and silently destroy any unstaged edits the engineer
# already had in these files.
BACKUP=$(mktemp -d)
cp package.json "$BACKUP/package.json"
cp pnpm-lock.yaml "$BACKUP/pnpm-lock.yaml"

cleanup() {
  rm -f "$NPMRC"
  # Restore byte-for-byte, however we exit, so `pnpm install --frozen-lockfile`
  # in CI never sees a lockfile mutated by this script.
  cp "$BACKUP/package.json" package.json
  cp "$BACKUP/pnpm-lock.yaml" pnpm-lock.yaml
  rm -rf "$BACKUP"
}
trap cleanup EXIT

printf '@oplabs:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' \
  "${NODE_AUTH_TOKEN}" > "$NPMRC"

NPM_CONFIG_USERCONFIG="$NPMRC" pnpm add --save-dev "${PKG}@${VERSION}"

echo
echo "Installed ${PKG}@${VERSION} into node_modules."
echo "package.json and pnpm-lock.yaml were left unchanged (by design)."
