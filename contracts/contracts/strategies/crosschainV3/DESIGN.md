# OETHb V3 Cross-Chain Strategy — Design Notes

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
adapter family that drives it, for the **OETHb Phase 1** migration.
Concretely:

- **`MasterWOTokenStrategy`** + **`RemoteWOTokenStrategy`** (with abstract bases
  `AbstractCrossChainV3Strategy` and `AbstractWOTokenStrategy`). A single
  nonce-gated **yield channel**: deposit / withdraw and their ACKs, one operation
  in flight at a time, plus an unprompted balance report from Remote.
- **Adapter family** on a shared `AbstractAdapter` base: `CCIPAdapter` and
  `SuperbridgeAdapter`. Each carries a multi-tenant whitelist, per-lane config,
  and governor-settable `minTransferAmount` / `maxTransferAmount` caps.
- **CreateX/CREATE2 proxies** (`BridgeAdapterProxy`, `CrossChainStrategyProxy`),
  deployed so the proxy address is byte-identical on paired chains. Adapter impls
  are deployed plain — only the proxy address matters for the
  `transportSender == address(this)` peer-parity check.
- **`BridgedWOETHMigrationStrategy`** — upgrade impl for the existing Base
  `BridgedWOETHStrategyProxy`, adding `bridgeToRemote()` to CCIP-ship the
  custodied wOETH to the Remote proxy address.
- **`Master.depositAll` / `withdrawAll`** clamp by the relevant adapter's
  `maxTransferAmount` view so a vault sweep larger than the bridge per-tx
  limit becomes a partial fill rather than reverting.
- **Production OETHb deploys** at `scripts/deploy/base/002-006_*` and
  `scripts/deploy/mainnet/005-006_*`. Master/Remote proxies via CreateX/CREATE2;
  adapters behind `BridgeAdapterProxy` (also CreateX/CREATE2) for paired-chain
  address matching.
- **Docs** — `FLOWS.md` (sequence diagrams), `README.md` (reference).
- **76 unit tests** + mainnet/Base fork tests.

---

## 2. Architecture in one page

Two strategy contracts, one bridge-agnostic adapter API:

```
┌─────────────────────────┐                    ┌─────────────────────────┐
│  Base (vault side)      │                    │  Ethereum (yield side)  │
│                         │                    │                         │
│   OETHb vault           │                    │   OETH vault            │
│        │                │                    │        │                │
│        ▼                │                    │        ▼                │
│   MasterWOTokenStrategy │  ◀── yield ch ──▶  │  RemoteWOTokenStrategy  │
│        │   ▲            │                    │       │   ▲             │
│        ▼   │            │                    │       ▼   │             │
│  outbound  inbound      │                    │  outbound inbound       │
│  adapter   adapter      │                    │  adapter  adapter       │
│   (proxy)  (proxy)      │                    │   (proxy)  (proxy)      │
└─────────────────────────┘                    └─────────────────────────┘
                       ▲                              ▲
                       └──── byte-identical via CreateX/CREATE2
                            (peer-parity precondition)
```

**Roles:**

- **Master** lives on the chain hosting the rebasing OToken vault. It's the
  strategy that vault registers. Vault calls `deposit` / `withdraw`. Master
  doesn't hold yield-earning shares and never touches the OToken; it holds
  `bridgeAsset` (WETH) plus `remoteStrategyBalance`, the last reported Remote
  balance.
- **Remote** lives on the chain hosting the wOToken (ERC-4626 yield wrapper).
  Custodian for shares held on behalf of the L2 vault. Runs the
  bridgeAsset ↔ OToken ↔ wOToken pipeline using the local OToken vault for
  mint/redeem.

**One channel.** DEPOSIT / WITHDRAW_REQUEST / WITHDRAW_CLAIM and their ACKs, plus
BALANCE_REPORT. Every message carries a yield nonce. Master gates concurrent ops
via `pendingDepositAmount == 0 && pendingWithdrawalAmount == 0`. The balance
report is the only message that does not advance the nonce, and the only one
Remote sends unprompted.

**Two adapters, one interface.** The strategy talks to adapters via
`IBridgeAdapter` (outbound) + `IBridgeReceiver` (inbound). Each adapter
encapsulates one bridge transport:

