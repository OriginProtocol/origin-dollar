# OUSD V3 Cross-Chain Strategy — Design Notes

This document captures the **why** behind the V3 cross-chain strategy: what
this work delivers, how the pieces fit together, the non-obvious design
decisions and their rationale, and the operational caveats an integrator or
on-call engineer should know.

For the **what** (file map, message envelope, state-transition table,
adapter knobs), see [`README.md`](./README.md).
For end-to-end flow walkthroughs with sequence diagrams, see
[`FLOWS.md`](./FLOWS.md).

---

## 1. Scope of this work

This PR introduces the bridge-agnostic cross-chain strategy pair and the
adapter family that drives it. Concretely:

- **`MasterWOTokenStrategy`** + **`RemoteWOTokenStrategy`** (with abstract bases
  `AbstractCrossChainV3Strategy` and `AbstractWOTokenStrategy`). Two channels:
  a nonce-gated **yield channel** (deposit / withdraw / balance check /
  settlement) and a nonceless **bridge channel** (BRIDGE_IN / BRIDGE_OUT with
  user-driven `bridgeOTokenToPeer`).
- **Adapter family** on a shared `AbstractAdapter` base: `CCIPAdapter`,
  `CCTPAdapter`, `SuperbridgeAdapter`. Each carries a multi-tenant whitelist,
  per-lane config, and a governor-settable `maxTransferAmount` cap.
- **CREATE3 proxies** (`BridgeAdapterProxy`, `CrossChainStrategyProxy`) so the
  proxy address is byte-identical on paired chains. Adapter impls are
  deployed plain — only the proxy address matters for the
  `transportSender == address(this)` peer-parity check.
- **CCTPAdapter.relay()** manually parses the CCTP V2 burn body via
  `CCTPMessageHelper.decodeBurnBody`, dispatches the strategy directly with
  authoritative `amount`, `feeExecuted`, and `hookData` — works on both V2.0
  and V2.1 chains (no dependency on the V2.1-only auto-callback).
- **Transfer caps** at every adapter (`maxTransferAmount`), plus
  `MAX_TRANSFER_AMOUNT = 10M USDC` constant on `CCTPAdapter` (Circle's V2
  per-burn ceiling).
- **`Master.depositAll` / `withdrawAll`** clamp by the relevant adapter's
  `maxTransferAmount` view so a vault sweep larger than the bridge per-tx
  limit becomes a partial fill rather than reverting.
- **Fast-finality tolerance.** `Master._processWithdrawClaimAck` now accepts
  `amount <= ackAmount` so CCTP V2 fast-finality fee deductions don't reject
  legitimate withdrawals.
- **Testnet harness** (Sepolia ⇄ Base Sepolia): hardhat config, helpers,
  addresses, scripts, mock-vault deploys. End-to-end deploy-able for
  rehearsal.
- **Production OETHb deploys** at `deploy/base/100-104_*` and
  `deploy/mainnet/210-211_*`. Master/Remote proxies via CREATE3; adapters
  behind `BridgeAdapterProxy` (also CREATE3) for paired-chain address
  matching.
- **Docs** — `FLOWS.md` (sequence diagrams), `README.md` refresh,
  `.claude/skills/add-network/SKILL.md`.
- **116 unit tests** + mainnet/Base fork tests.

---

## 2. Architecture in one page

Two strategy contracts, one bridge-agnostic adapter API:

```
┌─────────────────────────┐                    ┌─────────────────────────┐
│   chain A (vault side)  │                    │   chain B (yield side)  │
│                         │                    │                         │
│   OToken vault          │                    │   OToken vault          │
│        │                │                    │        │                │
│        ▼                │                    │        ▼                │
│   MasterWOTokenStrategy │  ◀── yield ch ──▶  │  RemoteWOTokenStrategy  │
│        │   ▲            │  ◀── bridge ch ─▶  │       │   ▲             │
│        ▼   │            │                    │       ▼   │             │
│  outbound  inbound      │                    │  outbound inbound       │
│  adapter   adapter      │                    │  adapter  adapter       │
│   (proxy)  (proxy)      │                    │   (proxy)  (proxy)      │
└─────────────────────────┘                    └─────────────────────────┘
                       ▲                              ▲
                       └──── byte-identical via CREATE3
                            (peer-parity precondition)
```

