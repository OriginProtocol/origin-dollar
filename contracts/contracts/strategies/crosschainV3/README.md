# OETHb V3 — Bridge-Agnostic Cross-Chain Strategy

This directory implements the V3 cross-chain strategy pair (Master + Remote) and the bridge-agnostic adapter layer they speak to.

**Scope: OETHb Phase 1.** Migration of ~8.7k wOETH from the existing oracle-priced `BridgedWOETHStrategy` on Base into a new Master/Remote pair, so the Base vault's wOETH position earns real, reported yield instead of an oracle price.

| Leg | Chain | Contract | Role |
|---|---|---|---|
| Master | Base (8453) | `MasterWOTokenStrategy` | Strategy registered on the OETHb Vault. Holds WETH plus an accounting number. |
| Remote | Ethereum (1) | `RemoteWOTokenStrategy` | Not registered with any vault. Custodies wOETH shares; mints/redeems OETH at the mainnet OETH Vault. |
| Migration | Base | `BridgedWOETHMigrationStrategy` | Upgrade impl for the existing `BridgedWOETHStrategyProxy`; `bridgeToRemote()` CCIP-ships wOETH to Remote. |

**Only the backing asset (WETH) crosses a bridge.** The pair never bridges the OToken or the wOToken — see [`DESIGN.md`](./DESIGN.md) §3.11. Every cross-chain message is nonce-gated and originates at Master.

**For narrative walkthroughs of each flow (deposit, withdraw, balance check) with sequence diagrams, see [`FLOWS.md`](./FLOWS.md).** This README is the reference: file map, message envelope, state-transition table, authorisation surface, adapter knobs.

## File map

```
contracts/interfaces/crosschainV3/
  IBridgeAdapter.sol         — strategies talk through this for outbound sends + quoteFee + maxTransferAmount
  IBridgeReceiver.sol        — strategies implement `receiveMessage` for inbound delivery
  ISplitInboundAdapter.sol   — split-delivery adapters expose pending-slot lifecycle

contracts/strategies/crosschainV3/
  CrossChainV3Helper.sol           — strategy envelope `abi.encode(msgType, nonce, body)` + per-msgType codec
  AbstractCrossChainV3Strategy.sol — adapter wiring, yield-nonce machinery, inbound dispatch,
                                     single pool-funded outbound send helper (`_send`)
  AbstractWOTokenStrategy.sol      — wOToken pair base: the `bridgeAsset` immutable and its 18-decimal
                                     invariant, `onlyOperatorGovernorOrStrategist` modifier, strategy-base
                                     stubs, outbound-adapter allowance rotation
  MasterWOTokenStrategy.sol        — vault-facing leg: yield-channel ACK handlers + operator entrypoints
  RemoteWOTokenStrategy.sol        — yield-side leg: 2-step bridgeAsset↔OToken↔wOToken pipeline

contracts/strategies/crosschainV3/adapters/
  AbstractAdapter.sol     — shared base: multi-tenant whitelist, per-lane config,
                            envelope wrap/unwrap (52-byte header: 20-byte sender + 32-byte
                            intendedAmount), `_validateInbound`, `_deliver`, transfer caps
  CCIPAdapter.sol         — Chainlink CCIP atomic token + message. Deployed on both chains;
                            carries the Base → Ethereum direction (Master outbound, Remote inbound).
  SuperbridgeAdapter.sol  — split delivery: OP Stack L1StandardBridge for the canonical ETH leg + CCIP
                            for the message. Token-bearing sends only on the L1 side; L2 side runs as
                            inbound only (canonical ETH wrapped to WETH via `receive()`).

contracts/strategies/crosschainV3/libraries/
  CCIPMessageBuilder.sol  — shared CCIP `Client.EVM2AnyMessage` construction

contracts/proxies/create2/
  CrossChainStrategyProxy.sol — Master/Remote strategy proxy (CreateX/CREATE2-deployable for peer parity)
  BridgeAdapterProxy.sol      — Adapter proxy (CreateX/CREATE2-deployable for peer parity)

contracts/strategies/
  BridgedWOETHMigrationStrategy.sol — Phase 1 upgrade impl for the existing Base proxy

contracts/mocks/crosschainV3/
  MockBridgeAdapter, MockBridgeReceiver, MockCCIPRouter, MockCrossChainV3HelperHarness,
  MockEthOTokenVault, MockMintableBurnableOToken, MockOTokenVault
```

## Message envelope (wire format)

The protocol uses two nested envelopes:

1. **Adapter envelope** (built by `AbstractAdapter._wrap`): a 52-byte header followed by the strategy's opaque payload.

   ```
   [0..20)   address sender          (source-side strategy)
   [20..52)  uint256 intendedAmount  (token-leg intent; 0 for message-only)
   [52..]    bytes   payload         (the strategy envelope below)
   ```

2. **Strategy envelope** (built by `CrossChainV3Helper.packPayload`): `abi.encode(uint32 msgType, uint64 nonce, bytes body)` — no version field.

   - `msgType` ∈ 1..8 (see table below)
   - `nonce` is the yield-channel nonce — one operation in flight at a time
   - `body` is `abi.encode(...)` of message-specific fields (or empty)

| ID | Type | Direction | Body | Notes |
|---|---|---|---|---|
| 1 | DEPOSIT | M→R | empty | tokens carried via adapter |
| 2 | DEPOSIT_ACK | R→M | `(uint256 remoteBalance)` | |
| 3 | WITHDRAW_REQUEST | M→R | `(uint256 amount)` | leg 1 |
| 4 | WITHDRAW_REQUEST_ACK | R→M | `(uint256 remoteBalance, bool success)` | success=false ⇒ leg-1 NACK (nothing queued) |
| 5 | WITHDRAW_CLAIM | M→R | empty | leg 2 trigger |
| 6 | WITHDRAW_CLAIM_ACK | R→M | `(uint256 remoteBalance, bool success, uint256 amount)` | tokens carried on success |
| 7 | BALANCE_CHECK_REQUEST | M→R | `(uint256 timestamp)` | |
| 8 | BALANCE_CHECK_RESPONSE | R→M | `(uint256 balance, uint256 timestamp)` | |

`remoteBalance` is Remote's `_balance()` — the whole position, denominated in OToken. Because both the OToken and `bridgeAsset` are required to be 18-decimal (asserted in both constructors), the value is directly comparable with Master's local `bridgeAsset` balance with no scaling.

## Withdrawal state-transition table (Remote)

Authoritative summary of the Option-1 withdrawal flow with idempotent claim. Each row is a single intermediate state; the value lives in exactly one slot per row, and `checkBalance` equals the total in every row:

| State | shares value | OToken bal | bridgeAsset bal | queued\* | outstandingRequestId | checkBalance |
|---|---|---|---|---|---|---|
| Idle | X | 0 | 0 | 0 | EMPTY | X |
| Requested (post-leg-1) | X − A | 0 | 0 | A | id (verbatim) | X |
| Claimed (post-`claimRemoteWithdrawal`) | X − A | 0 | A | 0 | EMPTY | X |
| Bridging-out (post-leg-2 send) | X − A | 0 | 0 | 0 | EMPTY | X − A |
| Completed | X − A | 0 | 0 | 0 | EMPTY | X − A |

Failure branches (revert-free handlers; value preserved, recoverable):

| State | shares value | OToken bal | bridgeAsset bal | queued\* | outstandingRequestId | checkBalance |
|---|---|---|---|---|---|---|
| Deposit mint-failed | X | 0 | D (idle) | 0 | EMPTY | X + D |
| Unwrap-ok / queue-fail (leg-1 NACK) | X − A | A (idle) | 0 | 0 | EMPTY | X |

The idle `D` / `A` are re-wrapped into wOETH by the operator `retryDeposit()`; the leg-1 NACK also clears Master's `pendingWithdrawalAmount`.

`EMPTY` = `REQUEST_ID_EMPTY` (`type(uint256).max`). The vault's `requestId` is stored verbatim, so the sentinel is `type(uint256).max` rather than `0` — that way a genuine `requestId` of `0` (the first withdrawal against a fresh vault) is unambiguous.

\* `queued` is derived, not a stored slot: `outstandingRequestId != REQUEST_ID_EMPTY ? outstandingRequestAmount : 0`.

## Authorisation surface

- **Governor**: sets adapters, operator, bridge configs, sweeps stuck tokens, upgrades.
- **Operator**: triggers permissioned yield-channel round-trips (`requestBalanceCheck`,
  `triggerClaim`). Can be a multisig or automation EOA.
- **Vault**: drives `deposit` / `withdraw` on Master (no user-facing redemption against this strategy in normal ops).
- **Receiver adapter**: the only address allowed to call `receiveMessage` on the strategy.
- **Anyone**: `claimRemoteWithdrawal` (idempotent), `processStoredMessage` (split-delivery finaliser).

## Adapter knobs