- **CCIPAdapter** — Chainlink CCIP, atomic token + message.
- **SuperbridgeAdapter** — split delivery. CCIP for messages; OP Stack
  L1StandardBridge for the canonical ETH leg. Pending-slot lifecycle in the
  `pendingFor` mapping.

See [`FLOWS.md`](./FLOWS.md) for sequence diagrams of each flow.

---

## 3. Design decisions & rationale

### 3.1 A single nonce-gated yield channel

**Decision.** Every cross-chain operation is serialised behind one yield nonce.
Every message carries that nonce, and every message is authenticated as coming
from the peer strategy via the governor-set adapter. Only the vault and the
operator can originate one; there is no user-callable entrypoint on either side.

**Why.** All strategy operations change protocol-level accounting
(`remoteStrategyBalance`, `pendingDepositAmount`, `pendingWithdrawalAmount`), so
out-of-order delivery would corrupt state. Serialising them is the whole
correctness story: at most one operation is ever in flight, so Master's view of
Remote is either current or knowably stale, never partially applied.

**How.** `_acceptYieldNonce` + `_markYieldNonceProcessed` enforce monotonic
advance on the receiving side. The sender gate
`pendingDepositAmount == 0 && pendingWithdrawalAmount == 0` blocks a second
outbound op while one is in flight.

### 3.2 Remote pushes the balance report; Master does not ask for it

**Decision.** `Remote.sendBalanceReport()` is operator-triggered on Remote and
sends BALANCE_REPORT unprompted, stamped with Remote's own `block.timestamp` and
Remote's own `lastYieldNonce`. It does not advance the nonce. Master accepts the
report only when three independent guards pass. There is no request leg.

**Why not a request/response round-trip.** A request leg would double the message
count of the cadence for no correctness gain, and — more importantly — it makes
the reading's freshness relative to the *request* rather than to the *snapshot*.
That distinction is load-bearing: if Master mints the timestamp and Remote echoes
it, two readings requested in order can be snapshotted in either order, and the
ordering guard can then preserve the staler one. Stamping at the source removes
the failure mode rather than bounding it.

**Why a push is safe to order.** Successive Ethereum blocks have strictly
increasing timestamps, so `reportTimestamp > lastBalanceCheckTimestamp` is an
exact total order over readings — a single-clock comparison, with no cross-chain
clock skew to slack out.

The three guards (`MasterWOTokenStrategy._processBalanceReport`). A report is a
snapshot taken at some earlier moment; each guard rejects a snapshot that no
longer describes what Master is accounting against:

1. `isYieldOpInFlight()` — a deposit/withdraw is mid-flight. Remote's balance
   already reflects it while Master still counts it in `pendingDepositAmount`,
   so accepting would double-count. The op's own ack carries a fresher figure.
2. `nonce == lastYieldNonce` — the narrower case where the op *completed* in
   transit, so guard 1 has already cleared. A pre-op snapshot necessarily carries
   the pre-op nonce, so this rejects it.
3. `reportTimestamp > lastBalanceCheckTimestamp` — two reports at the same nonce
   delivered out of order. Strict `>` keeps the newest reading.

**Trade-off.** Cost: `lastBalanceCheckTimestamp` storage, and Remote becomes the
one place that originates a message unprompted. Benefit: one message per reading
instead of two, an exact ordering rather than an approximate one, and a cadence
that is trivial to automate (run on a cron, ignore failures).

**Known limitation.** Guard 1 couples the cadence to the yield channel in the
other direction: while a nonce is unprocessed, *every* report is discarded and
`remoteStrategyBalance` freezes. A permanently stuck ack therefore freezes the
oracle the vault rebases against. See §4.3 for the recovery path.

### 3.3 `amount <= ackAmount` claim tolerance

**Decision.** `Master._processWithdrawClaimAck` accepts when
`amount <= ackAmount` (not strict equality). Any shortfall is a fee deducted
from the token amount on the destination side.

**Why.** A transport that takes its fee out of the transferred amount delivers
less than the ack declares. If Master enforced `amount == ackAmount`, every such
withdrawal would revert and the one-op-in-flight channel would stall.

**Worth knowing:** neither CCIP nor the Superbridge canonical ETH leg deducts from
the token amount, so no configured transport exercises this tolerance today. It is
deliberately defensive: being loose in this direction is the safe failure mode, and
tightening to strict equality would turn a future fee-charging transport from slight
yield drag into a stalled channel.