**Roles:**
- **Master** lives on the chain hosting the rebasing OToken vault. It's the
  strategy that vault registers. Vault calls `deposit` / `withdraw`. Master
  doesn't hold yield-earning shares; it tracks `remoteStrategyBalance` (last
  known Remote balance) + a signed `bridgeAdjustment` (unsettled bridge
  channel delta).
- **Remote** lives on the chain hosting the wOToken (ERC-4626 yield wrapper).
  Custodian for shares held on behalf of the L2 vault. Runs the
  bridgeAsset ↔ OToken ↔ wOToken pipeline using the local OToken vault for
  mint/redeem.

**Two channels:**
- **Yield channel.** DEPOSIT / WITHDRAW_REQUEST / WITHDRAW_CLAIM /
  BALANCE_CHECK / SETTLE and their ACKs. Each message has a yield nonce.
  Master gates concurrent yield ops via `pendingDepositAmount == 0 &&
  pendingWithdrawalAmount == 0`. The balance check is the only non-blocking
  yield op (nonce-echo, no advance).
- **Bridge channel.** BRIDGE_IN / BRIDGE_OUT. Nonceless. User-driven via
  `bridgeOTokenToPeer`. Replay protection via `consumedBridgeIds[bridgeId]`.
  Fire-and-forget (no ack). `bridgeAdjustment` accumulates per-op deltas
  until settlement clears them.

**Three adapters, one interface.** The strategy talks to adapters via
`IBridgeAdapter` (outbound) + `IBridgeReceiver` (inbound). Each adapter
encapsulates one bridge transport:
- **CCIPAdapter** — Chainlink CCIP, atomic token + message.
- **CCTPAdapter** — Circle CCTP V2. Burn messages parsed manually in `relay()`;
  pure messages go through the V2 hook callback.
- **SuperbridgeAdapter** — split delivery. CCIP for messages; OP Stack
  L1StandardBridge for canonical ETH leg. Pending-slot lifecycle in
  `pendingFor` mapping.

See [`FLOWS.md`](./FLOWS.md) for sequence diagrams of each flow.

---

## 3. Design decisions & rationale

### 3.1 Two channels (yield-gated + bridge-nonceless)

**Decision.** Strategy operations split into two distinct channels with
different ordering semantics.

**Why.** Yield ops change protocol-level accounting (`remoteStrategyBalance`,
`pendingDepositAmount`, `pendingWithdrawalAmount`) so they must be serialised — out-of-order
delivery would corrupt state. User-driven bridge ops are independent (each
has its own `bridgeId`) and can run concurrently; gating them on a single
nonce would create a DOS vector (one user could front-run others by
spamming bridge ops). Splitting the channels lets the operator handle the
two cadences independently.

**How.**
- Yield channel: `_acceptYieldNonce` + `_markYieldNonceProcessed` enforce
  monotonic advance. Sender gate `pendingDepositAmount == 0 &&
  pendingWithdrawalAmount == 0` blocks concurrent yield sends.
- Bridge channel: no nonce, no global gate. Replay protection is
  per-message via `consumedBridgeIds[bridgeId]` on the destination side.

### 3.2 Non-blocking balance check (nonce-echo + three guards on response)

**Decision.** `requestBalanceCheck` doesn't advance the yield nonce; it
echoes the current value. The response is accepted only when three
independent guards pass.

