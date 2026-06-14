# OUSD V3 — Bridge-Agnostic Cross-Chain Strategy

This directory implements the V3 cross-chain strategy pair (Master + Remote) and the bridge-agnostic adapter layer they speak to. Two workstreams share the code:

- **OUSD V3:** OUSD across multiple L2s with native cross-chain bridging, yield generated on Ethereum and reported to each L2 via a yield-channel round-trip.
- **OETHb Phase 1:** Migration of 8.7k wOETH from the existing oracle-priced `BridgedWOETHStrategy` on Base into a new Master/Remote pair built on this abstraction.

**For narrative walkthroughs of each flow (deposit, withdraw, balance check, bridge in/out, settlement) with sequence diagrams, see [`FLOWS.md`](./FLOWS.md).** This README is the reference: file map, message envelope, state-transition table, authorisation surface, adapter knobs.

## File map

```
contracts/interfaces/crosschainV3/
  IBridgeAdapter.sol         — strategies talk through this for outbound sends + quoteFee + maxTransferAmount
  IBridgeReceiver.sol        — strategies implement `receiveMessage` for inbound delivery
  ISplitInboundAdapter.sol   — split-delivery adapters expose pending-slot lifecycle

contracts/strategies/crosschainV3/
  CrossChainV3Helper.sol           — strategy envelope `abi.encode(msgType, nonce, body)` + per-msgType codec
  AbstractCrossChainV3Strategy.sol — adapter wiring, yield-nonce machinery, inbound dispatch,
                                     single outbound send helper (_send, parameterised by userFunded)
  AbstractWOTokenStrategy.sol      — wOToken pair base: bridge-channel state + generic bridge mechanics,
                                     `bridgeOTokenToPeer`, replay protection, signed bridgeAdjustment,
                                     onlyOperatorGovernorOrStrategist modifier, side-specific hooks
  MasterWOTokenStrategy.sol        — vault-facing leg: yield-channel ACK handlers + operator entrypoints,
                                     implements 4 hooks (burn / mint OToken via vault)
  RemoteWOTokenStrategy.sol        — yield-side leg: 2-step bridgeAsset↔OToken↔wOToken pipeline,
                                     implements 4 hooks (wrap / unwrap OToken via 4626)

contracts/strategies/crosschainV3/adapters/
  AbstractAdapter.sol     — shared base: multi-tenant whitelist, per-lane config,
                            envelope wrap/unwrap (52-byte header: 20-byte sender + 32-byte
                            intendedAmount), `_validateInbound`, `_deliver`, transfer caps
  CCTPAdapter.sol         — Circle CCTP V2: manual burn-body parse in `relay()` (auth amount/fee/hookData);
                            pure messages dispatch via `handleReceiveFinalizedMessage` hook.
                            Hard 10M USDC `MAX_TRANSFER_AMOUNT` constant; configurable min + threshold.
  CCIPAdapter.sol         — Chainlink CCIP atomic token + message
  SuperbridgeAdapter.sol  — split delivery: OP Stack L1StandardBridge for the canonical ETH leg + CCIP
                            for the message. Token-bearing sends only on the L1 side; L2 side runs as
                            inbound only (canonical ETH wrapped to WETH via `receive()`).

contracts/strategies/crosschainV3/libraries/
  CCTPMessageHelper.sol   — CCTP V2 wire-format decoder: transport header + burn-message body
  CCIPMessageBuilder.sol  — shared CCIP `Client.EVM2AnyMessage` construction
  NativeFeeHelper.sol     — shared native-fee consumption helper

contracts/proxies/create2/
  CrossChainStrategyProxy.sol — Master/Remote strategy proxy (CREATE3-deployable for peer parity)
  BridgeAdapterProxy.sol      — Adapter proxy (CREATE3-deployable for peer parity)

contracts/strategies/
  BridgedWOETHMigrationStrategy.sol — Phase 1 upgrade impl for the existing Base proxy

contracts/mocks/crosschainV3/
  MockBridgeAdapter, MockBridgeCallTarget, MockBridgeReceiver, MockCCIPRouter,
  MockCCTPRelayTransmitter, MockCrossChainV3HelperHarness, MockEthOTokenVault,
  MockMintableBurnableOToken, MockOTokenVault
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

   - `msgType` ∈ 1..12 (see table below)
   - `nonce` is the yield-channel nonce for yield-channel messages, 0 for bridge-channel messages
   - `body` is `abi.encode(...)` of message-specific fields (or empty)

| ID | Type | Channel | Direction | Body | Notes |
|---|---|---|---|---|---|
| 1 | DEPOSIT | Yield | M→R | empty | tokens carried via adapter |
| 2 | DEPOSIT_ACK | Yield | R→M | `(uint256 newBalance)` | |
| 3 | WITHDRAW_REQUEST | Yield | M→R | `(uint256 amount)` | leg 1 |
| 4 | WITHDRAW_REQUEST_ACK | Yield | R→M | `(uint256 newBalance)` | requestId stays on Remote |
| 5 | WITHDRAW_CLAIM | Yield | M→R | empty | leg 2 trigger |
| 6 | WITHDRAW_CLAIM_ACK | Yield | R→M | `(uint256 newBalance, bool success, uint256 amount)` | tokens carried on success |
| 7 | BALANCE_CHECK_REQUEST | Yield | M→R | `(uint256 timestamp)` | |
| 8 | BALANCE_CHECK_RESPONSE | Yield | R→M | `(uint256 balance, uint256 timestamp)` | |
| 9 | SETTLE_BRIDGE_ACCOUNTING | Yield | M→R | empty | clears bridgeAdjustment both sides |
| 10 | SETTLE_BRIDGE_ACCOUNTING_ACK | Yield | R→M | `(uint256 newBalance)` | |
| 11 | BRIDGE_IN | Bridge | R→M | `BridgeUserPayload` | nonceless, mint on destination |
| 12 | BRIDGE_OUT | Bridge | M→R | `BridgeUserPayload` | nonceless, release on destination |

`BridgeUserPayload` = `(bytes32 bridgeId, uint256 amount, address recipient, bytes callData, uint32 callGasLimit)`.

## Withdrawal state-transition table (Remote)

Authoritative summary of the Option-1 withdrawal flow with idempotent claim. Each row is a single intermediate state; the value lives in exactly one slot per row, and `checkBalance` equals the total in every row:

| State | shares value | oToken bal | bridgeAsset bal | queued\* | outstandingRequestId | checkBalance |
|---|---|---|---|---|---|---|
| Idle | X | 0 | 0 | 0 | 0 | X |
| Requested (post-leg-1) | X − A | 0 | 0 | A | nonzero | X |
| Claimed (post-`claimRemoteWithdrawal`) | X − A | 0 | A | 0 | 0 | X |
| Bridging-out (post-leg-2 send) | X − A | 0 | 0 | 0 | 0 | X − A |
| Completed | X − A | 0 | 0 | 0 | 0 | X − A |

\* `queued` is derived, not a stored slot: `outstandingRequestId != 0 ? outstandingRequestAmount : 0`.

## Authorisation surface

- **Governor**: sets adapters, operator, bridge configs, sweeps stuck tokens, upgrades.
- **Operator**: triggers permissioned yield-channel round-trips (`requestBalanceCheck`,
  `requestSettlement`, `triggerClaim`). Can be a multisig or automation EOA.
- **Vault**: drives `deposit` / `withdraw` on Master (no user-facing redemption against this strategy in normal ops).
- **Receiver adapter**: the only address allowed to call `receiveMessage` on the strategy.
- **Anyone**: `claimRemoteWithdrawal` (idempotent), `processStoredMessage` (split-delivery finaliser).

## Bridge-channel composability (`callData`)

Both Master and Remote expose a user-facing `bridgeOTokenToPeer(amount, recipient, callData, callGasLimit)` payable function. On the destination, after the strategy mints/releases tokens to `recipient`, an optional `recipient.call{value: 0, gas: callGasLimit}(callData)` runs. Guardrails:

- Tokens are delivered first (CEI). Reverting calldata never strands funds.
- `callGasLimit ≤ MAX_BRIDGE_CALL_GAS` (500_000).
- No `msg.value` ever forwarded.
- `nonReentrant` on the inbound entry blocks re-entering Master/Remote during the call.
- Empty calldata = no call.

## Adapter knobs

All adapter caps and modes are governor-settable post-deploy. See [`FLOWS.md`](./FLOWS.md#9-adapter-knobs-reference) for the full table; high points:

- `maxTransferAmount` (all adapters) — per-tx token cap. `0` = unlimited. Strategies on the peer chain read this as "max I can deliver in one tx" via `IBridgeAdapter.maxTransferAmount()` to size their withdrawAll-style requests.
- `MAX_TRANSFER_AMOUNT` (CCTPAdapter) — hard 10M USDC constant (CCTP V2 protocol cap; never higher than this).
- `minTransferAmount` (CCTPAdapter) — dust floor.
- `minFinalityThreshold` (CCTPAdapter) — 1000–1999 = fast finality (non-zero token-side fee), 2000 = finalised. NO declaration default; governor MUST call `setMinFinalityThreshold` post-deploy or sends revert with `"CCTP: threshold not set"`.
- `operator` (CCTPAdapter) — the single address allowed to call `relay(message, attestation)`.

`CCTPAdapter` inbound dispatch has two paths:

- **Burn messages** (sourced from `TokenMessenger.depositForBurnWithHook`) — `relay()` manually parses the burn body (`CCTPMessageHelper.decodeBurnBody`) for authoritative `amount` / `feeExecuted` / `hookData`, calls `messageTransmitter.receiveMessage` to credit USDC, then dispatches `_deliver` with `amount - feeExecuted`. The `handleReceiveFinalizedMessage` hook is NOT used for token-bearing messages.
- **Pure messages** (sourced from `MessageTransmitter.sendMessage`) — `relay()` calls `messageTransmitter.receiveMessage` which fires the hook callback. The hook is restricted to `intendedAmount == 0` and reverts if a token leg sneaks through.

## Tests

```
test/strategies/crosschainV3/
  crosschain-v3-helper.js              — envelope codec
  master-v3.js / remote-v3.js          — per-side deposit / bridge / init / dispatch
  master-remote-pair.js                — paired loopback (deposit, BRIDGE_IN/OUT)
  withdrawal.js                        — full withdrawal cycle (happy / NACK / idempotent / fast-finality)
  settlement-balance-check.js          — operator-driven rounds, yield-only baseline
  bridge-fee.js                        — bridgeFeeBps burn-full / deliver-net mechanics
  fee-path.js                          — adapter fee plumbing (msg.value, pool, refund-stays semantics)
  transfer-caps.js                     — adapter MAX/min, Master clamp via adapter views
  cctp-relay.js                        — CCTPAdapter pure-message relay path + auth / threshold
  cctp-burn-relay.js                   — CCTPAdapter burn-message manual-parse path, donation isolation
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

