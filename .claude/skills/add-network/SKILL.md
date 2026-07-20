---
name: add-network
description: |
  Checklist for adding a new EVM network (mainnet or testnet) to the
  origin-dollar repo. Walks through every file that needs touching:
  hardhat config, package.json scripts, utils/{addresses,hardhat-helpers}.js,
  fork-test.sh, deploy/{network}/ directory, and (optionally) CI lanes. Use
  when the user wants to add support for a new chain — e.g. "register
  Sepolia", "add Hyperliquid", "wire up Mantle." References PR #2485 (Plume)
  and PR #2839 (HyperEVM) as worked examples.
when-to-use: |
  - User asks to add support for a new chain in this repo.
  - User wants to register a testnet for staging contracts before mainnet.
  - User asks "what files do I need to change to add {chain}?"
  - User refers to "the add-network skill" or invokes it directly.
---

# Add a network to origin-dollar

Adding a network in this codebase is mechanical but spread across ~12–15
files. Follow this checklist top to bottom. Skip the **(optional)** items if
you don't need fork tests / CI / Defender automation for the new network.

> **Working dir convention.** All file paths below are relative to the repo
> root `/Volumes/origin/origin-dollar/`. Run all commands from `contracts/`.

## 0. Decide network classification

Up front, classify the network. This drives which files actually need touching:

| Dimension | Options | Affects |
|---|---|---|
| **Mainnet or testnet** | mainnet, testnet | Whether you bother with CI lanes; whether the network appears in top-level README's "Deployed on …" list. |
| **L1 / L2 / sidechain** | L1, OP Stack rollup, ZK rollup, sidechain | Whether you need L1StandardBridge addresses, finality assumptions, canonical-bridge support. |
| **Native asset** | ETH, custom token | Affects gas / fee plumbing in adapters and strategies. |
| **Primary bridge protocols** | CCIP, CCTP, LayerZero, OP canonical, custom | Drives which adapters get deployed + what address constants you'll need. |
| **EVM-compatible explorer** | Etherscan family, Blockscout, custom | Drives `etherscan.customChains` config. |

Pick the answers before editing any files — they affect which sections below apply.

## 1. Gather constants

You'll need these before touching any file. Keep them in a scratch note:

- `chainId` (e.g., Sepolia = 11155111)
- `providerURL` env var name (e.g., `SEPOLIA_PROVIDER_URL`)
- CCIP chain selector (if using CCIP — look up at https://docs.chain.link/ccip/directory)
- Canonical bridge addresses (if L2 — L1StandardBridge, L2StandardBridge)
- Explorer URL + API key (or Blockscout-style endpoint)
- Deployer / governor / strategist EOAs or multisigs
- WETH / USDC / etc. token addresses (mainnet equivalents on the new chain)
- Per-network address registry contents the strategies will need

## 2. `contracts/utils/hardhat-helpers.js`

Add the network-detection flags and provider URL. Mirror the existing pattern
for similar networks (e.g., if adding an L2 testnet, copy how `holesky` /
`hoodi` look).

```js
const isSepolia = process.env.NETWORK === "sepolia";
const isSepoliaFork = process.env.FORK_NETWORK_NAME === "sepolia";
const isSepoliaForkTest = isSepoliaFork && isForkTest;
const isSepoliaUnitTest = isSepolia && process.env.IS_TEST === "true";
// ...

const sepoliaProviderUrl = process.env.SEPOLIA_PROVIDER_URL || "";
```

Also branch in `adjustTheForkBlockNumber()` for the new network if you use
`BLOCK_NUMBER` fork pinning.

Export everything at the bottom of the file so `hardhat.config.js` can import.

## 3. `contracts/hardhat.config.js`

Three sections to update:

**(a) Imports** — add the new flags + providerUrl to the destructure at the top:

```js
const {
  // ... existing imports
  isSepolia,
  isSepoliaFork,
  isSepoliaForkTest,
  sepoliaProviderUrl,
} = require("./utils/hardhat-helpers.js");
```

**(b) `networks.<name>` entry** — within the `networks` config:

```js
sepolia: {
  url: sepoliaProviderUrl,
  accounts: [
    process.env.DEPLOYER_PK || privateKeyPlaceholder,
    process.env.GOVERNOR_PK || privateKeyPlaceholder,
  ],
  chainId: 11155111,
  tags: ["sepolia"],
  live: true,
  saveDeployments: true,
},
```

**(c) `namedAccounts`** — add per-network deployer/governor/strategist indexes:

```js
namedAccounts: {
  deployer: { default: 0, sepolia: 0, baseSepolia: 0, ... },
  governorAddr: { default: 1, sepolia: 1, baseSepolia: 1, ... },
  strategistAddr: { default: 2, sepolia: 2, baseSepolia: 2, ... },
},
```

**(d) Etherscan verification** — within `etherscan` config:

```js
etherscan: {
  apiKey: {
    sepolia: process.env.ETHERSCAN_API_KEY,
    baseSepolia: process.env.ETHERSCAN_API_KEY,  // Etherscan V2 multichain key
    // ...
  },
  customChains: [
    // Add an entry if the network isn't built into hardhat-verify.
    {
      network: "baseSepolia",
      chainId: 84532,
      urls: {
        apiURL: "https://api-sepolia.basescan.org/api",
        browserURL: "https://sepolia.basescan.org",
      },
    },
  ],
},
```

## 4. `contracts/package.json`

Add per-network scripts. Minimum set:

```json
{
  "scripts": {
    "deploy:sepolia": "hardhat deploy --network sepolia",
    "node:sepolia": "FORK=true FORK_NETWORK_NAME=sepolia hardhat node",
    "test:sepolia-fork": "FORK_NETWORK_NAME=sepolia bash fork-test.sh"
  }
}
```

If you'll have coverage runs or Anvil-based local nodes:

```json
{
  "test:coverage:sepolia-fork": "REPORT_COVERAGE=true FORK_NETWORK_NAME=sepolia bash fork-test.sh",
  "node:anvil:sepolia": "anvil --fork-url $SEPOLIA_PROVIDER_URL"
}
```

## 5. `contracts/utils/addresses.js`

Add the new network and populate it with what the strategies need:

```js
addresses.sepolia = {};
addresses.sepolia.WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
addresses.sepolia.CCIPRouter = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
// ...
```

For L2s, document **both** sides of the lane in the L1's entry (e.g., the L1
side stores both Sepolia-side endpoints AND L1StandardBridge for the L2's
rollup). Otherwise deploy scripts have to cross-reference and that gets
brittle.

## 6. `contracts/utils/deploy.js`

Usually no changes. Check for any `isMainnet*` / `isBase*` style helper
predicates inside `withConfirmation` or `deployWithConfirmation` that gate on
network — mirror them if your new network needs the same behaviour.

## 7. `contracts/fork-test.sh`

Add an `elif` branch in the network-mapping switch (~line 30–60):

```bash
elif [[ $FORK_NETWORK_NAME == "sepolia" ]]; then
  PROVIDER_URL=$SEPOLIA_PROVIDER_URL;
  BLOCK_NUMBER=$SEPOLIA_BLOCK_NUMBER;
elif [[ $FORK_NETWORK_NAME == "baseSepolia" ]]; then
  PROVIDER_URL=$BASE_SEPOLIA_PROVIDER_URL;
  BLOCK_NUMBER=$BASE_SEPOLIA_BLOCK_NUMBER;
```

## 8. `contracts/dev.env`

Document the new env vars (this file is copied to `.env` for local dev):

```
SEPOLIA_PROVIDER_URL=
SEPOLIA_BLOCK_NUMBER=
BASE_SEPOLIA_PROVIDER_URL=
BASE_SEPOLIA_BLOCK_NUMBER=
```

## 9. `contracts/deploy/{network}/`

Create the directory and add numbered deploy scripts. Pattern from
PR #2485 (Plume) and PR #2839 (HyperEVM):

- `001_mock_*.js` — mocks if testnet (Mock vault, Mock OToken, etc.)
- `002_*.js` … `00N_*.js` — actual strategy / contract deploys
- Final script — wiring (authorise adapters, set caps, whitelist on vault)

