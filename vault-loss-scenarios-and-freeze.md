# OToken Vault: loss scenarios, freeze behavior, and options

Scope: what could trigger a loss, what the vault does during a loss, how the withdrawal circuit breaker (`maxSupplyDiff`) freezes and unfreezes, the cases at each loss size, and the options on the table with their tradeoffs.

## What could trigger a capital loss

A capital loss is anything that makes gross assets `A` fall below supply `S`. It shows up as a strategy's `checkBalance` dropping, or the vault's own asset balance falling short. From there it flows through the mechanics below. The triggers depend on the strategies each vault runs.

**OETH (backed by WETH).** Mainly native ETH staking through SSV validators, plus a Curve AMO.

- Validator slashing. A validator commits a slashable offense and loses part of its 32 ETH stake. A correlated event (a client bug, or one operator slashed across many validators) is the tail case. This drops the native staking strategy's ETH directly.
- Validator penalties and downtime. Missed attestations or an inactivity leak during non-finality. A slow bleed, not a spike.
- AMO pool imbalance. The Curve AMO can lose value if the OETH/ETH pool depegs while it holds the heavy side, similar to impermanent loss. Its own moves are guarded: liquidity operations are slippage-capped (max 5%) and a solvency check blocks any deposit, withdrawal, or rebalance that would push the vault below ~99.8% backed. Those guards don't stop an external depeg or a pool exploit, which is the residual risk.

**OUSD (backed by USDC).** Mainly Morpho lending markets across Ethereum, Base, and HyperEVM, plus cross-chain movement of USDC.

- Bad debt in a Morpho market. Collateral crashes faster than liquidators can act, or liquidation is blocked by illiquidity, leaving bad debt. As a supplier, the vault can't withdraw full principal.
- Oracle failure in a market. A wrong or manipulated price lets borrowers over-borrow against bad collateral, creating bad debt that hits suppliers.
- Market misconfiguration. A risky market (bad LLTV, thin collateral) or a bad curator allocation loses supplied funds.
- Cross-chain risk. USDC moved across chains (CCTP or the cross-chain strategy) could be stuck or lost if a bridge or a remote market fails.

**Applies to every vault.**

- Smart contract exploit. A bug in a strategy, an underlying protocol (Morpho, Curve, SSV, Aerodrome), or the vault drains funds. Usually large enough to land in the catastrophic band.
- Accounting or oracle error. A strategy over-reports `checkBalance` (stale price, a reward token marked too high), so the vault looks solvent until the correction realizes the loss. This is the "strategy was off on its asset total" case the code comments already call out.
Severity tends to split by speed:

- Slow bleeds (penalties, small bad debt, minor pool imbalance) tend to stay in the mild band, where the socialization and freeze mechanics below apply.
- Sudden large losses (an exploit, a mass slashing) tend to blow past the threshold into the catastrophic band, where the guardian pause and strategy-level recovery matter more than the withdrawal accounting.

## How the safeguard works

The check lives in `_postRedeem()` and runs on `requestWithdrawal`, `claimWithdrawal`, and `claimWithdrawals`. It does **not** run on `mint` or `mintForStrategy`.

Terms:

```
A  grossAssets       = asset in the vault + all strategies (not reduced by the queue)
q  outstandingQueue  = queued − claimed   (promised to the queue, not yet paid)
S  liveSupply        = oToken.totalSupply()   (queued requests are already burned, so not counted)
V  netValue          = A − q               (what the contract calls totalValue, floored at 0)
d  maxSupplyDiff      = 3% OETH, 5% OUSD
```

The check is:

```
diff = S / V
require( |diff − 1| <= d )   // else revert "Backing supply liquidity error"
require( V > 0 )             // else revert "Too many outstanding requests"
```

One subtlety: the percentage is measured against value `V`, not supply `S`. So a 3% `maxSupplyDiff` trips when backing falls to `S / 1.03 = 97.09%` of supply, which is a **2.91%** loss relative to supply. For 5% it's a **4.76%** loss.

## What moves the insolvency measure

Each action moves `diff` in one direction:

- **Loss** (A falls): `diff` up.
- **Request a withdrawal**: in an impaired vault, `diff` up. In a healthy vault, no change.
- **Claim a withdrawal**: no change. The claim drops A and q by the same amount, so V is unchanged and S is unchanged.
- **Mint**: `diff` down, toward 1. Fresh assets come in 1:1 against new supply and dilute the shortfall.
- **Rebase**: mints new supply to distribute yield, raising supply toward value. `diff` toward 1, but only when over-backed, since rebase never lowers supply.
- **Recovery** (A rises, from yield, dripper, or a top-up): `diff` down.