Current total: **111 unit tests** + the per-network `*.fork-test.js` files.

## Operational runbook (mainnet / testnet)

Deploy scripts (testnet at `deploy/sepolia/*` + `deploy/baseSepolia/*`, production at `deploy/base/100-104_*` + `deploy/mainnet/210-211_*`) deploy both the strategy proxies and the adapter proxies via CREATE3 (deterministic peer-parity addresses) with impls deployed plain on each chain. The contracts are deploy-ready against any chain pair given the right addresses (CCIP routers, CCTP TokenMessengers, OP Stack L1StandardBridge addresses, governance multisigs).

Key cadences (production targets):

- **Balance check**: every ~2 hours on a cron, operator-triggered.
- **Settlement**: every 6–12 hours, operator-triggered. Higher cadence on testnet (1h) for surfacing issues.
- **OETHb Phase 1 migration**: 9 × `bridgeToRemote(1000e18)` over ~9 hours respecting CCIP rate limits. No deposits/withdrawals on the new pair during this window.

## Open items for follow-up

These were intentionally not authored as part of the protocol code because they require real on-chain configuration. Items completed in earlier sessions (transfer-amount caps on adapters, FLOWS.md walkthrough doc, CCTPAdapter proxy-safe `minFinalityThreshold` + fast-finality inbound handler, `Master.depositAll/withdrawAll` clamp by adapter caps) are no longer on this list.