**Why.** Balance check is an oracle-update operation that runs on a cadence
(every ~2h). Blocking it on yield-nonce serialisation would force the
operator to choose between fresh balance reads and other yield ops in
flight. Instead: nonce-echo means a balance check can be in flight
concurrently with a deposit/withdraw without locking either out.

The three guards on the response (`MasterWOTokenStrategy._processBalanceCheckResponse`):
1. `isYieldOpInFlight()` — if a deposit/withdraw started after the balance
   check fired, ignore the now-stale reading.
2. `nonce == lastYieldNonce` — if the nonce advanced between request and
   response, ignore (a yield op landed in the middle).
3. `respTimestamp > lastBalanceCheckTimestamp` — out-of-order CCIP delivery
   of two balance checks in the same nonce window: keep the latest only.

**Trade-off.** Cost: slight extra storage (`lastBalanceCheckTimestamp`).
Benefit: balance check never blocks the yield channel, and operationally is
the simplest cadence to automate (run on a cron, ignore failures).

### 3.3 Manual CCTP V2 burn-body parsing in `relay()`

**Decision.** `CCTPAdapter.relay()` decodes the inner burn body itself
(`CCTPMessageHelper.decodeBurnBody`) and dispatches via `_deliver` directly,
rather than relying on CCTP V2.1's auto-callback to `mintRecipient`.

**Why.** Not all chains run CCTP V2.1. The V2.0 deployment does not auto-call
the `mintRecipient` after a burn-with-hook; the message is delivered to the
TokenMessenger which then needs an explicit relay. The older
`AbstractCCTPIntegrator` already used manual parsing for the same reason.
By parsing the burn body ourselves, the V3 adapter works identically on
V2.0 and V2.1 deployments — no chain-specific code paths.

**How.**
- `CCTPMessageHelper.decodeBurnBody` extracts `(burnToken, amount, msgSender,
  feeExecuted, hookData)` using the CCTP V2 wire-format offsets.
- `relay()` distinguishes burn vs pure messages by `transportSender ==
  tokenMessenger` and routes accordingly.
- Pure messages still go through `handleReceiveFinalizedMessage` /
  `handleReceiveUnfinalizedMessage` hooks. Those handlers now revert if
  `intendedAmount != 0` — a token-bearing message arriving through the
  pure-message path is a design violation.

**Trade-off.** Slight bytecode bloat (~150 lines of parsing logic). Worth it
for the V2.0/V2.1 portability guarantee.

### 3.4 `amount <= ackAmount` claim tolerance (fast-finality fee)

**Decision.** `Master._processWithdrawClaimAck` accepts when
`amount <= ackAmount` (not strict equality). The shortfall is the protocol
fee deducted on the destination side.

**Why.** CCTP V2 fast-finality charges a per-burn fee taken from the burned
amount. The recipient mints `amount - feeExecuted`. If Master enforced
`amount == ackAmount`, fast-finality withdrawals would always revert.

The shortfall isn't lost — it's yield drag absorbed via the next
BALANCE_CHECK (which refreshes `remoteStrategyBalance` to the new
yield-only baseline). Master ignores `feePaid` entirely; the older
`CrossChainMasterStrategy._onTokenReceived` follows the same pattern (the
`feeExecuted` argument is marked `solhint-disable-next-line
no-unused-vars`).

**No lower bound.** Master doesn't enforce `amount >= ackAmount * (1 - X%)`
because the older design didn't either, and adding a tolerance threshold
would just create another knob to tune (and revert path to handle). If
Remote ships much less than requested, it shows up as yield drag on the
next balance check — operationally visible.

### 3.5 CREATE3 peer parity for both proxies and adapter proxies

**Decision.** Master, Remote, and every adapter live behind a CREATE3-deployed
proxy. Impl contracts are deployed plain (chain-specific addresses are fine).
The proxy address matches on both chains.