Each script:
1. Exports a `deployFunction` async with `(hre)` signature.
2. Tags: `{module.exports.tags = ["network-name", "specific-tag"]}`.
3. Uses helpers from `utils/deploy.js`:
   - `withConfirmation(promise)` — awaits and logs.
   - `deployWithConfirmation(name, args, contractName)` — deploys with verify support.
   - `deployProxyWithCreateX(name, args, salt, contractName)` — CREATE3 for peer-parity addresses.

## 10. `contracts/deployments/{network}/`

This directory is auto-created by `hardhat-deploy` on first run. To make it
explicit and discoverable, commit a stub `.chainId` file with the chain ID:

```
$ echo "11155111" > contracts/deployments/sepolia/.chainId
```

## 11. `contracts/test/helpers.js` (only if fork/unit tests follow)

Add to the `network detection` flags block (~line 314–328):

```js
const isSepolia = hre.network.name === "sepolia";
const isSepoliaFork = process.env.FORK_NETWORK_NAME === "sepolia";
const isSepoliaOrFork = isSepolia || isSepoliaFork;
// ...
module.exports = { isSepolia, isSepoliaFork, isSepoliaOrFork, ... }
```

Also branch `getAssetAddresses(hre)` if the new network has different token addresses than mainnet.

## 12. `contracts/test/_fixture-{network}.js` (optional)

Only if you'll have unit or fork tests for the network. Copy
`test/_fixture-base.js` as a template and adapt for the new network's
fixtures.

## 13. `.github/workflows/defi.yml` (optional)

Add a `contracts-{network}-forktest` job mirroring the existing pattern
(~line 173–228). Requires CI secrets configured for `{NETWORK}_PROVIDER_URL`.
Skip if you don't need CI-level fork tests for the network.

## 14. `contracts/scripts/defender-actions/` (optional)

Only relevant if cross-chain relay automation or scheduled jobs need to run
for the new network. Mirror existing scripts (e.g.,
`scripts/defender-actions/crossChainRelay.js`).

## 15. Top-level `README.md`

Add the network to the "Deployed on Ethereum Mainnet, Base, Arbitrum, Sonic,
Plume, Holesky, Hoodi, …" list at the top.

## 16. Verify

```bash
cd contracts
pnpm hardhat compile                       # compiles
pnpm prettier:sol && pnpm prettier:js      # format
pnpm lint:sol && pnpm lint:js              # lint
pnpm hardhat console --network {network}   # provider resolves (will error on connect if URL is empty, that's OK)
pnpm hardhat deploy --network {network} --dry-run   # deploy wiring sanity
```

## 17. Smoke test on the new network

After actual deploy:
- Read back a key contract's address via `hardhat console`.
- Read a public view function to confirm the deployment actually accepted calls.
- For CREATE3 deploys: confirm peer-chain addresses are byte-identical.

---

## Edge cases & gotchas

- **Sonic** added `isSonicForkTest` as a separate flag from `isSonicFork`. Some networks need both depending on how tests are wired. Look at existing usage in `test/helpers.js` to decide.
- **HyperEVM** has no Etherscan-family verifier; uses `customChains` with the
  HyperEVM block explorer endpoint.
- **Plume Explorer** is Blockscout-compatible at `explorer.plume.org/api`; no
  API key needed.
- **Base / Base Sepolia**: basescan.org's V1 API is deprecated. Use the
  Etherscan V2 multichain API key with a `customChains` entry pointing at
  Etherscan's per-chain endpoint.
- **L2s**: register both directions in `addresses.js` — the L2-side bridge
  components AND the L1-side companion components on the L1's address entry
  (L1StandardBridge for the L2's rollup, etc.).
- **`accounts`** field in `networks.<name>`: do NOT use `defaultAccounts`
  blindly. Specify deployer + governor PK env vars so devs can override
  per-environment.

## Reference PRs

- **PR #2485** (Plume) — https://github.com/OriginProtocol/origin-dollar/pull/2485
  L2 network with full token + vault deploy, LayerZero integration.
- **PR #2839** (HyperEVM) — https://github.com/OriginProtocol/origin-dollar/pull/2839
  Sidechain with strategy proxies + cross-chain relay scripts.

When in doubt, look at how the most-similar existing network is wired and
mirror that pattern. Don't invent new conventions.