| # | Item | Status |
|---|---|---|
| 1 | **Testnet registration (Sepolia + Base Sepolia)** — full network registration + mock vault/token + deploy scripts wiring `MasterWOTokenStrategy`/`RemoteWOTokenStrategy` + `CCIPAdapter` + `SuperbridgeAdapter` (all behind `BridgeAdapterProxy` via CREATE3 for peer parity). OETHb topology only — no CCTP wiring in this scope. | Done |
| 2 | **CCTP testnet path** — `CCTPAdapter` on Sepolia/Base Sepolia + Iris-sandbox attestation relayer setup for OUSD V3 testnet rehearsal. | Follow-up |
| 3 | **OETHb Phase 1 base fork test** — `oethb-phase1-migration.base.fork-test.js` driving 9 × `bridgeToRemote(1000e18)` against a Base fork, validating CCIP rate-limit pacing. | Pending |
| 4 | **Mainnet + Base production deploy scripts** — `deploy/mainnet/200-203_*` and `deploy/base/100-105_*` to wire Master/Remote pair + adapters on production. | Pending |
| 5 | **Governance proposal 1 (deploy + wire)** — mainnet proposal to deploy + wire Master/Remote and upgrade old `BridgedWOETHStrategy`. | Pending |
| 6 | **Governance proposal 2 (post-migration cleanup)** — remove old `BridgedWOETHStrategy` from vault + mint whitelist after Phase 1 migration completes. | Pending |
| 7 | **Operator runbook** — formal cadence + failure-mode runbook (balance-check ~2h, settlement 6–12h, what to do on stuck nonce, etc.); cadences exist in inline comments but no operator-facing doc. | Pending |
| 8 | **OUSD V3 spoke deploys** — once OETHb Phase 1 stabilises, deploy OUSD V3 Master/Remote pairs per spoke chain (Base, HyperEVM, etc.). | Future |