**Why.** The `transportSender == address(this)` check inside `_validateInbound`
requires the source-side adapter address to equal the destination-side
adapter address. The strategy `_deliver` similarly dispatches to
`envelopeSender` (the source strategy), which must resolve to the
destination strategy on the receiving chain. Both checks need byte-identical
addresses across chains. CREATE3 gives that.

**Why proxy + plain impl, not CREATE3 the impl directly.** Impls have
chain-specific constructor args (CCIPRouter, L1StandardBridge, USDC,
WETH, etc.) — different bytecode → different CREATE3 addresses. The proxy
has a uniform constructor (just `address governor`) so its CREATE3 address
is deterministic. The proxy delegates to the chain-specific impl.

**See:** `BridgeAdapterProxy.sol`, `CrossChainStrategyProxy.sol`,
`deployBridgeAdapterProxy` helper in `contracts/utils/createXProxyHelper.js`.

### 3.6 Signed `bridgeAdjustment` + settlement snapshot-subtract

**Decision.** `bridgeAdjustment` is `int256`. Both sides accumulate signed
deltas per bridge op (BRIDGE_OUT decreases, BRIDGE_IN increases). Settlement
captures `settlementSnapshot = bridgeAdjustment` at request time on Master
and snapshot-subtracts on both sides (NOT zero).

**Why signed.** BRIDGE_IN and BRIDGE_OUT can interleave; the net delta can
swing in either direction. Tracking sign avoids two separate counters
(in / out) plus the bookkeeping to net them.

**Why snapshot-subtract on settlement (not `= 0`).** If a new BRIDGE_OUT
happens between `requestSettlement` and the ack, that new delta should
persist after settlement. `bridgeAdjustment -= settlementSnapshot` preserves
it; `bridgeAdjustment = 0` would erase it. The yield-only baseline in the
ack response handles the cross-side ordering: regardless of whether the new
op lands before or after the SETTLE message on Remote, both sides converge
to a consistent `(remoteStrategyBalance + bridgeAdjustment)` total.

**Why both sides need it.** Master's `checkBalance` adds `bridgeAdjustment` to
`remoteStrategyBalance` to reconstruct true backing. Remote's
`_viewCheckBalance - bridgeAdjustment` strips bridge-channel effects to
report a yield-only baseline. Both sides must have synchronised
`bridgeAdjustment` values (in magnitude) for the math to work.

### 3.7 `pendingWithdrawalAmount` not in `checkBalance`

**Decision.** `Master.checkBalance` includes `bridgeAsset.balanceOf(this)` +
`pendingDepositAmount` + `remoteStrategyBalance` + `bridgeAdjustment`, but NOT
`pendingWithdrawalAmount`.

**Why.** During an in-flight withdrawal, the value is still on Remote (in the
OToken vault's withdrawal queue) and reflected in `remoteStrategyBalance`.
Including it as `pendingWithdrawalAmount` too would double-count.
`pendingWithdrawalAmount` is purely a gate for "is there an in-flight
withdraw," not a balance component.

**Trade-off.** If Remote's outbound ack is permanently lost (transport
failure),`pendingWithdrawalAmount` stays set forever, blocking future
withdrawals. Mitigation: governor swaps `outboundAdapter` /
`inboundAdapter` to a new adapter and re-delivers the ack via the new
adapter. Not a code change — operational only.

### 3.8 Fee channel split — user-paid vs operator-pool, no refunds

**Decision.** A single `_send(token, amount, msgType, nonce, body, userFunded)`
helper with two funding modes selected by `userFunded`:
- **User-paid** (`userFunded = true`): the caller supplies `msg.value` ≥ `fee`.
  Used by `bridgeOTokenToPeer`. Any excess `msg.value` stays in the adapter's
  balance — no refund.
- **Op-pool** (`userFunded = false`): the fee comes from `address(this).balance`.
  Used by the yield channel (deposit / withdraw / balance check / settle). The
  operator pre-funds the pool; any inbound refunds also accumulate there.