Two facts fall out of this:

1. The freeze builds up from **requests accumulating**, not from claims. Even a small loss can freeze the vault if enough people queue.
2. A **mint can unfreeze** the vault, because it moves `diff` the opposite way from a request.

## Solvency bands (OETH, d = 3%, supply normalized to 100)

| Band | Backing (V/S) | Requests | Claims | Mint | State |
|------|---------------|----------|--------|------|-------|
| Healthy | 100% | ok, 1:1 | ok, 1:1 | ok | Normal. No socialization. |
| Mild (in band) | 97.09% to 100% | ok until requests push diff to the edge | ok, 1:1 | ok (lowers diff) | Early exiters escape. Stayers absorb a concentrated loss. |
| At/over threshold | below 97.09% | revert | revert | still open (can unfreeze) | Frozen. Value trapped. Governance situation. |
| Queue > assets | V floored to 0 | revert | revert | still open | Deep insolvency. "Too many outstanding requests". |
| Over-backed surplus | above ~103% | revert | revert | ok | Rare. One-off surplus above the threshold, not yet rebased out. Self-heals as the vault rebases. |

OUSD is the same shape with d = 5%: freeze at 95.24% backing, max stayer loss 4.76%.

On over-backing and the dripper: the vault's inbuilt yield smoothing is what normally keeps value glued to supply, which is why the over-backed row almost never fires. Smoothing is now internal to the vault (the rebase rate-limiter, using `dripDuration`, a per-second cap, and a ~2% hard cap per rebase). The old external Dripper slot is deprecated. The catch is that it rate-limits the rebase, not the value coming in, so harvested yield is counted the moment it lands. A one-off surplus larger than the threshold (a big reward sale, a base-asset donation, or a strategy revaluation) can still tip the vault over-backed before rebases distribute it. It self-heals, since `rebase()` doesn't run the solvency check and keeps dripping the surplus out until backing is back under the threshold.

## Worst case in the mild band

The mild band is where the loss is split unevenly. Early requesters get paid 1:1 and escape their share of the loss. The remaining holders absorb it, concentrated.

At the freeze point, remaining holders are always left at exactly `1/(1+d)` backing, no matter how small the original loss was. For OETH that's 97.09%. The size of the loss just decides **how many** holders escape first.

Loss `X` is on the 100-supply basis. Escapable queue before freeze is `Q_max = S − ((1+d)/d)·X`.

| Loss X | Can escape at 1:1 | Stayers left | Stayer backing | Stayer loss vs fair share |
|--------|-------------------|--------------|----------------|----------------------------|
| 0.5% | 82.8 | 17.2 | 97.09% | ~2.91% vs 0.5% (about 6x) |
| 1% | 65.7 | 34.3 | 97.09% | ~2.91% vs 1% (about 3x) |
| 2% | 31.3 | 68.7 | 97.09% | ~2.91% vs 2% (about 1.5x) |
| 2.91% | ~0 | ~100 | 97.09% | shared equally, no escape |

A tiny 0.5% loss can still push the last stayers down to 97.09% backing if enough people escape first. The absolute loss is small, but it's concentrated onto whoever didn't move.

Above 2.91%, the vault is already frozen before anyone can queue. Nobody escapes, everyone sits at the same backing, and the loss is shared equally. So the uneven split is specific to the mild band. In the catastrophic band the freeze shares the loss evenly on its own.

The mild band has one more property. A party who knows a loss is about to be booked (an oracle update, an LST slashing report) can request just before it lands and claim just after, locking in 1:1 and escaping their share. This is bounded by the same threshold.

## How the freeze happens

Two different "freezes" exist. Keep them separate.

**1. Automatic threshold freeze (`_postRedeem`).**
Triggered by the math, not a person. `diff` crosses `1 + d` and requests plus claims start reverting. Causes:

- A loss large enough on its own (over 2.91% for OETH).
- A smaller loss plus enough queued requests to push `diff` over the edge.
- A deep shortfall where the queue exceeds total assets (`V` floors to 0).

Mint, rebase, and allocate still work during this freeze.