The shortfall isn't lost — it's yield drag absorbed via the next
BALANCE_REPORT, which refreshes `remoteStrategyBalance` to Remote's true value.
Master ignores `feePaid` entirely; the older
`CrossChainMasterStrategy._onTokenReceived` follows the same pattern.

**No lower bound.** Master doesn't enforce `amount >= ackAmount * (1 - X%)`: a
tolerance threshold is one more knob to tune and one more revert path to handle. If
Remote ships much less than requested, it shows up as yield drag on the
next balance report — operationally visible.

### 3.4 CreateX / CREATE2 peer parity for both proxies and adapter proxies

**Decision.** Master, Remote, and every adapter live behind a proxy deployed
deterministically through the **CreateX factory** (same factory address on every
chain) using **CREATE2**. Impl contracts are deployed plain (chain-specific
addresses are fine). The proxy address matches on both chains.

**Why.** The `transportSender == address(this)` check inside `_validateInbound`
requires the source-side adapter address to equal the destination-side
adapter address. The strategy `_deliver` similarly dispatches to
`envelopeSender` (the source strategy), which must resolve to the
destination strategy on the receiving chain. Both checks need byte-identical
addresses across chains. CREATE2 from the same CreateX factory with a fixed
per-proxy salt and identical proxy initcode gives that.

**Why proxy + plain impl, not deploy the impl directly.** Impls have
chain-specific constructor args (CCIPRouter, L1StandardBridge, WETH, etc.) —
different initcode → different CREATE2 address. The proxy has uniform initcode
across chains, so its CREATE2 address is identical. The proxy delegates to the
chain-specific impl.

**Toolchain hazard.** Proxy creation bytecode differs between the Hardhat and
Foundry builds of the same source (the metadata CBOR trailer records remappings
and `evmVersion`), so the two toolchains compute **different** CREATE2 addresses.
Both chains must therefore be deployed from the same build output. The Foundry
deploy path (planned, Phase D) will assert the initcode hash and the resulting
address against pinned constants before broadcasting, turning a rebuild-induced
address change into a pre-broadcast revert.

**See:** `BridgeAdapterProxy.sol`, `CrossChainStrategyProxy.sol`.

### 3.5 `pendingWithdrawalAmount` not in `checkBalance`

**Decision.** `Master.checkBalance` returns `bridgeAsset.balanceOf(this)` +
`pendingDepositAmount` + `remoteStrategyBalance`, but NOT
`pendingWithdrawalAmount`.

**Why.** During an in-flight withdrawal, the value is still on Remote (in the
OToken vault's withdrawal queue) and reflected in `remoteStrategyBalance`.
Including it as `pendingWithdrawalAmount` too would double-count.
`pendingWithdrawalAmount` is purely a gate for "is there an in-flight
withdraw," not a balance component.

**Draw bound.** A withdrawal is gated by `_amount <= remoteStrategyBalance`. That
value is exactly what Remote last reported it could unwrap, so it is the complete
and correct bound — nothing else on either side holds value the draw should account
for.

**Trade-off.** If Remote's outbound ack is permanently lost (transport
failure), `pendingWithdrawalAmount` stays set forever, blocking future
withdrawals. Mitigation: governor swaps `outboundAdapter` /
`inboundAdapter` to a new adapter and re-delivers the ack via the new
adapter. Not a code change — operational only.

### 3.6 Operator-funded fee pool, no refunds

**Decision.** A single `_send(token, amount, msgType, nonce, body)` helper. The
bridge fee always comes from `address(this).balance` — the native-token pool the
operator pre-funds. There is no user-funded path and no per-call `msg.value`
threading.

**Why.** Every send is operator- or vault-driven and predictable, so pre-funding
a pool is simpler than quoting and forwarding value at each call site, and it keeps
the fee concern out of the vault-facing entry points entirely.

**Why no refunds.** Excess balance in the pool is not a loss — it funds the next
send. The governor can sweep it via `transferNative(amount)` if the pool is being
wound down.

### 3.7 USDT is not in scope → standard `safeApprove(spender, amount)`

**Decision.** The codebase uses `safeApprove(spender, amount)` directly,
without zeroing first.