**Why split.** User-driven bridge ops should pay their own way (no operator
subsidy of arbitrary user bridges). Yield ops are operator-driven and
predictable; pre-funding the pool is simpler than threading `msg.value`
through every yield call.

**Why no refunds.** Refunds add code (per-call) for a problem the caller can
solve up front (call `quoteFee` first). Excess `msg.value` becomes adapter
balance, recoverable via `transferToken(address(0), amount)` (governor).
Trade-off: small UX rough edge for users who overpay. Mitigation: the front-end
quotes the fee.

### 3.9 USDT is not in scope → standard `safeApprove(spender, amount)`

**Decision.** The codebase uses `safeApprove(spender, amount)` directly,
without zeroing first.

**Why.** OpenZeppelin's `safeApprove` reverts on a non-zero → non-zero
allowance transition (the USDT quirk). The tokens we actually bridge (USDC,
WETH, plus the OToken family) don't have this quirk. The "defensive
zero-first" pattern adds code surface and gas for a problem we don't have.

**If USDT ever enters scope** (it won't, but hypothetically): every
per-operation `safeApprove` would need the zero-first dance. Today it's
a non-issue.

### 3.10 `checkBalance` must never revert and never return negative

**Decision.** `Master.checkBalance` clamps to 0 when the signed total goes
negative; the function is `view` and has no revert paths.

**Why.** The vault treats `checkBalance` as an oracle. A reverting balance
read cascades into broken rebases and stuck deposits / redemptions. Even
a hypothetical negative `total` (which shouldn't happen because BRIDGE_OUT
preflights against available liquidity) must be reported as `0`, not as a
revert.

```solidity
int256 total = int256(...) + bridgeAdjustment;
return total > 0 ? uint256(total) : 0;
```

Remote's external `checkBalance` is likewise total: it scales the
OToken-denominated `_viewCheckBalance` down to bridgeAsset units (see 3.11) and
never reverts. The internal `_yieldOnlyBaseline` (`_viewCheckBalance -
bridgeAdjustment`, used only for the R→M yield reports — never for
`checkBalance`) DELIBERATELY reverts if it would go negative: a loud halt is
safer than shipping a wrong value on the balance-bearing path, and a negative
baseline shouldn't arise under normal ops (each BRIDGE_IN/OUT moves
`_viewCheckBalance` and `bridgeAdjustment` by the same amount). Governor recovers
via an implementation upgrade if a slashing / negative rebase ever trips it.

---

### 3.11 Decimal domains — OToken (18dp) internal, bridgeAsset at the vault edge

**Decision.** The strategy keeps two unit domains and scales only at the seams:
- **OToken (18dp):** `remoteStrategyBalance`, `bridgeAdjustment`, the whole OToken
  bridge channel, and Remote's `_viewCheckBalance` / `_yieldOnlyBaseline`. Remote
  reports its yield baseline to Master in **18dp**.
- **bridgeAsset decimals (6dp USDC / 18dp WETH):** `pendingDepositAmount`,
  `pendingWithdrawalAmount`, `outstandingRequestAmount`, the locally-held balance,
  every physical bridge transfer, and the `checkBalance` return value.

`AbstractWOTokenStrategy._toOToken` / `_toAsset` (thin `StableMath.scaleBy`
wrappers over the cached `bridgeAssetDecimals` / `oTokenDecimals` immutables) do
the conversion. Adapters never scale — they move the physical token at native
decimals. For the matched-decimal OETHb deployment (WETH/OETH 18/18) every scale
is the identity, so the deployed config is unaffected.

**Why.** `bridgeAdjustment` is intrinsically an OToken (18dp) quantity; storing it
(or `remoteStrategyBalance`) at 6dp would truncate ~12 digits per bridge op and
drift. Keeping the OToken block at 18dp and scaling down once at the `checkBalance`
read preserves full precision; the vault interface still receives bridgeAsset
decimals like every other strategy. Mirrors `CurveAMOStrategy`.

---