**2. Guardian pause (`whenNotCapitalPaused`).**
Deliberate. The guardian pauses the vault and blocks mint, request, and claim together. This is the manual emergency stop, used when something is actively wrong (a strategy exploit, a bad oracle). It's a policy tool, not tied to `diff`.

## How the freeze unfreezes

The automatic threshold freeze lifts when `diff` falls back under `1 + d`. The paths:

- **Organic recovery.** Assets earn back, the dripper releases, or a positive rebase raises value. No action needed, but slow and not guaranteed.
- **Capital injection.** Treasury, insurance, or a donation raises A. Makes holders whole, but needs real funds.
- **Governance widens or disables `maxSupplyDiff`.** Fast, but it reopens 1:1 claims, so whoever moves first escapes. The tradeoff is trapped funds versus first-mover escape.
- **A mint.** Lowers `diff` and can lift the freeze on its own. The minter ends up subsidizing the queue by buying an under-backed token.

The guardian pause lifts only by a governance or guardian action. Nothing moves while paused.

Note: the freeze only stops withdrawal-driven socialization. It does not stop the underlying loss from getting worse. If a strategy keeps bleeding while frozen, backing keeps falling below 97.09%. The threshold caps the socialized transfer, not the total loss.

## Options and tradeoffs

Four options have come up. They are not mutually exclusive.

### Option A: Document the behavior, no code change

Describe the current loss handling in the README and on Immunefi as known, intended behavior. No contract change.

Pros:

- No code risk. Preserves long-tested mint, redeem, and withdraw paths.
- Neutralizes the "is this a bug" question for bug bounties. A documented behavior is not a payable finding.
- Fast. Keeps the OSDV3 audit scope minimal.
- Respects that loss-sharing fairness is subjective. Discloses the policy and lets users manage their own risk.

Cons:

- Does not remove the mild-band extraction (OEV). Disclosure makes it known, not gone.
- Leaves the mint path able to unfreeze the vault and let 1:1 claims resume.
- Remaining holders still bear a concentrated loss in the mild band.
- Keeps leaning on `maxSupplyDiff`, which also serves as a rebase limit. One knob, two jobs.

### Option B: Add mint gating

Block `mint` (and `mintForStrategy`) when the vault is under-backed past a small tolerance. Reuses the value check already in `_postRedeem`, applied on the way in, one-sided.

Pros:

- Closes the mint unfreeze path. A mint can no longer lift the circuit breaker.
- Protects the minter from buying a token worth less than they paid.
- Stops fresh mint assets from funding the old queue at par.
- Small (about 15 to 25 lines), one-sided, never fires when healthy. Additive to the existing system.

Cons:

- The minter is the party who loses, so there is no attacker profit motive. It is self-harming, not a classic exploit.
- Adds a new revert path to a function that has always worked.
- Deep in the frozen zone, unfreezing by mint needs an impractically large mint, so this path mostly matters near the threshold.
- Gating `mintForStrategy` could block AMO rebalancing during a loss, when the strategist may need it.
- Not present since inception, with no incident to date.

### Option C: Full loss socialization (haircut on claim)

Stop paying queued withdrawals a fixed 1:1. Pay `min(requested, requested × backing ratio)` at claim, using effective supply (live plus queued) as the denominator. Possibly rework the FIFO gate so claims don't jam in deep impairment.

Pros:

- Shares losses across queued and remaining holders instead of concentrating them on stayers.
- Removes the mild-band OEV. A late claim can no longer escape at 1:1.
- Claims self-correct instead of freezing, which removes the freeze-versus-widen governance dilemma.

Cons:

- Large, invasive change to battle-tested code. Highest risk of introducing a new bug.
- Changes redemption semantics. Payouts can be below 1:1, which is a product and peg decision, not just an engineering one.
- Fairness is subjective. A queued user can argue they locked in an exit.
- Bigger audit scope.
- Only changes outcomes in the mild band. The threshold already caps stayer loss, and the catastrophic band is already shared evenly.

### Option D: Retune or decouple maxSupplyDiff

Lower the threshold for an earlier freeze, or split it from its rebase-limit role so the two can be set independently.

Pros:

- A smaller threshold freezes sooner, so less loss is socialized before withdrawals stop.
- Decoupling avoids one knob controlling both the freeze and rebase smoothing.

Cons:

- A smaller threshold freezes more easily, trapping funds sooner and on smaller moves.
- Still a freeze, not loss sharing. It changes when the stop happens, not who bears the loss.
- Retuning the current knob affects rebase behavior unless it is decoupled first.