**Why.** OpenZeppelin's `safeApprove` reverts on a non-zero → non-zero
allowance transition (the USDT quirk). The tokens we actually bridge (WETH,
plus the OToken family) don't have this quirk. The "defensive zero-first"
pattern adds code surface and gas for a problem we don't have.

### 3.8 `checkBalance` must never revert and never return negative

**Decision.** Neither side's `checkBalance` has a revert path, and Remote's
internal balance computation clamps to 0 rather than underflowing.

**Why.** The vault treats `checkBalance` as an oracle. A reverting balance
read cascades into broken rebases and stuck deposits / redemptions.

`Master.checkBalance` is a sum of three unsigned quantities, so it cannot go
negative and needs no clamp.

Remote's `_balanceAfter(amount)` (used for the R→M balance reports, and the
`amount == 0` case backs `checkBalance`) **clamps to 0**. It can't go
_significantly_ negative because (w)OTokens never negative-rebase, so the value
is principal + yield; the only thing that drives it slightly negative is wOToken
4626 rounding against the strategy once a `withdrawAll` drains it near 0, and
reverting on that dust would freeze the serialized yield channel. The one
scenario the clamp masks is a real **negative rebase**: it would make Master read
0 instead of the true (negative) value — out of scope while (w)OTokens are
up-only, recoverable by governor via an implementation upgrade.

### 3.9 Both tokens are 18-decimal, enforced at construction

**Decision.** The pair accounts in a single 18-decimal domain. There is no
scaling anywhere: `remoteStrategyBalance`, `pendingDepositAmount`,
`pendingWithdrawalAmount`, `outstandingRequestAmount`, every physical bridge
transfer, and both `checkBalance` return values are all directly comparable.

Both constructors assert the invariant rather than adapting to it:

```solidity
require(IBasicToken(_bridgeAsset).decimals() == 18, "WOT: bridge asset not 18dp");
require(IBasicToken(_oToken).decimals() == 18,      "Remote: oToken not 18dp");
```

**Why enforce rather than scale.** Supporting a mismatched pair (say a 6-decimal
bridge asset against an 18-decimal OToken) costs a conversion at every seam. For a
matched pair every one of those conversions is the identity: dead arithmetic on
each hot path, two cached decimals immutables to carry, and a class of rounding bug
that could only ever manifest on a configuration we do not deploy.

Asserting at construction moves the failure from "silent mis-accounting in
production" to "deploy transaction reverts", which is the right place for it. A
future 6-decimal pairing is a deliberate change to this contract, not a
configuration flag.

### 3.10 Governor is fully trusted across this subsystem

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
power. The one bounded lever (the per-tx `maxTransferAmount` cap) constrains the
operator path, not the governor.

### 3.11 We bridge messages and the backing asset, never the OToken or wOToken

**Decision.** No OToken or wOToken ever crosses the bridge. The strategy bridges
the **backing asset** (WETH) plus a message. Remote mints OToken from that asset
at the local OToken vault and wraps it to wOToken; on withdraw it unwraps,
redeems to the backing asset, and bridges the asset back.

**Why.** Bridging the rebasing OToken directly would force every chain to track
the other's rebase, and the in-flight value would be ambiguous while a rebase
lands mid-transit. Carrying value as the backing asset sidesteps that entirely:
the OToken supply stays authoritative per chain, and value-in-transit is a
concrete ERC-20 balance on a bridge, not an accounting term.

The statement is unconditional, which is what lets Master hold no OToken
permission at all: it is `approveStrategy`'d on the OETHb vault but is **not** on
the mint whitelist, and never holds or moves OETHb.

Provenance of the OToken-vs-wOToken bridging decision (from the wider V3 spec):
https://app.notion.com/p/originprotocol/OUSD-V3-Spec-33c84d46f53c807c80c2c187e0c6c2df

---

## 4. Caveats & operational concerns

These are NOT bugs — they're things an operator should know.

### 4.1 Governance metadata must be recorded after the real deploy

A real deploy broadcasts the deployment transactions but only *prints* the
governance calldata — submitting it is a manual step. Until the resulting
proposal id and its execution timestamp are written back into
`build/deployments-<chainId>.json`, every later fork run re-enters
`handleGovernanceProposal()` for that script. **Record both once the proposal
has executed on chain.**