### 3.12 Governor is fully trusted across this subsystem

**Decision / note.** The governor is a fully-trusted role here, on par with the
proxy-upgrade power it already holds:
- `AbstractAdapter.transferToken` can sweep ANY asset off an adapter, including
  bridge tokens that rest there transiently or across blocks (e.g. Superbridge
  split-delivery WETH stranded until `processStoredMessage`). It is intentionally
  NOT guarded by `!supportsAsset` (unlike the strategy base) precisely so it can
  recover in-flight / stranded bridge assets.
- `AbstractCrossChainV3Strategy.transferNative` sweeps the native fee pool.
- Governor sets adapters, operator, lane configs, and upgrades the proxies.

These are expected centralized-trust surfaces, strictly weaker than the upgrade
power, and the only bounded levers (`bridgeFeeBps <= 1000` with `net > 0`; the
per-tx `maxTransferAmount` cap) constrain the operator/economic paths, not the
governor.

### 3.13 We bridge messages + the backing asset, never the OToken or wOToken

**Decision.** No OToken or wOToken ever crosses the bridge. What moves differs
by channel:
- **Yield channel** (operator deposit / withdraw): the strategy bridges the
  **backing asset** (WETH / USDC) plus a message. Remote mints OToken from that
  asset at the local OToken vault and wraps it to wOToken; on withdraw it
  unwraps, redeems to the backing asset, and bridges the asset back.
- **Bridge channel** (user `bridgeOTokenToPeer`): the source **burns** the
  user's OToken and sends a message only (no token transfer); the destination
  **mints** `net = amount - fee` fresh OToken to the recipient.

**Why.** Bridging the rebasing OToken directly would force every chain to track
the other's rebase, and the in-flight value would be ambiguous while a rebase
lands mid-transit. Burning + re-minting sidesteps that: the OToken supply is
authoritative per chain, and value-in-transit is carried as the backing asset
(yield channel) or as an accounting delta (`bridgeAdjustment`, bridge channel).
A side effect — by design — is that a user who bridges does **not** earn the
OToken's appreciation during transit: they receive `net`, and the retained
`fee` plus any in-flight appreciation accrues to the protocol as yield (the
burn-full / deliver-net mechanic; see §3.6 and `FLOWS.md` §6). This is the
intended behaviour, not a loss path.

See the OUSD V3 spec for the OToken-vs-wOToken bridging design decision:
https://app.notion.com/p/originprotocol/OUSD-V3-Spec-33c84d46f53c807c80c2c187e0c6c2df

---

## 4. Caveats & operational concerns

These are NOT bugs — they're things an operator should know.

### 4.1 Production deploy `proposalId` is empty

`deploy/mainnet/210_oethb_v3_remote_proxy.js:14` and `211_oethb_v3_remote_impl.js:27`
both have `proposalId: ""`. Fine for fork simulation; blocks the on-chain
governance executor. **Populate the Snapshot UUID before mainnet.**

### 4.2 OETH-vault Remote registration is undefined

Base side registers Master via `103_oethb_v3_vault_wiring.js` (Master needs
to mint/burn OETHb for the bridge channel). Mainnet side has no equivalent
governance action touching the OETH vault. **Verify with the team:** does
the OETH vault need Remote registered as a strategy? If yes, a follow-up
governance proposal is needed.

### 4.3 CCTP V2.0 vs V2.1 deployment uncertainty

The manual burn-relay in `relay()` works on both V2.0 and V2.1. But
`CCTPAdapter._quoteFee` calls `tokenMessenger.getMinFeeAmount(amount)`,
which is V2.1-only. If a chain has only V2.0 deployed, `quoteFee(amount > 0)`
reverts. Current deploys (OETHb) don't use CCTP at all, so this is a
non-issue. OUSD V3 spoke chains must be on V2.1 — check before deploying.

### 4.4 Lost claim-ack stalls `pendingWithdrawalAmount`