All adapter caps and modes are governor-settable post-deploy. See [`FLOWS.md`](./FLOWS.md#7-adapter-knobs-reference) for the full table; high points:

- `maxTransferAmount` (all adapters) — per-tx token cap. `0` = unlimited. Master reads it off its **own local** adapters via `IBridgeAdapter.maxTransferAmount()` to size sweep-style requests: the outbound adapter for `depositAll`, and the inbound adapter for `withdrawAll` (the local mirror of the same lane, since Master cannot query across chains).
- `minTransferAmount` (all adapters) — dust floor.
- Per-lane `ChainConfig` — remote chain selector, peer adapter address, and the transport-specific gas limit.

Bridge fees are paid from a native-token pool held by the strategy and funded by the operator. There is no user-funded send path: `_send` quotes the adapter and requires `address(this).balance >= fee`. Overpayment is not refunded — it stays in the pool.

## Tests

```
test/strategies/crosschainV3/
  _helpers.js                          — shared envelope/payload encoders and MSG constants
  crosschain-v3-helper.js              — envelope codec
  master-v3.js / remote-v3.js          — per-side deposit / init / dispatch
  master-remote-pair.js                — paired loopback via MockBridgeAdapter
  withdrawal.js                        — full withdrawal cycle (happy / NACK / idempotent / bridge-fee tolerance)
  balance-check.js                     — operator-driven balance-check rounds
  failure-recovery.js                  — stuck-nonce and desync recovery paths
  fee-path.js                          — adapter fee plumbing (pool funding, refund-stays semantics)
  transfer-caps.js                     — adapter max/min, Master clamp via adapter views
  split-inbound-adapter.js             — SuperbridgeAdapter pending-slot lifecycle
  *.fork-test.js                       — base / mainnet fork tests (run via the fork-test.sh harness)
```

Run the unit suite (the fork-test files skip when `FORK` is not set in the env, so the glob is safe to run as-is):

```
pnpm hardhat test test/strategies/crosschainV3/*.js
```

For the fork tests, set `FORK=true` and the appropriate `FORK_NETWORK_NAME` (`base`, `mainnet`, etc.) via the standard `fork-test.sh` harness:

```
FORK_NETWORK_NAME=mainnet pnpm test:fork test/strategies/crosschainV3/withdrawal.mainnet.fork-test.js
```

Current total: **76 unit tests** + the per-network `*.fork-test.js` files.

> These Hardhat suites are being ported to Foundry (`tests/unit`, `tests/fork`, `tests/smoke`) and will be deleted once the ports land.

## Operational runbook

Production deploy scripts live at `deploy/base/100-104_*` and `deploy/mainnet/210-211_*`. They deploy both the strategy proxies and the adapter proxies via CreateX/CREATE2 (deterministic peer-parity addresses), with impls deployed plain on each chain. The contracts are deploy-ready against any chain pair given the right addresses (CCIP routers, OP Stack L1StandardBridge addresses, governance multisigs).

Key cadences (production targets):

- **Balance check**: every ~2 hours on a cron, operator-triggered.
- **OETHb Phase 1 migration**: 9 × `bridgeToRemote(1000e18)` over ~9 hours respecting CCIP rate limits. No deposits/withdrawals on the new pair during this window.

**Sequencing constraint:** Base script `102` bakes the mainnet Remote address into an immutable, and `bridgeToRemote` CCIP-ships wOETH there. Mainnet `210` + `211` must execute **before** the first `bridgeToRemote` call, or funds land at an address with no code. No script can enforce this.

## Open items for follow-up

These require real on-chain configuration and were intentionally not authored as part of the protocol code.

| # | Item | Status |
|---|---|---|
| 1 | **Foundry migration** — port the deploy scripts to `scripts/deploy/{base,mainnet}/` and the test suites to `tests/{unit,fork,smoke}/`, then delete the Hardhat equivalents. | In progress |
| 2 | **`requestBalanceCheck` automation** — no Talos action exists for the ~2h Base cadence. Because Foundry deploys write only `build/deployments-8453.json` (never `deployments/base/<Name>.json` or `utils/addresses.js`, which Talos reads), whoever writes it must hand-create the deployment entry or pin the address. | Pending |
| 3 | **Governance proposal 1 (deploy + wire)** — proposals to deploy and wire the Master/Remote pair and upgrade the old `BridgedWOETHStrategy`. | Pending |
| 4 | **Governance proposal 2 (post-migration cleanup)** — remove the old `BridgedWOETHStrategy` from the vault after Phase 1 migration completes (`deploy/base/104`, currently gated by `forceSkip`). | Pending |
| 5 | **Retire `otokenOethbUpdateWoethPrice`** — once `104` removes the old strategy from the vault, its oracle price no longer feeds anything. | Follow-up |
| 6 | **Operator runbook** — formal cadence + failure-mode runbook (balance-check ~2h, what to do on a stuck nonce); cadences exist in inline comments but there is no operator-facing doc. | Pending |