### 4.2 OETH-vault Remote registration is undefined

Base side registers Master with the OETHb vault via
`scripts/deploy/base/005_OETHbV3VaultWiring.s.sol` — `approveStrategy` only; Master needs no mint
permission because it never touches OETHb. Mainnet side has no equivalent
governance action touching the OETH vault. **Verify with the team:** does
the OETH vault need Remote registered as a strategy? Remote is a custodian, not
a vault strategy, so the working assumption is no — but it is unconfirmed.

### 4.3 Lost claim-ack stalls `pendingWithdrawalAmount`

If Remote's outbound adapter goes pathological and a leg-2 ack is
permanently lost, Master's `pendingWithdrawalAmount` stays non-zero,
blocking future withdrawals. **Mitigation:** governor calls
`setOutboundAdapter` (Remote) / `setInboundAdapter` (Master) to swap to a
fresh adapter pair; the new pair can re-deliver the ack. No code change
needed — operational only.

**On-chain handler-failure recovery (not just lost transport).** Remote's
inbound yield handlers are revert-free so a failed underlying call can't brick
the serialized channel:

- **Leg-1 NACK.** If the unwrap/queue in `_processWithdrawRequest` reverts,
  Remote queues nothing and the `WITHDRAW_REQUEST_ACK` carries `success = false`;
  Master clears `pendingWithdrawalAmount` so the channel frees up (the withdrawal
  simply didn't happen and can be re-requested). The unwrap is non-atomic — any
  OToken it unwrapped before the queue failed is left idle, counted by
  `_viewCheckBalance` and re-wrappable via `retryDeposit`.
- **Failed deposit.** If `_processDeposit`'s mint/wrap reverts, the bridgeAsset
  (or OToken) is left idle on Remote — still counted, value preserved — and the
  operator-only **`retryDeposit()`** re-runs the mint/wrap pipeline to put it back
  into productive wOToken. The DEPOSIT_ACK is still sent with the true balance.

### 4.4 9-batch Phase 1 migration pacing

OETHb Phase 1 migrates ~8.7k wOETH from the existing `BridgedWOETHStrategy` to
the new Master/Remote pair via 9 × `bridgeToRemote(1000e18)`. **CCIP rate
limits this to ~1000 WETH/hour**, so the migration takes ~9 hours. No
deposits / withdrawals on the new pair during this window.

**Sequencing:** mainnet `005` + `006` must execute before the first
`bridgeToRemote` call. `bridgeToRemote` ships wOETH to the Remote **proxy
address**, which is known ahead of time via CREATE2 but has no code until
`005` runs. No script can enforce this ordering — it belongs in the runbook.

### 4.5 Cleanup script (`006`) is gated by `skip`

`scripts/deploy/base/006_OETHbV3RemoveOldStrategy.s.sol` has `skip = true` so
it never auto-fires. **The operator must manually flip this to `false`**
after the 9-batch migration completes and `BridgedWOETHStrategy.checkBalance`
is at dust.

### 4.6 Adapter `maxTransferAmount` is a per-tx cap, not a per-hour rate

The CCIP lane has a per-hour rate limit on Chainlink's side (~1000 WETH/h
on the OETHb pair). The adapter's `maxTransferAmount` caps each
individual call, not cumulative time-window throughput. The operator must
still pace operations off-chain to respect the rate limit. **Why not a
time-window?** Adds state + complexity for no real protection — Chainlink
enforces the rate limit on its end anyway, so a contract-side mirror
is redundant defense.

### 4.7 Overpayment into the fee pool is not refunded

`_send` requires `address(this).balance >= fee` and does not refund the
remainder — it stays in the pool and funds the next send. Native sent to the
strategy in excess of what the cadence consumes is recoverable via
`transferNative(amount)` (governor only).

### 4.8 `lastBalanceCheckTimestamp` is per-Master

The timestamp guard on balance-check responses is local state on Master. If
Master is upgraded (impl swap) and the storage layout changes, the timestamp
could be reset to 0, accepting a stale response on the next check. **Mitigation:**
storage layout is preserved across upgrades (the slot is part of
`AbstractCrossChainV3Strategy` with explicit `__gap` reservation). Verify
the storage layout before any upgrade.

---

## 5. Pending work