If Remote's outbound adapter goes pathological and a leg-2 ack is
permanently lost, Master's `pendingWithdrawalAmount` stays non-zero,
blocking future withdrawals. **Mitigation:** governor calls
`setOutboundAdapter` (Remote) / `setInboundAdapter` (Master) to swap to a
fresh adapter pair; the new pair can re-deliver the ack. No code change
needed — operational only.

### 4.5 `bridgeAdjustment` unbounded

No protocol-level upper bound on `|bridgeAdjustment|`. Operational mitigation
only: settlement cadence (6-12h target) bounds the magnitude. **Action item:**
formal operator runbook (pending list item #7 in README) should document the
alert threshold and recovery procedure.

### 4.6 9-batch Phase 1 migration pacing

OETHb Phase 1 migrates 8.7k wOETH from the existing `BridgedWOETHStrategy` to
the new Master/Remote pair via 9 × `bridgeToRemote(1000e18)`. **CCIP rate
limits this to ~1000 WETH/hour**, so the migration takes ~9 hours. No
deposits / withdrawals on the new pair during this window — the
`bridgeAdjustment` accumulates and is settled at the end.

### 4.7 Cleanup script (`104`) is gated by `forceSkip`

`deploy/base/104_oethb_v3_remove_old_strategy.js` has `forceSkip: true` so
it never auto-fires. **The operator must manually flip this to `false`**
after the 9-batch migration completes and `BridgedWOETHStrategy.checkBalance`
is at dust.

### 4.8 Adapter `maxTransferAmount` is a per-tx cap, not a per-hour rate

The CCIP lane has a per-hour rate limit on Chainlink's side (~1000 WETH/h
on the OETHb pair). The adapter's `maxTransferAmount` caps each
individual call, not cumulative time-window throughput. The operator must
still pace operations off-chain to respect the rate limit. **Why not a
time-window?** Adds state + complexity for no real protection — Chainlink
enforces the rate limit on its end anyway, so a contract-side mirror
is redundant defense.

### 4.9 No refund on user-paid overpayment

`bridgeOTokenToPeer` accepts any `msg.value >= fee`. Excess stays on the
adapter as donation. **Recovery:** `transferToken(address(0), amount)`
(governor only). UI / front-end should call `quoteFee` first to avoid
donations; if it doesn't, the user loses the difference.

### 4.10 `lastBalanceCheckTimestamp` is per-Master

The timestamp guard on balance-check responses is local state on Master. If
Master is upgraded (impl swap) and the storage layout changes, the timestamp
could be reset to 0, accepting a stale response on the next check. **Mitigation:**
storage layout is preserved across upgrades (the slot is part of
`AbstractCrossChainV3Strategy` with explicit `__gap` reservation). Verify
the storage-layout file before any upgrade.

---

## 5. Pending work

See [`README.md`](./README.md) "Open items for follow-up" for the canonical
pending list. Top of mind for the next PR:

1. Populate production `proposalId` (4.1) — blocks mainnet deploy.
2. Decide OETH-vault Remote registration (4.2).
3. CCTP testnet harness for OUSD V3 (Iris-sandbox attestation relayer).
4. OETHb Phase 1 base fork test driving the 9-batch migration.
5. Governance proposals: deploy + wire (prop 1), post-migration cleanup
   (prop 2).
6. Operator runbook (cadences, failure modes, alert thresholds).
7. OUSD V3 spoke deploys (per spoke chain).

---

## 6. Cross-references

- **[`README.md`](./README.md)** — reference doc: file map, message
  envelope layout, state-transition table, authorisation surface, adapter
  knobs, pending list.
- **[`FLOWS.md`](./FLOWS.md)** — narrative walkthroughs of the five core
  flows (deposit, withdraw, balance check, bridge in/out, settlement) with
  Mermaid sequence diagrams + fee model reference.
- **`.claude/skills/add-network/SKILL.md`** — checklist for adding a new
  network to the repo (reusable for OUSD V3 spoke rollouts).
- **`contracts/utils/createXProxyHelper.js`** — shared
  `deployBridgeAdapterProxy` / `initBridgeAdapterProxy` helpers for testnet
  + production deploys.

---

## 7. Key invariants (one-line summaries)

For an auditor or on-call engineer reviewing the code quickly:

- **Master.checkBalance never reverts and never returns negative.** Clamping
  to 0 on hypothetical negative totals is intentional.
- **Yield ops are serialised on Master.** `pendingDepositAmount == 0 &&
  pendingWithdrawalAmount == 0` must hold before a new yield op fires.
- **Balance check is non-blocking** but acceptance requires all three guards
  (`isYieldOpInFlight()`, nonce match, timestamp monotonic).
- **Bridge channel is replay-protected** per-`bridgeId`. Same `bridgeId`
  delivered twice → second call reverts.
- **Adapter peer parity** (`transportSender == address(this)`) is enforced
  on every inbound. CREATE3 deployment gives byte-identical proxy addresses
  across paired chains.
- **Yield-only baseline** on Remote: `_viewCheckBalance() - bridgeAdjustment`
  strips bridge-channel effects so out-of-order delivery between balance
  check and bridge messages doesn't desync `remoteStrategyBalance` on
  Master.
- **Settlement preserves in-flight bridge ops.** `bridgeAdjustment -=
  settlementSnapshot` (not `= 0`) so a bridge op that landed between
  request and ack survives the settlement round.
- **Pool drains only for op-funded sends.** User-funded sends require
  `msg.value >= fee` explicitly; pool is never tapped for user paths.
- **Master forwards full local bridgeAsset to vault on claim-ack success.**
  Donated bridgeAsset on Master ends up in the vault as "free deposit" —
  intentional (locked policy).
- **Yield-ack handlers only call protocol-controlled contracts.**
  `receiveMessage` is deliberately NOT `nonReentrant` (so a synchronous
  same-tx round-trip works in tests); it is safe only because every
  yield-ack handler touches trusted contracts (OToken vault, wOToken 4626,
  bridgeAsset, governor-set adapter). The reentrancy guard lives solely on
  `_handleInboundBridgeMessage` (the one path with an untrusted
  `recipient.call`). Never add an external call to a non-protocol address in
  a yield-ack handler.
- **Bridge bounds can't brick the yield channel.** A withdrawal outside the
  adapter's `[minTransferAmount, maxTransferAmount]` is rejected at Master
  leg 1 (pre-check against the inbound/mirror adapter) and, as defense in
  depth, NACK'd — not reverted — at Remote leg 2. A sub-floor / above-cap
  amount can never deadlock the one-op-in-flight channel.
- **Queue requestId is stored offset-by-one.** `outstandingRequestId =
  vault.requestId + 1`, so a real requestId of 0 (first withdrawal on a fresh
  vault) is distinguishable from "no request"; `outstandingRequestId != 0`
  means "pending, unclaimed".
- **OToken (18dp) internal, bridgeAsset units at the vault edge** (see §3.11):
  `remoteStrategyBalance` / `bridgeAdjustment` / the bridge channel are 18dp;
  conversions happen only at the documented seams (identity for 18/18 OETHb).
- **CCTP token legs use the finalised threshold (fee 0).** Fast-finality
  (1000–1999) deducts a non-zero burn fee with no `maxFee` headroom, so the
  deploy config sets `minFinalityThreshold = 2000` for token-carrying legs.
- **Strategist-gated paths are inert on Remote.** Remote has no vault
  (`vaultAddress == 0`), so the strategist branch of the shared modifiers
  cannot resolve; Remote runs via governor / operator / permissionless paths.

These invariants are the load-bearing assumptions across the codebase. If
any one breaks, downstream math goes wrong. Tests cover each one explicitly.