See [`README.md`](./README.md) "Open items for follow-up" for the canonical
pending list. Top of mind for the next PR:

1. Complete the Foundry migration of the deploy scripts and test suites.
2. Populate production `proposalId` (4.1) — blocks mainnet deploy.
3. Decide OETH-vault Remote registration (4.2).
4. A `sendBalanceReport` Talos action for the ~2h cadence (targets Remote on Ethereum).
5. Governance proposals: deploy + wire (prop 1), post-migration cleanup
   (prop 2).
6. Operator runbook (cadences, failure modes, alert thresholds).

---

## 6. Cross-references

- **[`README.md`](./README.md)** — reference doc: file map, message
  envelope layout, state-transition table, authorisation surface, adapter
  knobs, pending list.
- **[`FLOWS.md`](./FLOWS.md)** — narrative walkthroughs of the three core
  flows (deposit, withdraw, balance report) with Mermaid sequence diagrams +
  fee model and adapter knob references.
- **`.claude/skills/add-network/SKILL.md`** — checklist for adding a new
  network to the repo.

---

## 7. Key invariants (one-line summaries)

For an auditor or on-call engineer reviewing the code quickly:

- **`checkBalance` never reverts and never returns negative** on either side.
  Master's total is a sum of unsigned quantities; Remote's internal balance
  clamps to 0 on 4626 rounding dust.
- **Yield ops are serialised on Master.** `pendingDepositAmount == 0 &&
pendingWithdrawalAmount == 0` must hold before a new yield op fires.
- **The balance report does not advance the nonce**, and acceptance requires all
  three guards (`isYieldOpInFlight()`, nonce match, timestamp strictly monotonic).
  It is the only message Remote sends unprompted.
- **Every inbound message is nonce-gated.** There is no unordered message path
  and no user-callable entrypoint that originates a cross-chain send.
- **Adapter peer parity** (`transportSender == address(this)`) is enforced
  on every inbound. CreateX/CREATE2 deployment gives byte-identical proxy
  addresses across paired chains.
- **`remoteStrategyBalance` holds exactly Remote's `_balance()`.** Every R→M
  report (deposit / withdraw / claim acks and the balance report) routes through the
  same function, so Master's view is either current or knowably stale — never
  partially applied.
- **Master forwards full local bridgeAsset to vault on claim-ack success.**
  Donated bridgeAsset on Master ends up in the vault as "free deposit" —
  intentional (locked policy).
- **Inbound handlers only call protocol-controlled contracts.**
  `receiveMessage` is deliberately NOT `nonReentrant` (so a synchronous
  same-tx round-trip works in tests); it is safe because every handler touches
  only trusted contracts (OToken vault, wOToken 4626, bridgeAsset, governor-set
  adapter). The subsystem contains **no untrusted external call at all**. Never add
  one to a handler.
- **Bridge bounds can't brick the yield channel.** A withdrawal outside the
  adapter's `[minTransferAmount, maxTransferAmount]` is rejected at Master
  leg 1 (pre-check against the inbound/mirror adapter) and, as defense in
  depth, NACK'd — not reverted — at Remote leg 2. A sub-floor / above-cap
  amount can never deadlock the one-op-in-flight channel.
- **Queue requestId uses a `REQUEST_ID_EMPTY` sentinel.** `outstandingRequestId`
  stores the vault's `requestId` verbatim; `REQUEST_ID_EMPTY` (`type(uint256).max`,
  set in `initialize`) means "no request", so a real requestId of 0 (first
  withdrawal on a fresh vault) is unambiguous. `outstandingRequestId !=
REQUEST_ID_EMPTY` means "pending, unclaimed".
- **Both tokens are 18-decimal, asserted in the constructors** (see §3.9). There
  is no scaling anywhere in the pair; a mismatched asset fails at deploy.
- **Master holds no OToken permission.** It is `approveStrategy`'d on the OETHb
  vault but is not on the mint whitelist, and never holds or moves OETHb.
- **Strategist-gated paths are inert on Remote.** Remote has no vault
  (`vaultAddress == 0`), so the strategist branch of the shared modifiers
  cannot resolve; Remote runs via governor / operator / permissionless paths.

These invariants are the load-bearing assumptions across the codebase. If
any one breaks, downstream math goes wrong. Tests cover each one explicitly.
