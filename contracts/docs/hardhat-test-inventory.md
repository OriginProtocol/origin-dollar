# Hardhat Test Suite Inventory (master baseline)

> Detailed documentation of every test and its assertions in the legacy Hardhat suite (`contracts/test/`), as of the master baseline of PR #2848 (Foundry migration).
> Generated 2026-07-15 by a multi-agent review. Shared behaviour suites (`test/behaviour/*`) are documented once and referenced by their consumers.
> Excluded (not tests): `test/helpers.js`, `test/_fixture*.js`, `test/scripts/`, `test/abi/`.

## Contents
- [OETH Vault (unit + mainnet fork)](#oeth-vault-unit--mainnet-fork)
- [Vault mint / redeem / rebase (unit)](#vault-mint--redeem--rebase-unit)
- [Vault general, mock vault, OS vault (unit + mainnet/sonic fork)](#vault-general-mock-vault-os-vault-unit--mainnetsonic-fork)
- [Vault on Base/Plume, harvester, permissioned rebase](#vault-on-baseplume-harvester-permissioned-rebase)
- [05 — OUSD token core + transfers (unit)](#05--ousd-token-core--transfers-unit)
- [Wrapped tokens + OToken fork tests (all chains)](#wrapped-tokens--otoken-fork-tests-all-chains)
- [Compounding SSV staking strategy (unit)](#compounding-ssv-staking-strategy-unit)
- [Native SSV staking strategy (unit + behaviour + mainnet fork)](#native-ssv-staking-strategy-unit--behaviour--mainnet-fork)
- [Curve AMO strategies OUSD/OETH (mainnet fork)](#curve-amo-strategies-ousdoeth-mainnet-fork)
- [Algebra AMO behaviour suite + Hydrex AMO (Base fork)](#algebra-amo-behaviour-suite--hydrex-amo-base-fork)
- [Aerodrome AMO + Base Curve AMO (Base fork)](#aerodrome-amo--base-curve-amo-base-fork)
- [12 — Shared strategy behaviours, VaultValueChecker, Morpho V2, Bridged WOETH](#12--shared-strategy-behaviours-vaultvaluechecker-morpho-v2-bridged-woeth)
- [Sonic staking (SFC behaviour) + SwapX AMO (Sonic fork)](#sonic-staking-sfc-behaviour--swapx-amo-sonic-fork)
- [Cross-chain master/remote strategies (unit + mainnet/base/hyperevm fork)](#cross-chain-masterremote-strategies-unit--mainnetbasehyperevm-fork)
- [OUSD Rebalancer (unit + mainnet/base/hyperevm fork)](#ousd-rebalancer-unit--mainnetbasehyperevm-fork)
- [16. Beacon proofs and beacon roots (unit + mainnet fork)](#16-beacon-proofs-and-beacon-roots-unit--mainnet-fork)
- [Pool boosters: Curve, SwapX, Merkl, Metropolis, Shadow (mainnet/sonic fork)](#pool-boosters-curve-swapx-merkl-metropolis-shadow-mainnetsonic-fork)
- [Safe automation modules (unit + mainnet/base fork)](#safe-automation-modules-unit--mainnetbase-fork)
- [Zappers, timelock governance forks, reborn hack](#zappers-timelock-governance-forks-reborn-hack)

## OETH Vault (unit + mainnet fork)

Covers the mainnet OETH Vault: single-asset (WETH) mint, the async withdrawal queue (requestWithdrawal / claimWithdrawal / claimWithdrawals / addWithdrawalQueueLiquidity), auto-allocation to a default strategy with vault buffer, strategy management (approve/remove, mint whitelist, AMO burnForStrategy), and solvency/insolvency (maxSupplyDiff) checks. The unit file uses two shared helpers: `snapData` (snapshots oeth.totalSupply, vault.totalValue, checkBalance(WETH), user OETH/WETH balances, vault WETH balance, and all four withdrawalQueueMetadata fields: queued/claimable/claimed/nextWithdrawalIndex) and `assertChangedData` (asserts each of those 10 values changed by exactly the given delta). Neither file consumes any `test/behaviour/` shared suite.

Files covered:
- `test/vault/oeth-vault.js` — unit tests (90 its)
- `test/vault/oeth-vault.mainnet.fork-test.js` — mainnet fork tests (9 its)

### `test/vault/oeth-vault.js` — unit test (mainnet)

Fixture: `createFixtureLoader(oethDefaultFixture)` from `test/_fixture.js`, loaded in a top-level `beforeEach`. Contracts under test: `oethVault` (OETHVault proxy), `oeth`, `weth` (mock), plus `MockStrategy` / `MockAMOStrategy` deployed ad hoc via `deployWithConfirmation`. Signers: daniel/josh/matt/domen (users), governor, strategist; strategies and the vault itself are impersonated via `impersonateAndFund` where needed. Withdrawal claim delay is 10 minutes (`advanceTime(10*60)` used throughout).

**describe: "OETH Vault" > "Mint"**
- `it("Should mint with WETH")` — josh approves and mints 1 WETH; asserts `Mint` event with args (josh, 1e18); via assertChangedData: totalSupply/totalValue/checkBalance(WETH)/user OETH all +1 WETH, user WETH −1, vault WETH +1, all queue fields unchanged.
- `it("Fail to mint if amount is zero")` — `mint(0)` reverts "Amount must be greater than 0".
- `it("Fail to mint if capital is paused")` — governor calls `pauseCapital()`; asserts `capitalPaused()` == true; then `mint(10)` reverts "Capital paused".
- `it("Should allocate if beyond allocate threshold")` — deploys MockStrategy, governor approves it and sets it as default strategy; domen mints 100 WETH; asserts strategy WETH balance == 100 (auto-allocated); assertChangedData: supply/value/checkBalance/user OETH +100, user WETH −100, vault WETH delta 0 (all forwarded to strategy), queue unchanged.

**describe: "OETH Vault" > "async withdrawal"**
- `it("Should update total supply correctly")` — daniel mints 10, requests withdrawal of 10, advances 10 min, claims request id 0; asserts user WETH +10, vault WETH −10, oeth.totalSupply −10.
- `it("Fail to claim if not enough liquidity available in the vault")` — MockStrategy set as default; domen mints 100 (auto-allocated to strategy) then mints 1.23 (stays in vault); requests withdrawal of 12.55; after 10 min, `claimWithdrawal(0)` reverts "Queue pending liquidity".
- `it("Fail to request withdrawal of zero amount")` — `requestWithdrawal(0)` reverts "Amount must be greater than 0".
- `it("Should allow every user to withdraw")` — daniel mints 10, requests 10, waits 10 min, claims id 0; asserts vault WETH balance == 0.

**describe: "OETH Vault" > "Config"**
- `it("Should return all strategies")` — asserts `getAllStrategies()` is empty; governor approves fixture `mockStrategy`; asserts `getAllStrategies()` deep-equals `[mockStrategy.address]`.
- `it("Should reset mint whitelist flag when removing a strategy")` — deploys a MockStrategy, calls `setWithdrawAll(weth, vault)` on it, governor approves + `addStrategyToMintWhitelist`; asserts `isMintWhitelistedStrategy` true; governor `removeStrategy`; asserts `isMintWhitelistedStrategy` now false.

**describe: "OETH Vault" > "Remove AMO Strategy"**
- `it("Should allow removing an AMO strategy that has no oToken balance")` — deploys MockAMOStrategy, initializes it with (vault, oeth, weth), governor approves + mint-whitelists it; `removeStrategy` succeeds with zero oToken balance; asserts `isMintWhitelistedStrategy` false afterwards.
- `it("Should allow removing an AMO strategy that calls burnForStrategy in withdrawAll")` — same MockAMOStrategy setup; strategy is impersonated, funded with 5 WETH and mints 5 OETH to itself (asserted == 5); governor `removeStrategy` succeeds even though `withdrawAll` calls `burnForStrategy`; asserts oeth.totalSupply decreased by 5, strategy OETH balance == 0, `isMintWhitelistedStrategy` false.

**describe: "OETH Vault" > "Remove Asset"** (despite the name, tests burnForStrategy / mint whitelist)
- `it("Should allow strategy to burnForStrategy")` — governor funds fixture mockStrategy with 10 WETH, approves + mint-whitelists it; impersonated strategy approves and `mint(10)`; asserts strategy OETH balance == 10; strategy calls `burnForStrategy(10)`; asserts strategy OETH balance == 0.
- `it("Fail when burnForStrategy because amount > int256 ")` — whitelisted impersonated strategy calls `burnForStrategy(10e76)`; reverts "SafeCast: value doesn't fit in an int256".
- `it("Governor should remove strategy from mint whitelist")` — approve + whitelist; asserts flag true; governor `removeStrategyFromMintWhitelist`; asserts `StrategyRemovedFromMintWhitelist` event with (strategy) and flag false.

**describe: "OETH Vault" > "Allocate"**
- `it("Shouldn't allocate as minted amount is lower than autoAllocateThreshold")` — impersonated governor sets `setAutoAllocateThreshold(100)`; daniel mints 10; asserts no `AssetAllocated` event.
- `it("Shouldn't allocate as no WETH available")` — MockStrategy approved + set default (via impersonated governor); daniel mints 10 (all allocated), requests withdrawal of 5; then mints 3 (< 5 queued so `_wethAvailable()` == 0); asserts no `AssetAllocated` event.
- `it("Shouldn't allocate as WETH available is lower than buffer")` — daniel mints 100; governor sets `setVaultBuffer(0.05)` (5%); second mint of 5 (buffer = 105*5% = 5.25) stays in vault; asserts no `AssetAllocated` event.
- `it("Shouldn't allocate as default strategy is address null")` — daniel mints 100 with no default strategy set; asserts no `AssetAllocated` event.

**describe: "OETH Vault" > "Allocate" > "Should allocate WETH available to default strategy when: "** (beforeEach: deploys MockStrategy, impersonated governor approves it and sets as default)
- `it("buffer is 0%, 0 WETH in queue")` — daniel mints 10; asserts `AssetAllocated(weth, strategy, 10)` event and strategy WETH balance == 10.
- `it("buffer is 5%")` — governor sets buffer 5%; daniel mints 10; asserts `AssetAllocated(weth, strategy, 9.5)` and strategy WETH balance == 9.5.
- `it("buffer is 0%, 10 WETH in queue")` — daniel mints 10, requests withdrawal of 10, then mints 20; asserts `AssetAllocated(weth, strategy, 10)` (10 reserved for queue) and strategy WETH balance == 20.
- `it("buffer is 0%, 20 WETH in queue, 10 WETH claimed")` — mints 30, requests 10, waits, impersonated strategy transfers 10 WETH back to vault, claims id 0, requests another 10; then mints 35; asserts `AssetAllocated(weth, strategy, 25)` (10 kept for outstanding queue) and strategy WETH balance == 45.
- `it("buffer is 5%, 20 WETH in queue, 10 WETH claimed")` — mints 40, requests 10, waits, strategy returns 10 WETH, claims id 0, requests another 10; buffer set to 5%; mints 40; asserts `AssetAllocated(weth, strategy, 27)` (10 reserved for queue + 3 buffer) and strategy WETH balance == 57.

**describe: "OETH Vault" > "Withdrawal Queue" > "with all 60 WETH in the vault"** (beforeEach: daniel mints 10, josh 20, matt 30; impersonated governor `setMaxSupplyDiff(0.03)`; constants firstRequestAmount = 5 OETH, secondRequestAmount = 18 OETH)
- `it("Should request first withdrawal by Daniel")` — daniel `requestWithdrawal(5)`; asserts `WithdrawalRequested(daniel, 0, 5, 5)` (requestId 0, queued total 5); assertChangedData: supply/value/checkBalance/user OETH all −5, WETH balances unchanged, queued +5, nextWithdrawalIndex +1.
- `it("Fail to request withdrawal of zero amount")` — reverts "Amount must be greater than 0".
- `it("Should request first and second withdrawals with no WETH in the Vault")` — MockStrategy approved, governor deposits all 60 WETH to it; josh requests 5, matt requests 18; asserts `WithdrawalRequested(matt, 1, 18, 23)`; assertChangedData (user=josh): supply/value/checkBalance −23, josh OETH −5, WETH balances 0, queued +23, nextWithdrawalIndex +2 — requests succeed with zero vault WETH.
- `it("Should request second withdrawal by matt")` — after daniel's request of 5, matt requests 18; asserts `WithdrawalRequested(matt, 1, 18, 23)`; assertChangedData (user=matt): supply/value/checkBalance/matt OETH −18, queued +18, nextWithdrawalIndex +1.
- `it("Should add claimable liquidity to the withdrawal queue")` — after both requests (5+18), josh calls `addWithdrawalQueueLiquidity()`; asserts `WithdrawalClaimable(23, 23)` event; assertChangedData: only claimable +23, everything else unchanged.
- `it("Should claim second request with enough liquidity")` — requests 5 (daniel) and 18 (josh, id 1); after 10 min josh `claimWithdrawal(1)`; asserts `WithdrawalClaimed(josh, 1, 18)` and `WithdrawalClaimable(23, 23)`; assertChangedData: josh WETH +18, vault WETH −18, claimable +23, claimed +18; supply/value unchanged (burn happened at request time).
- `it("Should claim multiple requests with enough liquidity")` — matt requests 5 and 18; after 10 min `claimWithdrawals([0,1])`; asserts `WithdrawalClaimed(matt, 0, 5)`, `WithdrawalClaimed(matt, 1, 18)`, and `WithdrawalClaimable(23, 23)`; assertChangedData: matt WETH +23, vault WETH −23, claimable +23, claimed +23.
- `it("Should claim single big request as a whale")` — matt requests his full 30 OETH (50% of supply); asserts matt OETH went 30 → 0 and totalValue dropped by 30 at request time; after 10 min claims id 0; asserts `WithdrawalClaimed(matt, 0, 30)` and that totalSupply and totalValue are unchanged by the claim itself.
- `it("Fail to claim request because of not enough time passed")` — daniel requests 5 then claims id 0 immediately; reverts "Claim delay not met".
- `it("Fail to request withdrawal because of solvency check too high")` — daniel donates 10 WETH directly to the vault (assets > supply beyond 3% maxSupplyDiff); `requestWithdrawal(5)` reverts "Backing supply liquidity error".
- `it("Fail to claim request because of solvency check too high")` — daniel requests 5, then donates 10 WETH to vault, waits 10 min; `claimWithdrawal(0)` reverts "Backing supply liquidity error".
- `it("Fail multiple claim requests because of solvency check too high")` — matt requests 5 and 18, donates 10 WETH to vault, waits; `claimWithdrawals([0,1])` reverts "Backing supply liquidity error".
- `it("Fail request withdrawal because of solvency check too low")` — impersonated vault transfers 10 WETH out to daniel (simulated loss); daniel's `requestWithdrawal(5)` reverts "Backing supply liquidity error".

**describe: "OETH Vault" > "Withdrawal Queue" > "with all 60 WETH in the vault" > "when deposit 15 WETH to a strategy, leaving 60 - 15 = 45 WETH in the vault; request withdrawal of 5 + 18 = 23 OETH, leaving 45 - 23 = 22 WETH unallocated"** (beforeEach: MockStrategy with `setWithdrawAll(weth, vault)` approved; governor `depositToStrategy` 15 WETH; daniel requests 5 and josh requests 18)
- `it("Fail to deposit allocated WETH to a strategy")` — `depositToStrategy` of 23 WETH (> 22 unallocated) reverts "Not enough assets available".
- `it("Fail to deposit allocated WETH during allocate")` — governor sets strategy as default and buffer to 10%, calls `allocate()`; asserts (approxEqual) strategy WETH ≈ 33.3 (15 + 90% of the 37 unreserved) and vault WETH ≈ 26.7 (23 reserved for queue + 10%·37 = 3.7 buffer).
- `it("Should deposit unallocated WETH to a strategy")` — `depositToStrategy` of exactly 22 WETH succeeds (no revert; no further assertion).
- `it("Should claim first request with enough liquidity")` — after 10 min daniel `claimWithdrawal(0)`; asserts `WithdrawalClaimed(daniel, 0, 5)`; assertChangedData: daniel WETH +5, vault WETH −5, claimable +23, claimed +5.
- `it("Should claim a new request with enough WETH liquidity")` — `addWithdrawalQueueLiquidity()` first; matt requests the whole 22 unallocated WETH (id 2); after 10 min claims id 2; asserts `WithdrawalClaimed(matt, 2, 22)`; assertChangedData: matt WETH +22, vault WETH −22, claimable +22, claimed +22.
- `it("Fail to claim a new request with NOT enough WETH liquidity")` — matt requests 23 (1 more than the 22 unallocated); after 10 min `claimWithdrawal(2)` reverts "Queue pending liquidity".
- `it("Should claim a new request after withdraw from strategy adds enough liquidity")` — matt requests 30 (8 WETH short); strategist `withdrawFromStrategy(strategy, [weth], [8])`; assertChangedData after the withdraw: vault WETH +8, claimable +30, all else 0; after 10 min matt claims id 2 successfully.
- `it("Should claim a new request after withdrawAllFromStrategy adds enough liquidity")` — same 30-OETH request; strategist `withdrawAllFromStrategy(strategy)`; assertChangedData: vault WETH + (entire prior strategy balance, 15), claimable +30; after 10 min claim id 2 succeeds.
- `it("Should claim a new request after withdrawAll from strategies adds enough liquidity")` — same setup but strategist calls `withdrawAllFromStrategies()`; identical delta assertions (vault WETH + strategy balance, claimable +30); claim id 2 succeeds.
- `it("Fail to claim a new request after mint with NOT enough liquidity")` — matt requests 30; daniel mints only 6 (28 < 30 needed); after 10 min `claimWithdrawal(2)` reverts "Queue pending liquidity".
- `it("Should claim a new request after mint adds enough liquidity")` — matt requests 30; daniel mints 8; assertChangedData for the mint: supply/value/checkBalance/daniel OETH +8, daniel WETH −8, vault WETH +8, claimable +30; after 10 min matt claims id 2 successfully.

**describe: "OETH Vault" > "Withdrawal Queue" > "with all 60 WETH in the vault" > "Fail when"**
- `it("request doesn't have enough OETH")` — josh requests his OETH balance + 1 wei; reverts "Transfer amount exceeds balance".
- `it("capital is paused")` — governor `pauseCapital()`; josh's `requestWithdrawal(5)` reverts "Capital paused".

**describe: "OETH Vault" > "Withdrawal Queue" > "with 1% vault buffer, 30 WETH in the queue, 15 WETH in the vault, 85 WETH in the strategy, 5 WETH already claimed"** (beforeEach: mints 15/20/30/40 to daniel/josh/matt/domen (105 OETH); `setMaxSupplyDiff(0.03)`; daniel+josh request 2+3, wait, and claim ids 0 and 1 (5 claimed); MockStrategy approved and 85 WETH deposited; buffer set to 1%; new requests of 4 (daniel, id 2), 12 (josh, id 3), 16 (matt, id 4) = 32 outstanding; `addWithdrawalQueueLiquidity()` called)
- **"Fail to claim"**:
  - `it("a previously claimed withdrawal")` — daniel re-claims id 0; reverts "Already claimed".
  - `it("the first withdrawal with wrong withdrawer")` — after 10 min matt claims daniel's id 2; reverts "Not requester".
  - `it("the first withdrawal request in the queue before 30 minutes")` — daniel claims id 2 with no delay; reverts "Claim delay not met".
- **"when waited 30 minutes"** (beforeEach advances the 10-min delay):
  - `it("Fail to claim the first withdrawal with wrong withdrawer")` — matt claims id 2; reverts "Not requester".
  - `it("Should claim the first withdrawal request in the queue after 30 minutes")` — daniel claims id 2; asserts `WithdrawalClaimed(daniel, 2, 4)`; assertChangedData: daniel WETH +4, vault WETH −4, claimed +4, all else 0.
  - `it("Fail to claim the second withdrawal request in the queue after 30 minutes")` — josh claims id 3; reverts "Queue pending liquidity" (only 15 WETH in vault vs 32 queued − 5 claimed).
  - `it("Fail to claim the last (3rd) withdrawal request in the queue")` — matt claims id 4; reverts "Queue pending liquidity".
- **"when mint covers exactly outstanding requests (32 - 15 = 17 OETH)"** (beforeEach: daniel mints 17, then 10-min delay):
  - `it("Should claim the 2nd and 3rd withdrawal requests in the queue")` — daniel claims id 2 (asserts `WithdrawalClaimed(daniel, 2, 4)`) and josh claims id 3 (asserts `WithdrawalClaimed(josh, 3, 12)`); combined assertChangedData (user=daniel): daniel WETH +4, vault WETH −16, claimed +16, all else 0.
  - `it("Fail to deposit 1 WETH to a strategy")` — `depositToStrategy` of 1 WETH reverts "Not enough assets available" (everything reserved for the queue).
  - `it("Fail to allocate any WETH to the default strategy")` — `allocate()` emits no `AssetAllocated`.
- **"when mint covers exactly outstanding requests and vault buffer (17 + 1 WETH)"** (beforeEach: daniel mints 18):
  - `it("Should deposit 1 WETH to a strategy which is the vault buffer")` — `depositToStrategy` of 1 WETH succeeds; asserts WETH `Transfer(vault, strategy, 1)` event.
  - `it("Fail to deposit 1.1 WETH to the default strategy")` — deposit of 1.1 WETH reverts "Not enough assets available".
  - `it("Fail to allocate any WETH to the default strategy")` — `allocate()` emits no `AssetAllocated` (available WETH ≤ buffer).
- **"when mint more than covers outstanding requests and vault buffer (17 + 1 + 3 = 21 OETH)"** (beforeEach: daniel mints 21):
  - `it("Should deposit 4 WETH to a strategy")` — deposit of 4 WETH succeeds; asserts WETH `Transfer(vault, strategy, 4)` event.
  - `it("Fail to deposit 5 WETH to the default strategy")` — deposit of 5 WETH reverts "Not enough assets available".
  - `it("Should allocate 3 WETH to the default strategy")` — strategy set as default; `allocate()` emits `AssetAllocated(weth, strategy, 3.11)` (supply 68+21=89, 1% buffer = 0.89, so 4 − 0.89 = 3.11); asserts vault WETH −3.11 and strategy WETH +3.11 exactly.

**describe: "OETH Vault" > "Withdrawal Queue" > "with 40 WETH in the queue, 10 WETH in the vault, 30 WETH already claimed"** (beforeEach: mints 10/20/10 to daniel/josh/matt; daniel requests 10, josh requests 20; after 10-min delay both claim ids 0 and 1 — 30 WETH claimed, 10 WETH left)
- `it("Should allow the last user to request the remaining 10 WETH")` — matt requests 10; asserts `WithdrawalRequested(matt, 2, 10, 40)` (cumulative queued 40); assertChangedData: supply/value/checkBalance/matt OETH −10, queued +10, nextWithdrawalIndex +1.
- `it("Should allow the last user to claim the request of 10 WETH")` — matt requests 10, waits, claims id 2; asserts `WithdrawalClaimed(matt, 2, 10)`; assertChangedData: matt WETH +10, vault WETH −10, claimable +10, claimed +10; also asserts final `totalValue()` == 0 (vault fully drained).

**describe: "OETH Vault" > "Withdrawal Queue" > "with 40 WETH in the queue, 100 WETH in the vault, 0 WETH in the strategy"** (beforeEach: mints 10/20/70 to daniel/josh/matt; matt requests 40; 10-min delay)
- `it("Should allow user to claim the request of 40 WETH")` — matt claims id 0; asserts `WithdrawalClaimed(matt, 0, 40)`; assertChangedData: matt WETH +40, vault WETH −40, claimable +40, claimed +40.
- `it("Should allow user to perform a new request and claim a smaller than the WETH available")` — josh requests 20 (id 1), waits, claims id 1; asserts a `WithdrawalClaimed` event is emitted.
- `it("Should allow user to perform a new request and claim exactly the WETH available")` — matt claims id 0 (40), josh and daniel transfer their 20+10 OETH to matt; matt requests the remaining 60 (id 1), waits, claims; asserts `WithdrawalClaimed(matt, 1, 60)`; assertChangedData: matt WETH +60, vault WETH −60, claimable +60, claimed +60.
- `it("Shouldn't allow user to perform a new request and claim more than the WETH available")` — same 60-OETH consolidation and request; then impersonated vault burns 50 WETH to `addresses.dead` (simulated loss); `claimWithdrawal(1)` reverts "Queue pending liquidity".

**describe: "OETH Vault" > "Withdrawal Queue" > "with 40 WETH in the queue, 15 WETH in the vault, 44 WETH in the strategy, vault insolvent by 5% => Slash 1 ether (1/20 = 5%), 19 WETH total value"** (beforeEach: MockStrategy approved + set default; mints 10/20/30 to daniel/josh/matt — all auto-allocated; requests of 10 (daniel, id 0), 20 (josh, id 1), 10 (matt, id 2); 10-min delay; impersonated strategy burns 1 WETH to dead address (slash); strategist `withdrawFromStrategy` 15 WETH back to vault; `addWithdrawalQueueLiquidity()`)
- `it("Should allow first user to claim the request of 10 WETH")` — daniel claims id 0; asserts `WithdrawalClaimed(daniel, 0, 10)`; assertChangedData: daniel WETH +10, vault WETH −10, claimed +10, all else 0 (maxSupplyDiff is 0 = check off).
- `it("Fail to allow second user to claim the request of 20 WETH, due to liquidity")` — josh claims id 1; reverts "Queue pending liquidity" (only 15 WETH claimable).
- `it("Should allow a user to create a new request with solvency check off")` — matt requests 10; asserts `WithdrawalRequested(matt, 3, 10, 50)`; assertChangedData: supply/value/checkBalance/matt OETH −10, queued +10, nextWithdrawalIndex +1 — succeeds despite the 5% insolvency because maxSupplyDiff is 0.
- **"with solvency check at 3%"** (beforeEach: `setMaxSupplyDiff(0.03)`):
  - `it("Fail to allow user to create a new request due to insolvency check")` — matt `requestWithdrawal(1)` reverts "Backing supply liquidity error" (5% insolvency > 3% tolerance).
  - `it("Fail to allow first user to claim a withdrawal due to insolvency check")` — after delay, daniel `claimWithdrawal(0)` reverts "Backing supply liquidity error".
- **"with solvency check at 10%"** (beforeEach: `setMaxSupplyDiff(0.1)`):
  - `it("Should allow user to create a new request")` — matt requests 1; asserts `WithdrawalRequested(matt, 3, 1, 41)` (5% insolvency < 10% tolerance).
  - `it("Should allow first user to claim the request of 10 WETH")` — daniel claims id 0; asserts `WithdrawalClaimed(daniel, 0, 10)`.

**describe: "OETH Vault" > "Withdrawal Queue" > "with 99 WETH in the queue, 40 WETH in the vault, total supply 1, 1% insolvency buffer"** (beforeEach: MockStrategy approved + set default; mints 20/30/50 to daniel/josh/matt (100 OETH, auto-allocated); requests 20 + 30 + 49 = 99 (ids 0–2, supply left = 1 OETH); 10-min delay; strategist withdraws 40 WETH from strategy to vault; `addWithdrawalQueueLiquidity()`; `setMaxSupplyDiff(0.01)`)
- **"with 2 ether slashed leaving 100 - 40 - 2 = 58 WETH in the strategy"** (beforeEach: impersonated strategy burns 2 WETH to dead address):
  - `it("Should have total value of zero")` — `totalValue()` == 0 (100 − 99 queued − 2 slashed = −1, floored to 0).
  - `it("Should have check balance of zero")` — `checkBalance(weth)` == 0 for the same reason.
  - `it("Fail to allow user to create a new request due to too many outstanding requests")` — matt `requestWithdrawal(1)` reverts "Too many outstanding requests" (queued exceeds assets).
  - `it("Fail to allow first user to claim a withdrawal due to too many outstanding requests")` — after delay, daniel `claimWithdrawal(0)` reverts "Too many outstanding requests".
- **"with 1 ether slashed leaving 100 - 40 - 1 = 59 WETH in the strategy"** (beforeEach: strategy burns 1 WETH):
  - `it("Should have total value of zero")` — `totalValue()` == 0 (100 − 99 − 1 = exactly 0).
  - `it("Fail to allow user to create a new request due to too many outstanding requests")` — `requestWithdrawal(1)` reverts "Too many outstanding requests".
  - `it("Fail to allow first user to claim a withdrawal due to too many outstanding requests")` — after delay, `claimWithdrawal(0)` reverts "Too many outstanding requests".
- **"with 0.02 ether slashed leaving 100 - 40 - 0.02 = 59.98 WETH in the strategy"** (beforeEach: strategy burns 0.02 WETH):
  - `it("Should have total value of zero")` — despite the name, asserts `totalValue()` == 0.98 (100 − 99 − 0.02).
  - `it("Fail to allow user to create a new 1 WETH request due to too many outstanding requests")` — `requestWithdrawal(1)` reverts "Too many outstanding requests" (1 > 0.98 available).
  - `it("Fail to allow user to create a new 0.01 WETH request due to insolvency check")` — `requestWithdrawal(0.01)` passes the outstanding-requests check but reverts "Backing supply liquidity error" (supply/assets ratio 1/0.98 ≈ 1.0204 exceeds 1% maxSupplyDiff).
  - `it("Fail to allow first user to claim a withdrawal due to insolvency check")` — after delay, `claimWithdrawal(0)` reverts "Backing supply liquidity error" (same 1/0.98 > 1% diff).

### `test/vault/oeth-vault.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `createFixtureLoader(oethDefaultFixture)` from `test/_fixture.js` against a mainnet fork; retries 3x on CI, `this.timeout(0)`. Contracts under test: deployed `oethVault`, `oeth`, `woeth`, `oethHarvester`, real `weth`; impersonates the OETH whale (`addresses.mainnet.oethWhaleAddress`). A local helper `depositDiffInWeth(fixture, depositor)` mints 110% of `(queued − claimed)` WETH into the vault when the queue has a shortfall, so claims can succeed.

**describe: "ForkTest: OETH Vault" > "post deployment"**
- `it("Should have the correct governor address set")` — loops over [oethVault, oeth, woeth, oethHarvester] and asserts `governor()` == `addresses.mainnet.Timelock` for each.

**describe: "ForkTest: OETH Vault" > "user operations"** (beforeEach impersonates and funds the OETH whale)
- `it("should mint with 1 WETH then no allocation")` — josh approves and mints 1 WETH; asserts `Mint(josh, 1e18)` event (tx logged with `logTxDetails`; the "no allocation" behavior is not explicitly asserted).
- `it("should mint with 11 WETH then auto allocate")` — josh approves and mints 11 WETH; asserts `Mint(josh, 11e18)` event (auto-allocation itself not asserted).
- `it("should mint with WETH and allocate to strategy")` — identical body to the previous test: mints 11 WETH; asserts `Mint(josh, 11e18)` event.
- `it("should request a withdraw by OETH whale")` — asserts whale OETH balance > 100 OETH; reads `nextWithdrawalIndex` as the expected requestId; whale `requestWithdrawal(fullBalance)`; asserts `WithdrawalRequested` event with named args `_withdrawer` = whale, `_amount` = whale balance, `_requestId` = the pre-read index.
- `it("should claim withdraw by a OETH whale")` — calls `depositDiffInWeth(fixture, matt)` to plug any queue shortfall; computes `available = vaultWETH + claimed − queued` and, if the whale's balance exceeds it, domen transfers the difference in WETH to the vault; asserts whale balance > 100 OETH; whale requests exactly 50 OETH, waits the 10-min delay, then claims; asserts `WithdrawalClaimed(whaleAddress, requestId, 50 OETH)` where requestId was the pre-request `nextWithdrawalIndex`.
- `it("OETH whale can redeem after withdraw from all strategies")` — asserts whale balance > 1000 OETH; `depositDiffInWeth(fixture, matt)`; timelock calls `withdrawAllFromStrategies()`; whale requests full balance, waits 10 min, and claims the request (success asserted implicitly — no revert).
- `it("Vault should have the right WETH address")` — asserts `oethVault.asset()` (lowercased) == `addresses.mainnet.WETH`.

**describe: "ForkTest: OETH Vault" > "operations"**
- `it("should rebase")` — strategist calls `oethVault.rebase()`; only asserts the tx succeeds (logged via `logTxDetails`).

---

# Vault mint / redeem / rebase (unit)

## Vault mint / redeem / rebase (unit)

This section covers the OUSD Vault's user-facing capital lifecycle unit tests: capital pausing gates on `mint`, the async withdrawal-queue redemption flow (`requestWithdrawal` / `claimWithdrawal(s)` / `addWithdrawalQueueLiquidity`, including solvency checks, claim delay, vault-buffer/allocation interaction, and slashing/insolvency scenarios), and `rebase` (pause flags, operator/strategist/governor permissioning, yield distribution to rebasing vs non-rebasing accounts, and trustee fee accrual). All three files are unit tests against the mock-based default fixture (`test/_fixture.js`), where the vault is the OUSD Vault with mock USDC as sole collateral and Matt + Josh each pre-minted 100 OUSD.

Files covered:
- `test/vault/redeem.js` (66 tests)
- `test/vault/deposit.js` (6 tests)
- `test/vault/rebase.js` (23 runtime tests; 18 static + 5 loop-generated)

---

### `test/vault/redeem.js` — unit test (mainnet/hardhat)

Context: uses `loadDefaultFixture()` from `test/_fixture.js`; contracts under test are the OUSD `Vault` (VaultCore/VaultAdmin withdrawal-queue logic), `OUSD` token, mock `USDC`, and `MockStrategy` (deployed ad hoc via `deployWithConfirmation`). Two shared helpers drive most assertions: `snapData` snapshots {ousd.totalSupply, vault.totalValue, vault.checkBalance(USDC), user OUSD, user USDC, vault USDC, withdrawalQueueMetadata (queued/claimable/claimed/nextWithdrawalIndex)}; `assertChangedData` asserts each of those equals before + an exact expected delta (exact equality, no tolerance). The top-level `beforeEach` of "Withdrawal Queue" first drains the fixture's initial Matt/Josh 100-OUSD mints via requestWithdrawal ids 0 and 1, advances 10 minutes (`delayPeriod`), and claims both — so all subsequent request ids start at 2. Does not consume any `test/behaviour/` suite.

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with all 60 USDC in the vault"**

Setup (beforeEach): mint mock USDC to daniel/josh/matt (10/20/30), approve + `vault.mint` giving them 10/20/30 OUSD (60 total); governor (impersonated via `impersonateAndFund(vault.governor())`) sets `setMaxSupplyDiff(0.03e18)` (3%). Constants: first request = 5 OUSD/USDC, second = 18 OUSD/USDC.

- `it("Should request first withdrawal by Daniel")` — Daniel `requestWithdrawal(5 OUSD)`; asserts `WithdrawalRequested` event with args (daniel, requestId 2, 5 OUSD, queued 205 USDC = 100+100+5); exact deltas: totalSupply −5 OUSD, totalValue −5 OUSD, checkBalance(USDC) −5 USDC, Daniel OUSD −5, user/vault USDC unchanged, queue.queued +5 USDC, claimable/claimed +0, nextWithdrawalIndex +1.
- `it("Should revert withdrawal of zero amount")` — `requestWithdrawal(0)` reverts with exact string `"Amount must be greater than 0"`.
- `it("Should request first and second withdrawals with no USDC in the Vault")` — governor approves a `MockStrategy` and `depositToStrategy` all 60 USDC (vault holds 0 USDC); Josh requests 5 OUSD then Matt requests 18 OUSD; asserts `WithdrawalRequested` (matt, id 3, 18 OUSD, queued 223 USDC); deltas: totalSupply/totalValue −23 OUSD, checkBalance −23 USDC, Josh OUSD −5, USDC balances unchanged, queued +23 USDC, nextWithdrawalIndex +2 — i.e. requests succeed even with zero vault liquidity.
- `it("Should request second withdrawal by matt")` — after Daniel's 5-OUSD request, Matt requests 18 OUSD; asserts `WithdrawalRequested` (matt, id 3, 18 OUSD, queued 223 USDC); deltas measured from after Daniel's request: totalSupply/totalValue −18 OUSD, checkBalance −18 USDC, Matt OUSD −18, queued +18 USDC, nextWithdrawalIndex +1.
- `it("Should add claimable liquidity to the withdrawal queue")` — after 5 + 18 OUSD requests, Josh calls `addWithdrawalQueueLiquidity()`; asserts `WithdrawalClaimable` event with args (total claimable 223 USDC, newly-claimable 23 USDC); deltas: only queue.claimable +23 USDC, everything else +0.
- `it("Should claim second request with enough liquidity")` — after both requests and 10-min delay, Josh `claimWithdrawal(3)`; asserts `WithdrawalClaimed` (josh, 3, 18 OUSD) and `WithdrawalClaimable` (223 USDC, 23 USDC); deltas: Josh USDC +18, vault USDC −18, claimable +23 USDC, claimed +18 USDC, supply/value/checkBalance/queued/nextIndex +0.
- `it("Should claim multiple requests with enough liquidity")` — Matt makes both requests (ids 2, 3), waits 10 min, calls `claimWithdrawals([2,3])`; asserts two `WithdrawalClaimed` events (matt, 2, 5 OUSD) and (matt, 3, 18 OUSD) plus `WithdrawalClaimable` (223, 23); deltas: Matt USDC +23, vault USDC −23, claimable +23, claimed +23, all else +0.
- `it("Should claim single big request as a whale")` — Matt requests his full 30 OUSD; asserts Matt OUSD went 30 → 0 exactly and totalValue dropped exactly 30 OUSD; after 10-min delay, `claimWithdrawal(2)` emits `WithdrawalClaimed` (matt, 2, 30 OUSD); asserts totalSupply and totalValue are unchanged by the claim itself.
- `it("Fail to claim request because of not enough time passed")` — Daniel requests 5 OUSD (id 2) and claims in the same block; reverts with `"Claim delay not met"`.
- `it("Fail to request withdrawal because of solvency check too high")` — 10 USDC (note: minted as `ousdUnits("10")`, i.e. a huge 1e19-unit USDC donation) transferred directly to the vault inflates assets above supply beyond the 3% maxSupplyDiff; Daniel's `requestWithdrawal(5 OUSD)` reverts with `"Backing supply liquidity error"`.
- `it("Fail to claim request because of solvency check too high")` — Daniel requests 5 OUSD first, then the vault receives the same direct USDC donation; after 10-min delay, `claimWithdrawal(2)` reverts with `"Backing supply liquidity error"`.
- `it("Fail multiple claim requests because of solvency check too high")` — Matt requests 5 and 18 OUSD (ids 2, 3), vault gets the direct USDC donation, after delay `claimWithdrawals([2,3])` reverts with `"Backing supply liquidity error"`.
- `it("Fail request withdrawal because of solvency check too low")` — simulates loss: impersonated vault address transfers 10 USDC out to Daniel; Daniel's `requestWithdrawal(5 OUSD)` reverts with `"Backing supply liquidity error"`.

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with all 60 USDC in the vault" > "when deposit 15 USDC to a strategy, leaving 60 - 15 = 45 USDC in the vault; request withdrawal of 5 + 18 = 23 OUSD, leaving 45 - 23 = 22 USDC unallocated"**

Setup (beforeEach): deploy `MockStrategy`, call `mockStrategy.setWithdrawAll(usdc, vault)`, governor `approveStrategy` + `depositToStrategy` 15 USDC; Daniel requests 5 OUSD (id 2), Josh requests 18 OUSD (id 3). Vault holds 45 USDC; 22 USDC unreserved.

- `it("Fail to deposit allocated USDC to a strategy")` — governor `depositToStrategy` of 23 USDC (> 22 unallocated) reverts with `"Not enough assets available"`.
- `it("Fail to deposit allocated USDC during allocate")` — governor sets mock strategy as default strategy and vault buffer to 10% (`setVaultBuffer(0.1e18)`), then `allocate()`; asserts strategy USDC ≈ 33.3 USDC (90% of the 37 unreserved = 60−23) and vault USDC ≈ 23 + 3.7 = 26.7 USDC (reserved queue liquidity + 10% buffer), both via `approxEqual`.
- `it("Should deposit unallocated USDC to a strategy")` — governor `depositToStrategy` of exactly 22 USDC succeeds (no revert; no further assertions).
- `it("Should claim first request with enough liquidity")` — after 10-min delay Daniel `claimWithdrawal(2)`; asserts `WithdrawalClaimed` (daniel, 2, 5 OUSD); deltas: Daniel USDC +5, vault USDC −5, claimable +23 USDC (auto-added on claim), claimed +5 USDC, all else +0.
- `it("Should claim a new request with enough USDC liquidity")` — `addWithdrawalQueueLiquidity()` first, then Matt requests exactly the 22 remaining unallocated OUSD (id 4); after delay `claimWithdrawal(4)` emits `WithdrawalClaimed` (matt, 4, 22 OUSD); deltas: Matt USDC +22, vault USDC −22, claimable +22 USDC, claimed +22 USDC (queue values divided by 1e12 for 6-decimals), all else +0.
- `it("Fail to claim a new request with NOT enough USDC liquidity")` — Matt requests 23 OUSD (1 more than the 22 unallocated, id 4); after delay `claimWithdrawal(4)` reverts with `"Queue pending liquidity"`.
- `it("Should claim a new request after withdraw from strategy adds enough liquidity")` — `addWithdrawalQueueLiquidity()`, Matt requests his full 30 OUSD (8 USDC short, id 4); strategist `withdrawFromStrategy(mockStrategy, [usdc], [8 USDC])`; asserts deltas after the strategy withdrawal: vault USDC +8, claimable +30 USDC, all supply/value/user deltas +0; then after delay `claimWithdrawal(4)` succeeds.
- `it("Should claim a new request after withdrawAllFromStrategy adds enough liquidity")` — same 30-OUSD request scenario; strategist `withdrawAllFromStrategy(mockStrategy)`; deltas: vault USDC + (strategy's full prior balance), claimable +30 USDC, else +0; then `claimWithdrawal(4)` succeeds after delay.
- `it("Should claim a new request after withdrawAll from strategies adds enough liquidity")` — same scenario via `withdrawAllFromStrategies()`; identical delta assertions (vault USDC + full strategy balance, claimable +30 USDC); `claimWithdrawal(4)` succeeds after delay.
- `it("Fail to claim a new request after mint with NOT enough liquidity")` — Matt requests 30 OUSD; Daniel mints only 6 USDC (unallocated becomes 28 < 30); after delay `claimWithdrawal(4)` reverts with `"Queue pending liquidity"`.
- `it("Should claim a new request after mint adds enough liquidity")` — `addWithdrawalQueueLiquidity()`, Matt requests 30 OUSD; Daniel mints 8 USDC; asserts mint deltas: totalSupply/totalValue +8 OUSD, checkBalance +8 USDC, Daniel OUSD +8, Daniel USDC −8, vault USDC +8, claimable +30 USDC, queued/claimed/nextIndex +0; then `claimWithdrawal(4)` succeeds after delay.

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with all 60 USDC in the vault" > "Fail when"**

- `it("request doesn't have enough OUSD")` — Josh calls `requestWithdrawal(balance + 1)`; reverts with `"Transfer amount exceeds balance"`.
- `it("capital is paused")` — governor `pauseCapital()`; Josh's `requestWithdrawal(5 OUSD)` reverts with `"Capital paused"`.

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with 1% vault buffer, 30 USDC in the queue, 15 USDC in the vault, 85 USDC in the strategy, 5 USDC already claimed"**

Setup (beforeEach): mint USDC 15/20/30/40 to daniel/josh/matt/domen, all `vault.mint` (105 OUSD minted); governor sets `maxSupplyDiff` 3%; Daniel requests 2 OUSD (id 2) and Josh 3 OUSD (id 3), both claimed after 10-min delay (5 USDC claimed); deploy + approve `MockStrategy`, deposit 85 USDC to it; `setVaultBuffer(0.01e18)` (1%); then three outstanding requests: Daniel 4 (id 4), Josh 12 (id 5), Matt 16 OUSD (id 6) = 32 USDC outstanding, supply 68 OUSD; `addWithdrawalQueueLiquidity()` called.

- describe "Fail to claim":
  - `it("a previously claimed withdrawal")` — Daniel `claimWithdrawal(2)` (already claimed in setup) reverts with `"Already claimed"`.
  - `it("the first withdrawal with wrong withdrawer")` — after 10-min delay, Matt tries to claim Daniel's id 2; reverts with `"Not requester"`.
  - `it("the first withdrawal request in the queue before 30 minutes")` — Daniel `claimWithdrawal(4)` with no delay; reverts with `"Claim delay not met"` (describe title says 30 minutes but the coded delay is the 10-minute `delayPeriod`).
- describe "when waited 30 minutes" (beforeEach: `advanceTime(delayPeriod)` — 10 minutes):
  - `it("Fail to claim the first withdrawal with wrong withdrawer")` — Matt claims id 4 (Daniel's); reverts with `"Not requester"`.
  - `it("Should claim the first withdrawal request in the queue after 30 minutes")` — Daniel `claimWithdrawal(4)`; asserts `WithdrawalClaimed` (daniel, 4, 4 OUSD); deltas: Daniel USDC +4, vault USDC −4, claimed +4 USDC, claimable +0 (already added in setup), all else +0.
  - `it("Fail to claim the second withdrawal request in the queue after 30 minutes")` — Josh `claimWithdrawal(5)` (12 USDC, only ~15 in vault but queue claimable insufficient); reverts with `"Queue pending liquidity"`.
  - `it("Fail to claim the last (3rd) withdrawal request in the queue")` — Matt `claimWithdrawal(6)`; reverts with `"Queue pending liquidity"`.
- describe "when mint covers exactly outstanding requests (32 - 15 = 17 OUSD)" (beforeEach: Daniel mints 17 USDC, then 10-min delay):
  - `it("Should claim the 2nd and 3rd withdrawal requests in the queue")` — Daniel claims id 4 (event `WithdrawalClaimed` (daniel, 4, 4 OUSD)) and Josh claims id 5 (event (josh, 5, 12 OUSD)); combined deltas from before both claims: Daniel USDC +4, vault USDC −16, claimed +16 USDC, all else +0.
  - `it("Fail to deposit 1 USDC to a strategy")` — all vault USDC is reserved for the queue, so governor `depositToStrategy(1 USDC)` reverts with `"Not enough assets available"`.
  - `it("Fail to allocate any USDC to the default strategy")` — `allocate()` succeeds but asserts it does NOT emit `AssetAllocated`.
- describe "when mint covers exactly outstanding requests and vault buffer (17 + 1 USDC)" (beforeEach: Daniel mints 18 USDC):
  - `it("Should deposit 1 USDC to a strategy which is the vault buffer")` — governor `depositToStrategy(1 USDC)` succeeds; expects USDC `Transfer` event vault → strategy of 1 USDC (note: `expect(tx)` without await, weak assertion).
  - `it("Fail to deposit 1.1 USDC to the default strategy")` — `depositToStrategy(1.1 USDC)` reverts with `"Not enough assets available"`.
  - `it("Fail to allocate any USDC to the default strategy")` — `allocate()` asserts no `AssetAllocated` event (the surplus equals the 1% buffer, so nothing to allocate).
- describe "when mint more than covers outstanding requests and vault buffer (17 + 1 + 3 = 21 OUSD)" (beforeEach: Daniel mints 21 USDC):
  - `it("Should deposit 4 USDC to a strategy")` — `depositToStrategy(4 USDC)` succeeds; expects USDC `Transfer` vault → strategy of 4 USDC (again non-awaited `expect(tx)`).
  - `it("Fail to deposit 5 USDC to the default strategy")` — `depositToStrategy(5 USDC)` reverts with `"Not enough assets available"`.
  - `it("Should allocate 3 USDC to the default strategy")` — governor sets default strategy, then Domen calls `allocate()`; asserts `AssetAllocated` event (usdc, mockStrategy, 3.11 USDC) — supply is 68+21=89 OUSD, 1% buffer = 0.89, so 4 − 0.89 = 3.11 USDC allocated; asserts vault USDC decreased and strategy USDC increased by exactly 3.11 USDC.

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with 40 USDC in the queue, 10 USDC in the vault, 30 USDC already claimed"**

Setup (beforeEach): mint/approve/mint-OUSD 10/20/10 USDC for daniel/josh/matt (60 OUSD); Daniel requests 10 (id 2) and Josh 20 OUSD (id 3), after 10-min delay both claim (30 USDC claimed, 10 USDC left in vault).

- `it("Should allow the last user to request the remaining 10 USDC")` — Matt `requestWithdrawal(10 OUSD)`; asserts `WithdrawalRequested` (matt, 4, 10 OUSD, queued 240 USDC = 110+100+10+20+10); deltas: totalSupply/totalValue −10 OUSD, checkBalance −10 USDC, Matt OUSD −10, queued +10 USDC, nextWithdrawalIndex +1, USDC balances unchanged.
- `it("Should allow the last user to claim the request of 10 USDC")` — Matt requests 10 OUSD then claims id 4 after delay; asserts `WithdrawalClaimed` (matt, 4, 10 OUSD); deltas: Matt USDC +10, vault USDC −10, claimable +10, claimed +10, else +0; final assertion `vault.totalValue()` equals exactly 0 (vault fully drained).

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with 40 USDC in the queue, 100 USDC in the vault, 0 USDC in the strategy"**

Setup (beforeEach): mint/approve/mint-OUSD 10/20/70 for daniel/josh/matt (100 OUSD); Matt requests 40 OUSD (id 2); 10-min delay.

- `it("Should allow user to claim the request of 40 USDC")` — Matt `claimWithdrawal(2)`; asserts `WithdrawalClaimed` (matt, 2, 40 OUSD); deltas: Matt USDC +40, vault USDC −40, claimable +40, claimed +40, else +0.
- `it("Should allow user to perform a new request and claim a smaller than the USDC available")` — Josh requests 20 OUSD (id 3), waits, claims; only asserts a `WithdrawalClaimed` event is emitted.
- `it("Should allow user to perform a new request and claim exactly the USDC available")` — Matt claims id 2 (40 USDC out), Josh and Daniel transfer their 20 + 10 OUSD to Matt, Matt requests the entire remaining 60 OUSD supply (id 3), waits, claims; asserts `WithdrawalClaimed` (matt, 3, 60 OUSD); deltas: Matt USDC +60, vault USDC −60, claimable +60, claimed +60, else +0.
- `it("Shouldn't allow user to perform a new request and claim more than the USDC available")` — same setup but before the claim the impersonated vault transfers 50 USDC out (simulated loss); Matt's `claimWithdrawal(3)` reverts with `"Queue pending liquidity"`.

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with 40 USDC in the queue, 15 USDC in the vault, 44 USDC in the strategy, vault insolvent by 5% => Slash 1 ether (1/20 = 5%), 19 USDC total value"**

Setup (beforeEach): deploy/approve `MockStrategy` and set as default; mint/approve/mint-OUSD 10/20/30 for daniel/josh/matt (60 OUSD); `vault.allocate()` pushes funds to strategy; requests: Daniel 10 (id 2), Josh 20 (id 3), Matt 10 OUSD (id 4) = 40 queued; 10-min delay; simulate slash by impersonating the strategy and transferring 1 USDC out; strategist `withdrawFromStrategy` 15 USDC back to vault; `addWithdrawalQueueLiquidity()`. maxSupplyDiff is 0 (solvency check off) unless a nested describe sets it.

- `it("Should allow first user to claim the request of 10 USDC")` — Daniel `claimWithdrawal(2)`; expects `WithdrawalClaimed` (daniel, 2, 10 OUSD) (non-awaited `expect(tx)`); deltas: Daniel USDC +10, vault USDC −10, claimed +10 USDC, claimable +0, else +0.
- `it("Fail to allow second user to claim the request of 20 USDC, due to liquidity")` — Josh `claimWithdrawal(3)` reverts with `"Queue pending liquidity"` (only 15 USDC was returned; 10 already claimable for id 2 leaves 5 < 20).
- `it("Should allow a user to create a new request with solvency check off")` — with maxSupplyDiff 0, Matt `requestWithdrawal(10 OUSD)` succeeds despite the 5% insolvency; expects `WithdrawalRequested` (matt, 5, 10 OUSD, 50 OUSD queued) (non-awaited); deltas: totalSupply/totalValue −10 OUSD, checkBalance −10 USDC, Matt OUSD −10, queued +10 USDC, nextWithdrawalIndex +1.
- describe "with solvency check at 3%" (beforeEach: impersonated governor `setMaxSupplyDiff(0.03e18)`):
  - `it("Fail to allow user to create a new request due to insolvency check")` — Matt `requestWithdrawal(1 OUSD)` reverts with `"Backing supply liquidity error"` (5% insolvency > 3% allowed).
  - `it("Fail to allow first user to claim a withdrawal due to insolvency check")` — after another 10-min delay, Daniel `claimWithdrawal(2)` reverts with `"Backing supply liquidity error"`.
- describe "with solvency check at 10%" (beforeEach: `setMaxSupplyDiff(0.1e18)`):
  - `it("Should allow user to create a new request")` — Matt `requestWithdrawal(1 OUSD)` succeeds; expects `WithdrawalRequested` (matt, 3, 1 OUSD, 41 OUSD) (non-awaited; 5% insolvency < 10% allowed).
  - `it("Should allow first user to claim the request of 10 USDC")` — Daniel `claimWithdrawal(2)` succeeds; expects `WithdrawalClaimed` (daniel, 2, 10 OUSD) (non-awaited).

**describe: "OUSD Vault Withdrawals" > "Withdrawal Queue" > "with 99 USDC in the queue, 40 USDC in the vault, total supply 1, 1% insolvency buffer"**

Setup (beforeEach): deploy/approve `MockStrategy` as default; mint/approve/mint-OUSD 20/30/50 for daniel/josh/matt (100 OUSD); `allocate()`; requests: Daniel 20 (id 2), Josh 30 (id 3), Matt 49 OUSD (id 4) = 99 queued, 1 OUSD supply remains; 10-min delay; strategist withdraws 40 USDC back to vault; `addWithdrawalQueueLiquidity()`; impersonated governor `setMaxSupplyDiff(0.01e18)` (1%).

- describe "with 2 ether slashed leaving 100 - 40 - 2 = 58 USDC in the strategy" (beforeEach: impersonated strategy transfers 2 USDC out):
  - `it("Should have total value of zero")` — `vault.totalValue()` equals exactly 0 (100 − 99 outstanding − 2 slashed = −1, floored to 0).
  - `it("Should have check balance of zero")` — `vault.checkBalance(usdc)` equals exactly 0.
  - `it("Fail to allow user to create a new request due to too many outstanding requests")` — Matt `requestWithdrawal(1 OUSD)` reverts with `"Too many outstanding requests"`.
  - `it("Fail to allow first user to claim a withdrawal due to too many outstanding requests")` — after another delay, Daniel `claimWithdrawal(2)` reverts with `"Too many outstanding requests"`.
- describe "with 1 ether slashed leaving 100 - 40 - 1 = 59 USDC in the strategy" (beforeEach: strategy transfers 1 USDC out):
  - `it("Should have total value of zero")` — `vault.totalValue()` equals exactly 0 (100 − 99 − 1 = 0).
  - `it("Fail to allow user to create a new request due to too many outstanding requests")` — `requestWithdrawal(1 OUSD)` reverts with `"Too many outstanding requests"`.
  - `it("Fail to allow first user to claim a withdrawal due to too many outstanding requests")` — Daniel `claimWithdrawal(2)` after delay reverts with `"Too many outstanding requests"`.
- describe "with 0.02 ether slashed leaving 100 - 40 - 0.02 = 59.98 USDC in the strategy" (beforeEach: strategy transfers 0.02 USDC out):
  - `it("Should have total value of zero")` — despite the name, asserts `vault.totalValue()` equals exactly 0.98 OUSD units (100 − 99 − 0.02).
  - `it("Fail to allow user to create a new 1 USDC request due to too many outstanding requests")` — `requestWithdrawal(1 OUSD)` reverts with `"Too many outstanding requests"` (1 > 0.98 available).
  - `it("Fail to allow user to create a new 0.01 USDC request due to insolvency check")` — `requestWithdrawal(0.01 OUSD)` reverts with `"Backing supply liquidity error"` (fits the queue, but 1 supply / 0.98 assets ≈ 2% diff > 1% maxSupplyDiff).
  - `it("Fail to allow first user to claim a withdrawal due to insolvency check")` — Daniel `claimWithdrawal(2)` after delay reverts with `"Backing supply liquidity error"` (same 1/0.98 > 1% reasoning).

---

### `test/vault/deposit.js` — unit test (mainnet/hardhat)

Context: uses `createFixtureLoader(defaultFixture)` from `test/_fixture.js`; contracts under test are the OUSD `Vault` (`pauseCapital`/`unpauseCapital`/`capitalPaused`/`mint`) and mock `USDC`. Single top-level describe; sets `this.timeout(0)` when `isFork`. Does not consume any `test/behaviour/` suite.

**describe: "Vault deposit pausing"**

- `it("Governor can pause and unpause")` — governor `pauseCapital()` → `capitalPaused()` is true; governor `unpauseCapital()` → `capitalPaused()` is false.
- `it("Strategist can pause and unpause")` — same flow with the strategist signer: pause → flag true, unpause → flag false.
- `it("Other can not pause and unpause")` — Anna's `pauseCapital()` and `unpauseCapital()` both revert with `"Caller is not the Strategist or Governor"`.
- `it("Pausing deposits stops mint")` — governor pauses capital (flag asserted true); Anna approves 50 USDC and `vault.mint(50 USDC)` reverts (generic `.to.be.reverted`, no reason string checked).
- `it("Unpausing deposits allows mint")` — governor pauses (flag true) then unpauses (flag false); Anna approves 50 USDC and `mint(50 USDC)` succeeds (no balance assertion, just no revert).
- `it("Deposit pause status can be read")` — `capitalPaused()` read by Anna returns false by default.

---

### `test/vault/rebase.js` — unit test (mainnet/hardhat)

Context: uses `loadDefaultFixture()` from `test/_fixture.js` (Matt & Josh each hold 100 OUSD); contracts under test are the OUSD `Vault` (`rebase`, `pauseRebase`/`unpauseRebase`, `setStrategistAddr`, `setOperatorAddr`, `setTrusteeAddress`, `setTrusteeFeeBps`, `allocate`, `mint`), `OUSD` token, mock `USDC`, and `MockNonRebasing`. Yield is simulated by transferring USDC directly to the vault before `rebase()`. Does not consume any `test/behaviour/` suite.

**describe: "Vault rebase" > "Vault rebase pausing"**

- `it("Should handle rebase pause flag correctly")` — governor `pauseRebase()`, then governor `rebase()` reverts with `"Rebasing paused"`; after `unpauseRebase()`, governor `rebase()` succeeds.
- `it("Should not allow the public to pause or unpause rebasing")` — Anna's `pauseRebase()` and `unpauseRebase()` both revert with `"Caller is not the Strategist or Governor"`.
- `it("Should allow strategist to pause rebasing")` — governor `setStrategistAddr(josh)`; Josh `pauseRebase()` succeeds (no revert; no flag assertion).
- `it("Should allow strategist to unpause rebasing")` — governor `setStrategistAddr(josh)`; Josh `unpauseRebase()` succeeds.
- `it("Should allow governor to pause rebasing")` — governor `pauseRebase()` succeeds.
- `it("Should allow governor to unpause rebasing")` — governor `unpauseRebase()` succeeds.
- `it("Rebase pause status can be read")` — `rebasePaused()` read by Anna is false by default.

**describe: "Vault rebase" > "Vault rebase permissioning (operator)"**

- `it("Should allow the operator to call rebase")` — governor `setOperatorAddr(josh)`; Matt transfers 2 USDC to the vault to seed yield; Josh calls `rebase()`; asserts the receipt contains a `YieldDistribution` event and `ousd.totalSupply()` strictly increased vs before.
- `it("Should allow the strategist to call rebase")` — governor `setStrategistAddr(josh)`; Josh `rebase()` succeeds (no further assertion).
- `it("Should allow the governor to call rebase")` — governor `rebase()` succeeds.
- `it("Should revert when an unauthorized caller calls rebase")` — Anna's `rebase()` reverts with `"Caller not authorized"`.
- `it("Should let governor change the operator")` — governor `setOperatorAddr(josh)`; asserts `vault.operatorAddr()` equals Josh's address.
- `it("Should not let non-governor set the operator")` — Anna's `setOperatorAddr(anna)` reverts with `"Caller is not the Governor"`.

**describe: "Vault rebase" > "Vault rebasing"**

- `it("Should alter balances after supported asset deposited and rebase called for rebasing accounts")` — Matt transfers 2 USDC to the vault; Matt and Josh each start with approx balance 100.00 OUSD; after governor `rebase()`, each has approx 101.00 OUSD (2 USDC yield split across the 200 rebasing supply; uses `approxBalanceOf` custom matcher).
- `it("Should not alter balances after supported asset deposited and rebase called for non-rebasing accounts")` — Josh transfers his 100 OUSD to `mockNonRebasing` (a contract, thus non-rebasing); Matt and the contract each show ≈100 OUSD; Matt transfers 2 USDC yield to the vault and governor rebases; asserts Matt ≈102.00 OUSD (gets all yield) and mockNonRebasing stays ≈100.00 OUSD.
- `it("Should not allocate unallocated assets when no Strategy configured")` — Anna transfers 100 USDC directly to the vault; asserts `vault.getStrategyCount()` equals 0; governor `allocate()`; asserts vault USDC balance equals exactly 300 USDC (fixture's 200 + the 100 — nothing moved out).
- `it("Should correctly handle a deposit of USDC (6 decimals)")` — Anna starts with balance 0 OUSD; approves and mints 50 USDC; asserts her OUSD balance is exactly 50 (6-decimal asset → 18-decimal OUSD scaling).
- `it("Should not auto-rebase on a large mint")` — Anna seeds 2 USDC yield into the vault; then mints 1500 USDC (a size that previously triggered the auto-rebase path); asserts the mint tx receipt contains zero `YieldDistribution` events and `ousd.totalSupply()` equals exactly supplyBefore + 1500 OUSD (mint amount only, no yield distributed); then governor `rebase()` and asserts totalSupply is strictly greater than supplyBefore + 1500 (yield still claimable via authorized rebase).

**describe: "Vault rebase" > "Vault yield accrual to OGN"**

Parameterized loop (`forEach`) over 5 cases generating 5 tests: {yield 1 USDC @ 100bp → fee 0.01}, {1 @ 5000bp → 0.5}, {1.523 @ 900bp → 0.13707}, {0.000001 @ 10bp → 0.000000001}, {0 @ 1000bp → 0}.

- `it("should collect on rebase a ${expectedFee} fee from ${_yield} yield at ${basis}bp")` (×5 runtime tests) — setup per test: governor `setTrusteeAddress(mockNonRebasing)` and `setTrusteeFeeBps(basis)`; asserts trustee starts at 0 OUSD; Matt mints and transfers `_yield` USDC to the vault; governor `rebase()`; asserts OUSD total supply ≈ supplyBefore + yield via `expectApproxSupply`, and the trustee's OUSD balance equals `expectedFee` (via `approxBalanceOf` matcher).

---

No `it.skip`, `xit`, or commented-out tests exist in any of the three files. None of the files consume or define `test/behaviour/` shared suites.

Test totals: redeem.js 66 + deposit.js 6 + rebase.js 23 (18 static + 5 loop-generated) = **95 it() blocks**.

---

## Vault general, mock vault, OS vault (unit + mainnet/sonic fork)

This section covers the general-purpose OUSD Vault unit tests (asset support, strategy approval/removal, mint accounting across decimals, token rescue, strategist/governor access control, vault buffer, deposit/withdraw-to-strategy flows), the MockVault rebase/supply-diff safety tests, the mainnet Vault fork smoke tests (config sanity, mint, strategy deposit/withdraw, known assets/strategies), the Origin Sonic (OS) vault + Sonic staking strategy unit tests (token metadata, mint/withdrawal-queue lifecycle, validator registrator/validator admin), and the Sonic Vault fork tests (config sanity, mint, staking-strategy withdrawals with wS/native S). Files covered:

- `test/vault/index.js`
- `test/vault/z_mockvault.js`
- `test/vault/vault.mainnet.fork-test.js`
- `test/vault/os-vault.sonic.js`
- `test/vault/vault.sonic.fork-test.js`

### `test/vault/index.js` — unit test (mainnet)

Context: uses `loadDefaultFixture()` from `test/_fixture.js` (deploys OUSD `vault` + mocks: `usdc`, `usds`, `ousd`, `mockStrategy`; Matt and Josh each seeded with 100 OUSD, total supply 200); contracts under test: `VaultCore`/`VaultAdmin` behind `OUSDVault` proxy. Sets `this.timeout(0)` when `isFork`.

**describe: "Vault"**
- `it("Should support an asset")` — asserts `vault.isSupportedAsset(usds)` is false and `vault.isSupportedAsset(usdc)` is true (fixture only supports USDC).
- `it("Should revert when adding a strategy that is already approved")` — governor calls `approveStrategy(mockStrategy)` once successfully; a second identical call reverts with exact string `"Strategy already approved"`.
- `it("Should revert when attempting to approve a strategy and not Governor")` — `approveStrategy(mockStrategy)` from josh reverts with `"Caller is not the Governor"`.
- `it("Should correctly ratio deposited currencies of differing decimals")` — matt starts with exactly 100.00 OUSD; after approving and minting with 2.0 USDC (6 decimals) via `vault.mint(usdcUnits("2.0"))`, matt's OUSD balance is exactly 102.00 (verifies 6-decimal asset scales to 18-decimal OToken 1:1).
- `it("Should correctly handle a deposit of USDC (6 decimals)")` — anna starts at 0.00 OUSD; after mint with 50.0 USDC her OUSD balance is exactly 50.00.
- `it("Should calculate the balance correctly with USDC")` — matt mints with 2.0 USDC; asserts `vault.totalValue()` equals exactly `parseUnits("202", 18)` (fixture pre-loads 200 units of collateral).
- `it("Should allow transfer of arbitrary token by Governor")` — matt mints 8 USDC worth of OUSD then transfers 8 OUSD directly to the vault; governor calls `vault.transferToken(ousd, 8e18)`; asserts governor's OUSD balance is 8.0 (OUSD is not a supported vault asset so it is rescuable).
- `it("Should not allow transfer of arbitrary token by non-Governor")` — `vault.transferToken(ousd, 8e18)` from matt reverts with `"Caller is not the Governor"`.
- `it("Should not allow transfer of supported token by governor")` — 8.0 USDC is transferred straight to the vault; governor's `transferToken(usdc, ...)` reverts with `"Only unsupported asset"`.
- `it("Should allow Governor to add Strategy")` — governor calls `approveStrategy(mockStrategy)`; asserts only that the tx does not revert (no state check).
- `it("Should revert when removing a Strategy that has not been added")` — governor calls `removeStrategy(ousd.address)` (OUSD address used as a fake strategy); reverts with `"Strategy not approved"`.
- `it("Should correctly handle a mint with auto rebase")` — anna starts at 0.00 OUSD, matt at 100.00; anna mints herself 5000 mock USDC, approves, and mints via vault; asserts anna's OUSD balance is exactly 5000.00 and matt's stays exactly 100.00 (large mint triggers auto-rebase without changing other holders' balances).
- `it("Should allow transfer of arbitrary token by Governor")` — exact duplicate of the earlier test of the same name (same body: matt mints with 8 USDC, sends 8 OUSD to vault, governor rescues via `transferToken`, governor OUSD balance is 8.0).
- `it("Should not allow transfer of arbitrary token by non-Governor")` — exact duplicate of the earlier same-named test; matt's `transferToken` reverts with `"Caller is not the Governor"`.
- `it("Should allow governor to change Strategist address")` — governor calls `setStrategistAddr(josh)`; asserts only non-revert (no getter check).
- `it("Should not allow non-governor to change Strategist address")` — matt's `setStrategistAddr(josh)` reverts with `"Caller is not the Governor"`.
- `it("Should allow the Governor to call withdraw and then deposit")` — setup: governor approves `mockStrategy`, sets it as default strategy, josh mints with 200 USDC, governor calls `allocate()`; then governor calls `withdrawFromStrategy(mockStrategy, [usdc], [200])` followed by `depositToStrategy(mockStrategy, [usdc], [200])`; asserts both succeed (no balance assertions).
- `it("Should allow the Strategist to call withdrawFromStrategy and then depositToStrategy")` — same setup (approve + default strategy + josh mints 200 USDC + allocate); the strategist (not governor) calls `withdrawFromStrategy` then `depositToStrategy` for 200 USDC; asserts both succeed.
- `it("Should not allow non-Governor and non-Strategist to call withdrawFromStrategy or depositToStrategy")` — josh calls `withdrawFromStrategy(vault.address, [usds], [200])` and `depositToStrategy(vault.address, [usds], [200])` (args intentionally bogus since the access check fires first); both revert with `"Caller is not the Strategist or Governor"`.
- `it("Should withdrawFromStrategy the correct amount for multiple assests and redeploy them using depositToStrategy")` — setup: approve mockStrategy, set as default, josh mints with 90 USDC, allocate; strategist withdraws 90 USDC from the strategy and asserts `usdc.balanceOf(vault)` equals exactly `usdcUnits("90")`; then strategist deposits 90 USDC back and asserts `usdc.balanceOf(vault)` equals exactly 0.
- `it("Should allow Governor and Strategist to set vaultBuffer")` — both governor and strategist call `setVaultBuffer(5e17)` (50%); asserts non-revert only.
- `it("Should not allow other to set vaultBuffer")` — josh's `setVaultBuffer(2e19)` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should not allow setting a vaultBuffer > 1e18")` — governor's `setVaultBuffer(2e19)` reverts with `"Invalid value"`.
- `it("Should only allow Governor and Strategist to call withdrawAllFromStrategies")` — governor and strategist calls to `withdrawAllFromStrategies()` succeed; matt's call reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should only allow Governor and Strategist to call withdrawAllFromStrategy")` — setup: governor approves mockStrategy and calls `mockStrategy.setWithdrawAll(usdc, vault)` (configures the mock's withdrawAll behavior), records vault's initial USDC balance, sets mockStrategy as default, josh mints with 200 USDC, allocate; governor's `withdrawAllFromStrategy(mockStrategy)` succeeds and vault USDC balance equals exactly initial balance + 200 USDC; strategist's call also succeeds; matt's call reverts with `"Caller is not the Strategist or Governor"`.

### `test/vault/z_mockvault.js` — unit test (mainnet)

Context: uses `mockVaultFixture` via `createFixtureLoader` from `test/_fixture.js` (replaces the vault implementation with `MockVault`, which lets tests set `totalValue` arbitrarily and doesn't reduce total value while redeeming); contracts under test: `MockVault` + OUSD rebasing. `beforeEach` also has governor call `mockVault.setMaxSupplyDiff(1e17)` (allow a 10% totalSupply/totalValue divergence). A shared helper `testSupplyDiff({vaultTotalValue, redeemAmount, revertMessage})` sets `mockVault.setTotalValue(vaultTotalValue - redeemAmount)` (pre-reduced, since the mock doesn't decrement on redeem) then has matt call `requestWithdrawal(redeemAmount)` and expects either the given revert string or success.

**describe: "Vault mock with rebase"**
- `it("Should increase users balance on rebase after increased Vault value")` — total OUSD supply is 200; `setTotalValue(202e18)` then `rebase()`; asserts matt and josh each have approx 101.00 OUSD (yield split evenly on rebase).
- `it("Should not decrease users balance on rebase after decreased Vault value")` — `setTotalValue(180e18)` then `rebase()`; asserts matt and josh still have approx 100.00 OUSD each (negative rebase does not reduce balances).
- `it("Should revert when totalValue far exceeding totalSupply")` — via `testSupplyDiff`: totalValue set to 200 (300−100), matt requests withdrawal of 100; reverts with `"Backing supply liquidity error"` (post-redeem value 200 vs supply 100 exceeds the 10% max supply diff).
- `it("Should revert when totalSupply far exceeding totalValue")` — via `testSupplyDiff`: totalValue set to 70 (170−100), withdrawal of 100; reverts with `"Backing supply liquidity error"`.
- `it("Should pass when totalValue exceeding totalSupply but within limits")` — via `testSupplyDiff`: totalValue set to 109 (209−100), i.e. 9% over the post-redeem supply of 100; withdrawal request of 100 does not revert.
- `it("Should pass when totalSupply exceeding totalValue but within limits")` — via `testSupplyDiff`: totalValue set to 91 (191−100), 9% under supply; withdrawal request of 100 does not revert.

### `test/vault/vault.mainnet.fork-test.js` — fork test (mainnet)

Context: uses `loadDefaultFixture()` from `test/_fixture.js` against a mainnet fork; contracts under test: deployed OUSD `vault` (VaultCore/VaultAdmin), `morphoOUSDv2Strategy`, `harvester`. `this.timeout(0)`; retries up to 3 times when `isCI`. A file header comment explains the addresses are intentionally hardcoded (not from `addresses.js`) to avoid a single point of failure.

**describe: "ForkTest: Vault" > "View functions"** (these send actual transactions to view functions so gas usage gets reported)
- `it("Should get total value")` — josh sends a populated transaction calling `vault.totalValue()`; asserts non-revert only.
- `it("Should check asset balances")` — josh sends a populated transaction calling `vault.checkBalance(usdc)`; asserts non-revert only.

**describe: "ForkTest: Vault" > "Admin"**
- `it("Should have the correct governor address set")` — `vault.governor()` equals `addresses.mainnet.Timelock`.
- `it("Should have the correct strategist address set")` — `vault.strategistAddr()` equals the fixture strategist address.
- `it("Should have the OUSD/USDC AMO mint whitelist")` — `vault.isMintWhitelistedStrategy(addresses.mainnet.CurveOUSDAMOStrategy)` is true.
- `it("Should have supported assets")` — `vault.getAllAssets()` has length exactly 1 and includes `addresses.mainnet.USDC`; `isSupportedAsset(USDC)` is true.

**describe: "ForkTest: Vault" > "Rebase"**
- `it("Shouldn't be paused")` — `vault.rebasePaused()` is false.
- `it("Should rebase")` — strategist calls `vault.rebase()`; asserts non-revert only.

**describe: "ForkTest: Vault" > "Capital"**
- `it("Shouldn't be paused")` — `vault.capitalPaused()` is false.
- `it("Should allow to mint w/ USDC")` — josh mints with 500 USDC; asserts josh's OUSD balance increased by 500 OUSD with 1% tolerance (`approxEqualTolerance(ousdUnits("500"), 1)`).
- `it("should withdraw from and deposit to strategy")` — josh mints 500,000 USDC (to absorb outstanding withdrawals) then another 90 USDC; the on-chain strategist address is impersonated and funded; strategist deposits 90 USDC into `morphoOUSDv2Strategy` via `depositToStrategy` — asserts vault USDC balance changed by exactly −90 USDC and strategy `checkBalance(usdc)` grew by ≥ 89.91 USDC (measured with `differenceInErc20TokenBalances` / `differenceInStrategyBalance` helpers); then strategist withdraws 89 USDC via `withdrawFromStrategy` (only 89 because Morpho utilization may not allow the full 90 back) — asserts vault USDC balance changed by exactly +89 USDC and strategy balance changed by ≤ −88.91 USDC.
- `it("Should have vault buffer disabled")` — `vault.vaultBuffer()` equals exactly `"0"`.

**describe: "ForkTest: Vault" > "Assets & Strategies"**
- `it("Should NOT have any unknown assets")` — bidirectional check: every asset from `vault.getAllAssets()` must be in the hardcoded known-assets list (`0xA0b8...eB48` USDC only) and every known asset must be returned by the contract; failure messages name the offending address.
- `it("Should NOT have any unknown strategies")` — bidirectional check of `vault.getAllStrategies()` against the hardcoded list: `0x26a0...Ce11` (Curve AMO OUSD/USDC), `0x3643...Ff6e` (Morpho OUSD v2), `0xB1d6...0866` (Cross-Chain Strategy Base), `0xE022...A1e` (Cross-Chain Strategy HyperEVM); every on-chain strategy must be known and every known strategy must be registered.
- `it("Should have correct default strategy")` — `vault.defaultStrategy()` equals `0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e` (Morpho OUSD v2 Strategy).
- `it("Should be able to withdraw from all strategies")` — first checks `canWithdrawAllFromMorphoOUSD()` (from `utils/morpho`); if the Morpho OUSD v1 vault lacks liquidity the test returns early (soft skip); otherwise timelock calls `vault.withdrawAllFromStrategies()` and asserts non-revert.

**Consumed behaviour suite:** the file invokes `shouldHaveRewardTokensConfigured(() => ({ vault: fixture.vault, harvester: fixture.harvester, expectedConfigs: {} }))` from `test/behaviour/reward-tokens.fork.js`. That suite (fork-only) adds a nested **describe: "Reward Tokens"** with one test, `it("Should have swap config for all reward tokens from strategies")`, which iterates all vault strategies (skipping ones whose harvester is the multichain strategist and the Morpho OUSD v2 strategy), asserts each strategy with reward tokens is whitelisted on the harvester, that each reward token has a non-zero `swapPlatformAddr` and `doSwapRewardToken == true`, that the config matches `expectedConfigs` (here empty, so effectively only the non-zero/route checks apply), and that no expected config is missing. See the reward-tokens behaviour documentation for full details.

### `test/vault/os-vault.sonic.js` — unit test (sonic network, run with `UNIT_TESTS_NETWORK=sonic`)

Context: uses `defaultSonicFixture` from `test/_fixture-sonic.js` via `createFixtureLoader` (local mocks for the Sonic stack); contracts under test: `oSonic` (OS token), `wOSonic` (Wrapped OS), `oSonicVault` (OETHSVault-style vault with async withdrawal queue), `sonicStakingStrategy`, `wS` (Wrapped Sonic mock). Two file-level helpers: `snapData()` snapshots OS totalSupply, vault totalValue, `checkBalance(wS)`, user OS/wS balances, vault wS balance, and `withdrawalQueueMetadata()` (queued/claimable/claimed/nextWithdrawalIndex); `assertChangedData(before, delta)` asserts each of those 10 values equals the before-value plus the given exact delta (all exact `.equal` checks, no tolerance).

**describe: "Origin S Vault" > "Sonic tokens"**
- `it("Should read Origin Sonic metadata")` — `oSonic.name()` is `"Origin Sonic"`, `symbol()` is `"OS"`, `decimals()` is 18.
- `it("Should read Wrapped Origin Sonic metadata")` — `wOSonic.name()` is `"Wrapped OS"`, `symbol()` is `"wOS"`, `decimals()` is 18.

**describe: "Origin S Vault" > "Sonic tokens" > "governor transfers"** (beforeEach: deploys a fresh `MockWETH`, mints 1000e18 and transfers it to the `wOSonic` contract)
- `it("Should allow transfer of arbitrary token by Governor")` — governor calls `wOSonic.transferToken(weth, 1000e18)`; asserts governor's MockWETH balance equals the full amount.
- `it("Should not allow transfer of arbitrary token by non-Governor")` — nick's `wOSonic.transferToken(weth, amount)` reverts with `"Caller is not the Governor"`.
- `it("Should not allow transfer of Origin Sonic token by governor")` — governor's `wOSonic.transferToken(oSonic, amount)` reverts with `"Cannot collect core asset"`.

**describe: "Origin S Vault" > "Vault operations"**
- `it("Should mint with wS")` — snapshot before; nick approves and mints 1e18 wS; asserts tx emits `Mint(nick, mintAmount)` on the vault; via `assertChangedData`, exact deltas: OS totalSupply +1e18, vault totalValue +1e18, checkBalance(wS) +1e18, nick's OS +1e18, nick's wS −1e18, vault's wS +1e18, queue metadata unchanged (queued/claimable/claimed/nextWithdrawalIndex all +0).
- `it("Should request withdraw from Vault")` — setup: nick mints 100e18 OS; snapshot; nick calls `requestWithdrawal(90e18)`; asserts event `WithdrawalRequested(nick, requestId=0, amount=90e18, queued=90e18)`; exact deltas: totalSupply −90e18, totalValue −90e18, checkBalance −90e18, nick's OS −90e18, nick's wS +0, vault wS +0, queued +90e18, claimable +0, claimed +0, nextWithdrawalIndex +1.
- `it("Should claim withdraw from Vault")` — setup: nick mints 100e18, requests withdrawal of 90e18; snapshot; `advanceTime(86400)` (1-day claim delay); nick calls `claimWithdrawal(0)`; asserts event `WithdrawalClaimed(nick, 0, 90e18)`; exact deltas: totalSupply/totalValue/checkBalance/nick's OS all +0, nick's wS +90e18, vault wS −90e18, queued +0, claimable +90e18, claimed +90e18, nextWithdrawalIndex +0.
- `it("Should claim multiple withdrawal from Vault")` — setup: nick mints 100e18, makes two withdrawal requests of 10e18 and 20e18; snapshot; advance 1 day; nick calls `claimWithdrawals([0, 1])`; asserts two `WithdrawalClaimed` events: `(nick, 0, 10e18)` and `(nick, 1, 20e18)`; exact deltas: nick's wS +30e18, vault wS −30e18, claimable +30e18, claimed +30e18, everything else (supply, value, checkBalance, OS balance, queued, nextWithdrawalIndex) +0.

**describe: "Origin S Vault" > "Administer Sonic Staking Strategy"**
- `it("Should support Wrapped S asset")` — `sonicStakingStrategy.supportsAsset(wS)` is true.
- `it("Should allow governor to set validator registrator")` — governor calls `setRegistrator(randomWallet)`; asserts event `RegistratorChanged(newRegistrator)` and `validatorRegistrator()` getter equals the new address.
- `it("Should not allow set validator registrator by non-Governor")` — loops over strategist, nick, rafael; each `setRegistrator(self)` reverts with `"Caller is not the Governor"`.
- `it("Should allow governor to add supported validator")` — precondition: `supportedValidatorsLength()` is 0 and `isSupportedValidator(98)` false; governor calls `supportValidator(98)` and `supportValidator(99)`; asserts events `SupportedValidator(98)` and `SupportedValidator(99)`; `supportedValidators(0)` == 98, `supportedValidators(1)` == 99, length == 2, `isSupportedValidator(98)` true.
- `it("Should not allow adding a supported validator twice")` — governor adds validator 98; second `supportValidator(98)` reverts with `"Validator already supported"`.
- `it("Should not allow add supported validator by non-Governor")` — loops over strategist, nick, rafael; each `supportValidator(99)` reverts with `"Caller is not the Governor"`.
- `it("Should allow governor to unsupport validator")` — governor adds validators 95, 98, 99 (length 3, 98 supported); governor calls `unsupportValidator(98)`; asserts event `UnsupportedValidator(98)`; remaining array is `[95, 99]` (index 0 == 95, index 1 == 99), length == 2; `isSupportedValidator` true for 95 and 99, false for 98.
- `it("Should not allow unsupport validator by non-Governor")` — governor adds validator 95; loops over strategist, nick, rafael; each `unsupportValidator(95)` reverts with `"Caller is not the Governor"`.
- `it("Should not allow unsupport of an unsupported validator")` — `isSupportedValidator(90)` false before; governor's `unsupportValidator(90)` reverts with `"Validator not supported"`; still false after.

**describe: "Origin S Vault" > "Administer Sonic Staking Strategy" > "Setting default validator registrator"** (beforeEach: creates a random wallet, impersonates+funds it, and governor sets it as registrator)
- `it("Should allow setting a default validator")` — governor supports validators 95 and 96; the registrator signer calls `setDefaultValidatorId(95)` — expects event `DefaultValidatorIdChanged(95)` (note: `expect(tx)` without await) and `defaultValidatorId()` == 95; then the strategist calls `setDefaultValidatorId(96)` and `defaultValidatorId()` == 96 (both registrator and strategist are allowed).
- `it("Should not allow setting a default validator when one is not supported")` — registrator's `setDefaultValidatorId(95)` (95 never supported) reverts with `"Validator not supported"`.
- `it("Should not allow setting a default validator by non registrator/strategist account")` — governor supports 95; nick's `setDefaultValidatorId(95)` reverts with `"Caller is not the Registrator or Strategist"`.

**describe: "Origin S Vault" > "Unsupported strategy functions"**
- `it("Should not support collectRewardTokens")` — governor's `sonicStakingStrategy.collectRewardTokens()` reverts with `"unsupported function"`.
- `it("Should not support setPTokenAddress")` — governor's `setPTokenAddress(wS, nick)` reverts with `"unsupported function"`.
- `it("Should not support removePToken")` — governor's `removePToken(1)` reverts with `"unsupported function"`.

**describe: "Origin S Vault" > "Other function checks"**
- `it("Should not allow checkBalance with incorrect asset")` — `sonicStakingStrategy.checkBalance(nick.address)` (an address that is not wS) reverts with `"Unsupported asset"`.

### `test/vault/vault.sonic.fork-test.js` — fork test (sonic)

Context: uses `defaultSonicFixture` from `test/_fixture-sonic.js` against a Sonic fork; contracts under test: deployed `oSonicVault`, `oSonic`, `sonicStakingStrategy`, real `wS`. `this.timeout(0)`; retries up to 3 times when `isCI`.

**describe: "ForkTest: Sonic Vault" > "View functions"** (transactions to view functions for gas reporting)
- `it("Should get total value")` — nick sends a populated transaction calling `oSonicVault.totalValue()`; asserts non-revert only.
- `it("Should check asset balances")` — nick sends a populated transaction calling `oSonicVault.checkBalance(wS)`; asserts non-revert only.

**describe: "ForkTest: Sonic Vault" > "Admin"**
- `it("Should have the correct governor address set")` — `oSonicVault.governor()` equals `addresses.sonic.timelock`.
- `it("Should have the correct strategist address set")` — `oSonicVault.strategistAddr()` equals the fixture strategist address.
- `it("Should have supported assets")` — `getAllAssets()` has length exactly 1 and includes `addresses.sonic.wS`; `isSupportedAsset(wS)` is true.
- `it("Should call safeApproveAllTokens")` — timelock calls `sonicStakingStrategy.safeApproveAllTokens()`; asserts non-revert only.
- `it("Should have trusteeFeeBps set to 10%")` — `oSonicVault.trusteeFeeBps()` equals exactly `BigNumber.from("1000")`.
- `it("Should trustee set to the multichain buyback operator")` — `oSonicVault.trusteeAddress()` equals `addresses.multichainBuybackOperator`.

**describe: "ForkTest: Sonic Vault" > "Rebase"**
- `it("Shouldn't be paused")` — `oSonicVault.rebasePaused()` is false.
- `it("Should rebase")` — strategist calls `oSonicVault.rebase()`; asserts non-revert only.

**describe: "ForkTest: Sonic Vault" > "Capital"**
- `it("Shouldn't be paused")` — `oSonicVault.capitalPaused()` is false.
- `it("Should allow to mint w/ Wrapped S (wS)")` — nick mints with 1000 wS; asserts nick's OS balance increased by 1000 with 1% tolerance (`approxEqualTolerance(parseUnits("1000"), 1)`).
- `it.skip("should automatically deposit to staking strategy")` — (skipped) would call `oSonicVault.allocate()` to clear wS from the vault, mint 5,000,000 wS as nick, then assert the tx emits `Mint(nick, mintAmount)` on the vault and a `Deposit` event on `sonicStakingStrategy` (auto-allocation of ~99.5% past the buffer).
- `it("should withdraw from staking strategy")` — nick mints 2000 wS; the on-chain strategist address is impersonated+funded; nick transfers 1500 wS directly to the strategy (simulating a completed validator undelegate/withdraw); strategist calls `withdrawFromStrategy(sonicStakingStrategy, [wS], [1500])`; asserts the tx emits `Withdrawal(wS, addresses.zero, 1500e18)` on the strategy.
- `it("should call withdraw all from staking strategy even if all delegated")` — nick mints 2000 wS; strategist (impersonated) calls `withdrawAllFromStrategy(sonicStakingStrategy)`; asserts the tx does NOT emit a `Withdrawal` event (nothing liquid to move; funds all delegated).
- `it("should call withdraw all from staking strategy with wrapped S in it")` — nick mints 2000 wS and transfers 1500 wS to the strategy (simulated undelegation); strategist's `withdrawAllFromStrategy` emits `Withdrawal(wS, addresses.zero, 1500e18)`.
- `it("should call withdraw all from staking strategy with native S in it")` — nick mints 2000 wS; native S balance of the strategy is force-set to 500e18 via hardhat `setBalance`; strategist's `withdrawAllFromStrategy` emits `Withdrawal(wS, addresses.zero, 500e18)` (native S is wrapped and withdrawn).
- `it("Should have vault buffer set")` — `oSonicVault.vaultBuffer()` equals exactly `parseUnits("0.005", 18)` (0.5%).

---

## Vault on Base/Plume, harvester, permissioned rebase

This section covers the multi-chain vault tests of the legacy Hardhat suite: the OETHp (Plume) vault fork tests (permissioned mint/redeem via deprecated signatures, plus large skipped blocks for async withdrawals, mint whitelist and mintForStrategy/burnForStrategy), the OETHb (Base, "superOETHb") vault fork tests (open mint, active async-withdrawal queue, skipped whitelist/strategy-mint blocks), the OETHb vault unit tests (mint whitelist + mint/burn-for-strategy against local mocks), the SuperOETHHarvester fork tests on Base (harvestAndTransfer from Aerodrome/Curve AMO strategies, token recovery, and a fully skipped harvestAndSwap suite), and the mainnet permissioned-rebase fork test (operator-gated `rebase()` on the OUSD and OETH vaults). None of these files consume or define shared behaviour suites from `test/behaviour/`.

Files covered:
- `test/vault/oethp-vault.plume.fork-test.js`
- `test/vault/oethb-vault.base.fork-test.js`
- `test/vault/oethb-vault.base.js`
- `test/vault/harvester.base.fork-test.js`
- `test/vault/permissioned-rebase.mainnet.fork-test.js`

### `test/vault/oethp-vault.plume.fork-test.js` — fork test (Plume)

Fixture: `createFixtureLoader(defaultPlumeFixture)` from `_fixture-plume.js`, reloaded in `beforeEach`. Contracts under test: `OETHPlumeVaultProxy` as `IVault` (`oethpVault`) plus `oethpVaultLegacy` — an ad-hoc ethers.Contract on the same proxy exposing the deprecated `mint(address,uint256,uint256)` / `redeem(uint256,uint256)` signatures (the Plume vault is being wound down and won't be upgraded) — the OETHp token, and Plume WETH minted via the fixture's `_mintWETH` helper (governor is made a WETH minter). Local helper `_mint(signer, amount=1 ether)`: mints WETH to signer, approves the vault, then calls the legacy `mint(weth, amount, amount)` as `signer`. Top-level describe is `"ForkTest: OETHp Vault"`.

**describe: "ForkTest: OETHp Vault" > "Mint & Permissioned redeems"**
- `it("Should allow Strategist to mint")` — calls `_mint(strategist)` for 1 WETH; the only assertion is that the legacy `mint` tx succeeds (mint is strategist/governor-gated on Plume).
- `it("Should not allow anyone else to mint")` — `nick` calls legacy `mint(weth, 1e18, 1e18)`; reverts with exactly `"Caller is not the Strategist or Governor"`.
- `it("Should allow anyone to mint")` (skipped, `it.skip`) — pre-mints 1 WETH as nick then `oethpVault.rebase()` so the Dripper's funds don't pollute the measurement; mints another 1 WETH as nick; asserts OETHp `totalSupply` and nick's OETHp balance each grow by ~1e18 (`approxEqual`) and the vault's WETH balance grows by 1e18 within 0.1% (`approxEqualTolerance(..., 0.1)`).
- `it("Should allow only Strategist to redeem")` — setup: rafael transfers 10,000 WETH straight to the vault for redeem liquidity, `rebase()`, `_mint(strategist)`; strategist calls legacy `redeem(1e18, 0)`; asserts OETHp `totalSupply`, strategist's OETHp balance, and the vault's WETH balance each drop by ~1e18 (`approxEqualTolerance` default tolerance).
- `it("Should allow only Governor to redeem")` — identical to the previous test with `governor` as the minter/redeemer; same three ~1e18-decrease assertions.
- `it("No one else can redeem")` (skipped, `it.skip`) — loop over `[rafael, nick]`: each `_mint(signer)` then `oethpVault.redeem(1e18, 0)`; expects revert `"Caller is not the Strategist or Governor"` for both.

**describe: "ForkTest: OETHp Vault" > "Async withdrawals"** (entire block skipped via `describe.skip`)
- `it("Should allow 1:1 async withdrawals")` (skipped) — rafael transfers 10,000 WETH to the vault; reads `withdrawalClaimDelay()` and, if 0, governor sets it to 600s; records `nextWithdrawalIndex` from `withdrawalQueueMetadata()` as the requestId; `_mint(rafael)`; `requestWithdrawal(1e18)`; `advanceTime(delayPeriod)`; `claimWithdrawal(requestId)` — success of the claim tx is the assertion (no balance checks).
- `it("Should not allow withdraw before claim delay")` (skipped) — same delay setup; `_mint(rafael, 2e18)`; `requestWithdrawal(1e18)` then immediate `claimWithdrawal(requestId)` reverts `"Claim delay not met"`.
- `it("Should enforce claim delay limits")` (skipped) — governor `setWithdrawalClaimDelay(600)` then getter returns 600; `setWithdrawalClaimDelay(15*24*3600)` (comment says 7d, value is 15 days) then getter returns that; setting `599` reverts `"Invalid claim delay period"`; setting `15*24*3600 + 1` reverts `"Invalid claim delay period"`.
- `it("Should allow governor to disable withdrawals")` (skipped) — governor sets delay to 0, getter returns 0; rafael's `requestWithdrawal(1e18)` then reverts `"Async withdrawals not enabled"`.
- `it("Should not allow anyone else to disable withdrawals")` (skipped) — loop over `[rafael]` (TODO comment: add strategist later): `setWithdrawalClaimDelay(0)` reverts `"Caller is not the Governor"`.

**describe: "ForkTest: OETHp Vault" > "Mint Whitelist"** (entire block skipped via `describe.skip`; uses `addresses.dead` as a pretend strategy)
- `it("Should allow a strategy to be added to the whitelist")` (skipped) — governor `approveStrategy(addresses.dead)` then `addStrategyToMintWhitelist(addresses.dead)`; expects event `StrategyAddedToMintWhitelist` and `isMintWhitelistedStrategy(addresses.dead)` == true.
- `it("Should allow a strategy to be removed from the whitelist")` (skipped) — after approve + add, `removeStrategyFromMintWhitelist(addresses.dead)` emits `StrategyRemovedFromMintWhitelist` and the getter returns false.
- `it("Should not allow non-governor to add to whitelist")` (skipped) — rafael's `addStrategyToMintWhitelist` reverts `"Caller is not the Governor"`.
- `it("Should not allow non-governor to remove from whitelist")` (skipped) — rafael's `removeStrategyFromMintWhitelist` reverts `"Caller is not the Governor"`.
- `it("Should not allow adding unapproved strategy")` (skipped) — governor adds `addresses.dead` without prior `approveStrategy`; reverts `"Strategy not approved"`.
- `it("Should not whitelist if already whitelisted")` (skipped) — approve + add, then a second `addStrategyToMintWhitelist` reverts `"Already whitelisted"`.
- `it("Should revert when removing unwhitelisted strategy")` (skipped) — `removeStrategyFromMintWhitelist(addresses.dead)` with no prior add reverts `"Not whitelisted"`.

**describe: "ForkTest: OETHp Vault" > "Mint & Burn For Strategy"** (entire block skipped via `describe.skip`; `beforeEach` deploys a fresh `MockStrategy` via `deployWithConfirmation`, governor `approveStrategy` + `addStrategyToMintWhitelist` on it, and the strategy address is impersonated/funded as `strategySigner`)
- `it("Should allow a whitelisted strategy to mint and burn")` (skipped) — after `rebase()`: `mintForStrategy(1e18)` from the strategy signer makes the strategy's OETHp balance exactly 1e18 and `totalSupply` exactly `before + 1e18`; `burnForStrategy(1e18)` returns the balance to 0 and `totalSupply` exactly to `before`.
- `it("Should not allow a non-supported strategy to mint")` (skipped) — governor (not a strategy) calls `mintForStrategy(1e18)`; reverts `"Unsupported strategy"`.
- `it("Should not allow a non-supported strategy to burn")` (skipped) — governor calls `burnForStrategy(1e18)`; reverts `"Unsupported strategy"`.
- `it("Should not allow a non-white listed strategy to mint")` (skipped) — governor approves `addresses.dead` as a strategy but does not whitelist it; impersonated `addresses.dead` calls `mintForStrategy(1e18)`; reverts `"Not whitelisted strategy"`.
- `it("Should not allow a non-white listed strategy to burn")` (skipped) — same setup; `burnForStrategy(1e18)` reverts `"Not whitelisted strategy"`.

### `test/vault/oethb-vault.base.fork-test.js` — fork test (Base)

Fixture: `createFixtureLoader(defaultBaseFixture)` from `_fixture-base.js`, reloaded in `beforeEach`. Contracts under test: `OETHBaseVaultProxy` as `IVault` (`oethbVault`), the OETHb (superOETHb) token, and real Base WETH (`IWETH9`). Local helper `_mint(signer)`: deposits 1 ETH into WETH, approves the vault, and calls the Base vault's single-asset `mint(uint256)` (mint is permissionless on Base, unlike Plume). Top-level describe is `"ForkTest: OETHb Vault"`. The "Mint Whitelist" and "Mint & Burn For Strategy" blocks are byte-for-byte parallels of the Plume file's (also skipped); the "Async withdrawals" block is the same content as Plume's but ACTIVE here.

**describe: "ForkTest: OETHb Vault" > "Mint & Permissioned redeems"**
- `it("Should allow anyone to mint")` — pre-mint 1 WETH as nick then `oethbVault.connect(strategist).rebase()` (flushes Dripper so the next mint is measured cleanly); mints another 1 WETH as nick; asserts OETHb `totalSupply` and nick's balance each grow by ~1e18 (`approxEqual`) and the vault's WETH balance grows by 1e18 within 0.1% (`approxEqualTolerance(..., 0.1)`).

**describe: "ForkTest: OETHb Vault" > "Async withdrawals"**
- `it("Should allow 1:1 async withdrawals")` — rafael approves and `mint`s 10,000 WETH into the vault for liquidity (via mint, not a direct transfer as on Plume); if `withdrawalClaimDelay()` is 0, governor sets it to 600s; records `nextWithdrawalIndex` from `withdrawalQueueMetadata()` as requestId; `_mint(rafael)`; `requestWithdrawal(1e18)`; `advanceTime(delayPeriod)`; `claimWithdrawal(requestId)` succeeds (no explicit balance assertions).
- `it("Should not allow withdraw before claim delay")` — same delay setup; `_mint(rafael)`; `requestWithdrawal(1e18)`; immediate `claimWithdrawal(requestId)` reverts `"Claim delay not met"`.
- `it("Should enforce claim delay limits")` — governor sets delay to 600s and getter returns 600; sets `15*24*3600` (15d; comment mislabels it 7d) and getter returns it; setting 599s reverts `"Invalid claim delay period"`; setting `15*24*3600 + 1` reverts `"Invalid claim delay period"`.
- `it("Should allow governor to disable withdrawals")` — governor `setWithdrawalClaimDelay(0)`, getter returns 0; rafael's `requestWithdrawal(1e18)` reverts `"Async withdrawals not enabled"`.
- `it("Should not allow anyone else to disable withdrawals")` — loop over `[rafael, strategist]`: `setWithdrawalClaimDelay(0)` reverts `"Caller is not the Governor"` for both.

**describe: "ForkTest: OETHb Vault" > "Mint Whitelist"** (entire block skipped via `describe.skip`; uses `addresses.dead` as a pretend strategy; assertions identical to the Plume file's skipped Mint Whitelist block)
- `it("Should allow a strategy to be added to the whitelist")` (skipped) — governor `approveStrategy(addresses.dead)` + `addStrategyToMintWhitelist`; emits `StrategyAddedToMintWhitelist`; `isMintWhitelistedStrategy` true.
- `it("Should allow a strategy to be removed from the whitelist")` (skipped) — approve + add, then remove; emits `StrategyRemovedFromMintWhitelist`; getter false.
- `it("Should not allow non-governor to add to whitelist")` (skipped) — rafael; reverts `"Caller is not the Governor"`.
- `it("Should not allow non-governor to remove from whitelist")` (skipped) — rafael; reverts `"Caller is not the Governor"`.
- `it("Should not allow adding unapproved strategy")` (skipped) — reverts `"Strategy not approved"`.
- `it("Should not whitelist if already whitelisted")` (skipped) — second add reverts `"Already whitelisted"`.
- `it("Should revert when removing unwhitelisted strategy")` (skipped) — reverts `"Not whitelisted"`.

**describe: "ForkTest: OETHb Vault" > "Mint & Burn For Strategy"** (entire block skipped via `describe.skip`; `beforeEach` deploys `MockStrategy`, governor approves + whitelists it, and the strategy address is impersonated as `strategySigner`; identical to Plume's skipped block except the rebase in the first test is called by the strategist)
- `it("Should allow a whitelisted strategy to mint and burn")` (skipped) — after strategist `rebase()`: `mintForStrategy(1e18)` gives the mock strategy exactly 1e18 OETHb and `totalSupply == before + 1e18`; `burnForStrategy(1e18)` restores balance 0 and exact prior supply.
- `it("Should not allow a non-supported strategy to mint")` (skipped) — governor calls `mintForStrategy(1e18)`; reverts `"Unsupported strategy"`.
- `it("Should not allow a non-supported strategy to burn")` (skipped) — governor calls `burnForStrategy(1e18)`; reverts `"Unsupported strategy"`.
- `it("Should not allow a non-white listed strategy to mint")` (skipped) — `addresses.dead` approved but not whitelisted, impersonated; `mintForStrategy(1e18)` reverts `"Not whitelisted strategy"`.
- `it("Should not allow a non-white listed strategy to burn")` (skipped) — same setup; `burnForStrategy(1e18)` reverts `"Not whitelisted strategy"`.

### `test/vault/oethb-vault.base.js` — unit test (Base)

Fixture: `createFixtureLoader(defaultBaseFixture)` run in non-fork mode (local mocks: `MockWETH`, `MockAero`, and a deployed `MockStrategy` exposed as `fixture.mockStrategy`), loaded in each describe's `beforeEach`. Contracts under test: OETHb Vault (`OETHBaseVaultProxy` as `IVault`) and the OETHb token. This is the active (unit) counterpart of the two skipped fork-test blocks above, but it uses the fixture's `mockStrategy` instead of `addresses.dead`, and the "not whitelisted" tests are set up by removing an already-whitelisted strategy rather than never whitelisting it. Top-level describe is `"OETHb Vault"`.

**describe: "OETHb Vault" > "Mint Whitelist"**
- `it("Should allow a strategy to be added to the whitelist")` — governor `approveStrategy(mockStrategy)` then `addStrategyToMintWhitelist(mockStrategy)`; expects event `StrategyAddedToMintWhitelist` and `isMintWhitelistedStrategy(mockStrategy)` == true.
- `it("Should allow a strategy to be removed from the whitelist")` — approve + add, then `removeStrategyFromMintWhitelist(mockStrategy)`; expects event `StrategyRemovedFromMintWhitelist` and getter false.
- `it("Should not allow non-governor to add to whitelist")` — rafael's `addStrategyToMintWhitelist(mockStrategy)` reverts `"Caller is not the Governor"`.
- `it("Should not allow non-governor to remove from whitelist")` — rafael's `removeStrategyFromMintWhitelist(mockStrategy)` reverts `"Caller is not the Governor"`.
- `it("Should not allow adding unapproved strategy")` — governor adds `mockStrategy` without prior `approveStrategy`; reverts `"Strategy not approved"`.
- `it("Should not whitelist if already whitelisted")` — approve + add, then second add reverts `"Already whitelisted"`.
- `it("Should revert when removing unwhitelisted strategy")` — remove without prior add; reverts `"Not whitelisted"`.

**describe: "OETHb Vault" > "Mint & Burn For Strategy"** (`beforeEach`: reload fixture, governor `approveStrategy` + `addStrategyToMintWhitelist` on `fixture.mockStrategy`, impersonate/fund the strategy address as `strategySigner`)
- `it("Should allow a whitelisted strategy to mint and burn")` — governor `rebase()` first; `mintForStrategy(1e18)` from the strategy signer: strategy's OETHb balance exactly 1e18, `totalSupply` exactly `before + 1e18`; then `burnForStrategy(1e18)`: balance exactly 0, `totalSupply` exactly back to `before`.
- `it("Should not allow a non-supported strategy to mint")` — governor calls `mintForStrategy(1e18)`; reverts `"Unsupported strategy"`.
- `it("Should not allow a non-supported strategy to burn")` — governor calls `burnForStrategy(1e18)`; reverts `"Unsupported strategy"`.
- `it("Should not allow a non-white listed strategy to mint")` — governor first `removeStrategyFromMintWhitelist(mockStrategy)` (strategy stays approved); then `mintForStrategy(1e18)` from the strategy signer reverts `"Not whitelisted strategy"`.
- `it("Should not allow a non-white listed strategy to burn")` — same de-whitelist setup; `burnForStrategy(1e18)` from the strategy signer reverts `"Not whitelisted strategy"`.

### `test/vault/harvester.base.fork-test.js` — fork test (Base)

Fixture: `createFixtureLoader(defaultBaseFixture)`; `beforeEach` reloads the fixture then advances time 12h and 300 blocks to simulate reward accrual. Contract under test: `SuperOETHHarvester` at `OETHBaseHarvesterProxy` (`harvester`), interacting with `AerodromeAMOStrategy` (+ its Aerodrome CL gauge `aeroClGauge`), `BaseCurveAMOStrategy` (`curveAMOStrategy`), the OETHb vault (acting as the harvester's dripper), and AERO/CRV/WETH tokens. All tests live directly under the single describe `"ForkTest: OETHb Harvester"` (no nested describes). A large block of `harvestAndSwap` tests is individually `it.skip`-ped (the swap path appears retired in favor of plain `harvestAndTransfer`).

**describe: "ForkTest: OETHb Harvester"**
- `it("should have whitelisted the strategies")` — `harvester.supportedStrategies(aerodromeAmoStrategy)` and `harvester.supportedStrategies(curveAMOStrategy)` are both true.
- `it("should have vault configured as the dripper")` — `harvester.dripper()` equals `oethbVault.address`.
- `it("Should harvest from Aerodrome AMO strategy")` — reads pending AERO via `aeroClGauge.earned(strategy, strategy.tokenId())`; strategist calls `harvestAndTransfer(address)` (explicit overload signature) on the Aerodrome strategy; asserts strategist AERO balance >= `before + pendingRewards` (gte, since more may accrue), gauge `earned` afterwards is exactly 0, and a second `harvestAndTransfer` call with nothing to collect succeeds as a no-op (does not revert).
- `it("Should harvest from Curve AMO strategy")` — seeds the Curve AMO strategy with 100 CRV via `setERC20TokenBalance` to mimic incentives; strategist calls `harvestAndTransfer(address)`; asserts strategist CRV balance >= `before + 100e18`; a second call with nothing to collect succeeds as a no-op.
- `it("Should not harvest when strategist address isn't set")` — governor calls `harvester.setStrategistAddr(addresses.zero)`; seeds the Aerodrome strategy with 100 AERO; governor's `harvestAndTransfer(aerodromeAmoStrategy)` reverts `"Invalid receiver"`.
- `it("Should not harvest when the strategy isn't whitelisted")` — (setup incidentally zeroes the vault's strategist via `oethbVault.setStrategistAddr(addresses.zero)`); governor's `harvestAndTransfer(addresses.dead)` reverts `"Strategy not supported"`.
- `it("Should harvest and then swap")` (skipped, `it.skip`) — early-returns silently if pending AERO < 100; strategist calls `harvestAndSwap(100e18 AERO, 0 minWETH, 2000 feeBps, true fundDripper)`; extracts `amountOut` from the emitted `RewardTokenSwapped` event; computes fee = 20% of WETH out and protocolYield = remaining 80%; asserts strategist AERO balance >= `before + pendingRewards − 100e18`, strategist WETH ≈ `before + fee` (`approxEqualTolerance`), dripper WETH ≈ `before + protocolYield`, and gauge `earned` == 0.
- `it("Should harvest and then swap but not fund Dripper")` (skipped) — same flow with `fundDripper=false`: strategist WETH ≈ `before + fee + protocolYield`, dripper WETH ≈ unchanged, plus the same AERO-balance and earned==0 checks.
- `it("Should harvest and then swap (0% fee)")` (skipped) — `feeBps=0`, `fundDripper=true`: fee = 0 so strategist WETH ≈ unchanged and dripper WETH ≈ `before + amountOut`; same AERO/earned checks.
- `it("Should harvest and then swap (100% fee)")` (skipped) — `feeBps=10000`, `fundDripper=true`: strategist WETH ≈ `before + amountOut`, dripper WETH ≈ unchanged; same AERO/earned checks.
- `it("Should not harvest & swap with no dripper address")` (skipped) — governor sets `oethbVault.setDripper(addresses.zero)`; `harvestAndSwap(100e18, 0, 2000, true)` reverts `"Yield recipient not set"`.
- `it("Should not allow harvest & swap by non-governor/strategist")` (skipped) — nick's `harvestAndSwap(100e18, 0, 2000, true)` reverts `"Caller is not the Strategist or Governor"`.
- `it("Should not allow harvest & swap with incorrect feeBps")` (skipped) — strategist's `harvestAndSwap(100e18, 0, 10001, true)` reverts `"Invalid Fee Bps"`.
- `it("Should use strategist balance when needed for swaps")` (skipped) — early-returns if no pending AERO; caps swap amount at 100 AERO; strategist approves harvester for 1,000,000 AERO; calls `harvest()` first so the strategist holds the rewards, then `harvestAndSwap(amount, 0, 2000, true)`; asserts strategist AERO ≈ `before − amount` within 2% (`approxEqualTolerance(..., 2)`), i.e. the swap pulled tokens from the strategist's own balance.
- `it("Should not harvest/swap when strategist address isn't set")` (skipped) — governor sets `oethbVault.setStrategistAddr(addresses.zero)`; `harvestAndSwap(100e18, 0, 2000, true)` reverts `"Guardian address not set"`.
- `it("Should allow governor/strategist to transfer any arbitrary token")` — clement "accidentally" transfers 1 WETH to the harvester; strategist recovers 0.4 WETH via `transferToken(weth, 0.4e18)` and governor recovers the remaining 0.6 via `transferToken(weth, 0.6e18)`; asserts the strategist's WETH balance is exactly `before + 1e18` (both recoveries pay out to the strategist address).
- `it("Should not allow anyone else to recover tokens")` — clement transfers 1 WETH to the harvester, then his own `transferToken(weth, 1e18)` reverts `"Caller is not the Strategist or Governor"`.

### `test/vault/permissioned-rebase.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `loadDefaultFixture()` from `_fixture.js` in `beforeEach`; `this.timeout(0)` and `this.retries(3)` on CI. Contracts under test: the OUSD vault (`VaultProxy`) and OETH vault (`OETHVaultProxy`), each fetched at runtime and wrapped as `IVault`. The file loops over `[["OUSD","VaultProxy"], ["OETH","OETHVaultProxy"]]`, generating a describe per vault — so the single source `it()` runs twice (2 test instances).

**describe: "ForkTest: permissioned rebase" > "OUSD vault"** (loop instance 1, `VaultProxy`) / **"OETH vault"** (loop instance 2, `OETHVaultProxy`)
- `it("Should let the operator rebase and revert for unauthorized callers")` — asserts `vault.operatorAddr()` equals `addresses.talosRelayer` (case-insensitive compare; the deploy proposal sets the operator to the Talos relayer); impersonates and funds the operator, who then calls `rebase()` successfully; asserts `lastRebase()` after >= before (only monotonicity, since yield isn't controlled on the fork — `lastRebase` only advances on yield-producing rebases); finally, a random EOA (`anna`) calling `rebase()` reverts with exactly `"Caller not authorized"`.

---

# 05 — OUSD token core + transfers (unit)

## OUSD token core + transfers (unit)

This section covers the core OUSD ERC-20 / rebasing-token unit tests: metadata, transfer/transferFrom across every combination of rebasing and non-rebasing account, credit accounting (`creditsBalanceOf`, `rebasingCreditsHighres`, `nonRebasingSupply`), rebase opt-in/opt-out state machine, yield delegation (`delegateYield`/`undelegateYield`), legacy "old code" migrated-account storage layouts, and an exhaustive account-type transfer/delegation matrix that enforces the totalSupply / nonRebasingSupply invariants. All tests run against local mocks (no fork); both files guard `if (isFork) this.timeout(0)` but are unit tests in practice.

Files covered:
- `test/token/ousd.js` (45 `it()` blocks)
- `test/token/token-transfers.js` (163 `it()` blocks: 1 static + 81 generated transfer variants + 81 generated delegation variants; 41 of the generated ones are `it.skip`)

Total `it()` blocks documented: **208**.

---

### `test/token/ousd.js` — unit test (mainnet/local mocks)

Context: `beforeEach` loads `createFixtureLoader(instantRebaseVaultFixture)` from `test/_fixture.js` — the default unit fixture (OUSD proxy + Vault proxy + mock stablecoins; Matt and Josh each hold 100 OUSD minted from USDC) with the VaultCore implementation swapped to `MockVaultCoreInstantRebase` (USDC-funded), so transferring USDC straight to the vault and calling `vault.rebase()` applies simulated yield instantly. Contracts under test: `OUSD` (via `OUSDProxy`), `IVault`, and two `MockNonRebasing` helper contracts (`mockNonRebasing`, `mockNonRebasingTwo`) that proxy transfer/approve/mint/redeem/rebaseOptIn/rebaseOptOut calls so `msg.sender` is a contract. Many tests end with a shared "manual supply invariant": `rebasingCreditsHighres() * 1e18 / rebasingCreditsPerTokenHighres() + nonRebasingSupply()` ≈ `totalSupply()` (approxEqual). The nested `describe("Old code migrated contract accounts")` overrides `beforeEach` with `loadTokenTransferFixture()` (see the token-transfers.js context below), which additionally exposes `ousdUnlocked` — a `TestUpgradedOUSD` handle at the same OUSD proxy address with test-only setters `overwriteCreditBalances` / `overwriteAlternativeCPT` / `overwriteRebaseState`.

**describe: "Token"**

- `it("Should return the token name and symbol")` — assertions: `ousd.name()` equals `"Origin Dollar"`, `ousd.symbol()` equals `"OUSD"`.
- `it("Should have 18 decimals")` — assertions: `ousd.decimals()` equals 18.
- `it("Should return 0 balance for the zero address")` — assertions: `balanceOf(0x0)` equals 0.
- `it("Should not allow anyone to mint OUSD directly")` — assertions: Matt calling `ousd.mint(matt, 100)` reverts with exact string `"Caller is not the Vault"`; Matt's balance remains exactly 100.00 OUSD.
- `it("Should allow a simple transfer of 1 OUSD")` — assertions: pre-state Anna 0 / Matt 100; after `transfer(anna, 1)` Anna has exactly 1 and Matt exactly 99.
- `it("Should allow a transferFrom with an allowance")` — assertions: after Matt approves Anna for 1000, `allowance(matt, anna)` equals 1000; Anna `transferFrom(matt→anna, 1)` succeeds; Anna balance exactly 1; allowance reduced to exactly 999.
- `it("Should transfer the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken")` — setup: Josh transfers 100 OUSD to `mockNonRebasing` (auto-migrates it to non-rebasing, fixing its creditsPerToken). Assertions: Matt ≈100 and contract ≈100 (approxBalanceOf); after simulated yield (200 USDC to vault + `rebase()`) the contract's `creditsBalanceOf(...)[1]` (creditsPerToken) is exactly unchanged; manual supply invariant ≈ `totalSupply()`; additionally `rebasingCreditsPerTokenHighres()` ≈ `rebasingCreditsPerToken() * 1e9` within 0.01% tolerance.
- `it("Should transfer the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken")` — setup: Josh→contract 100 (Matt ≈100, Josh ≈0, contract ≈100); yield 200 + rebase → Matt ≈300 (receives all rebasing yield). Assertions: after Matt→contract 50, Matt ≈250 and contract ≈150; manual supply invariant ≈ totalSupply.
- `it("Should transfer the correct amount from a non-rebasing account without previously set creditssPerToken to a rebasing account")` — setup: Josh→contract 100 (Matt ≈100, Josh ≈0, contract ≈100). Assertions: after `mockNonRebasing.transfer(matt, 100)` Matt ≈200, Josh ≈0, contract ≈0; manual supply invariant ≈ totalSupply.
- `it("Should transfer the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account")` — setup: Josh→contract 100; yield 200 + rebase (Matt ≈300); Matt→contract 50 (Matt ≈250, contract ≈150). Assertions: after `mockNonRebasing.transfer(josh, 150)` Matt ≈250, Josh ≈150, contract ≈0; manual supply invariant ≈ totalSupply.
- `it("Should transfer the correct amount from a non-rebasing account to a non-rebasing account with different previously set creditsPerToken")` — setup: Josh→`mockNonRebasing` 50; yield 200 + rebase; Josh→`mockNonRebasingTwo` 50; yield 100 + rebase (so the two contracts have different fixed creditsPerToken); `mockNonRebasing.transfer(mockNonRebasingTwo, 10)`. Assertions: balances ≈40 and ≈60; supply invariant computed manually — each contract's balance derived as `creditsBalanceOf[0] * 1e18 / creditsBalanceOf[1]`, added to `rebasingCreditsHighres * 1e18 / rebasingCreditsPerTokenHighres`, ≈ `totalSupply()`.
- `it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken")` — setup: Matt approves Josh for 100; Josh `transferFrom(matt→mockNonRebasing, 100)`. Assertions: Matt ≈0, contract ≈100; after yield 200 + rebase, contract `creditsBalanceOf[...][1]` exactly unchanged; manual supply invariant ≈ totalSupply.
- `it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken")` — setup: Matt approves Josh for 150; `transferFrom` 50 (Matt ≈50, contract ≈50); yield 200 + rebase; `transferFrom` another 50. Assertions: contract ≈100; manual supply invariant ≈ totalSupply.
- `it("Should transferFrom the correct amount from a non-rebasing account without previously set creditsPerToken to a rebasing account")` — setup: Josh→contract 100 (Matt ≈100, Josh ≈0, contract ≈100); contract approves Matt for 100. Assertions: Matt `transferFrom(contract→matt, 100)` → Matt ≈200, Josh ≈0, contract ≈0; manual supply invariant ≈ totalSupply.
- `it("Should transferFrom the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account")` — setup: Josh→contract 100; yield 200 + rebase (Matt ≈300); Matt→contract 50 (Matt ≈250, contract ≈150); contract approves Matt for 150. Assertions: Matt `transferFrom(contract→matt, 150)` → Matt ≈400, Josh ≈0, contract ≈0; manual supply invariant ≈ totalSupply.
- `it("Should allow a governanceRebaseOptIn call")` — assertions: governor calling `governanceRebaseOptIn(mockNonRebasing)` succeeds (no revert; no state assertions).
- `it("Should not allow a governanceRebaseOptIn of a zero address")` — assertions: governor calling `governanceRebaseOptIn(0x0)` reverts with `"Zero address not allowed"`.
- `it("Should maintain the correct balances when rebaseOptIn is called from non-rebasing contract")` — setup: Josh→contract 99.50 (sets a non-rebasing creditsPerToken); record initial `rebasingCreditsHighres` and `totalSupply`; yield 200 + rebase; contract still ≈99.50. Assertions: `mockNonRebasing.rebaseOptIn()` emits `AccountRebasingEnabled(mockNonRebasing.address)`; contract balance still ≈99.50; `totalSupply()` exactly equals the pre-optIn value; `rebasingCreditsHighres` increased by `99.50 * rebasingCreditsPerTokenHighres / 1e18 + 1` credits, with a 1-wei rounding tolerance (gte expected−1, lte expected); `totalSupply()` ≈ initialTotalSupply + 200; manual supply invariant ≈ totalSupply.
- `it("Should maintain the correct balance when rebaseOptOut is called from rebasing EOA")` — setup: Matt ≈100; yield 200 + rebase; record totalSupply, `rebasingCreditsHighres`, `rebasingCreditsPerTokenHighres`. Assertions: `rebaseOptOut()` from Matt emits `AccountRebasingDisabled(matt.address)`; Matt ≈200 (200 yield split evenly with Josh); `rebasingCreditsHighres` decreased by exactly `200 * initialCptHighres / 1e18`; `totalSupply()` exactly unchanged.
- `it("Calling rebaseOptIn / optOut in loop shouldn't keep increasing account's balance")` — loop variant: after yield 200 + rebase and one optOut/optIn cycle for Josh, record balance, then loop 10× `rebaseOptOut()` + `rebaseOptIn()`. Assertions: Josh's balance is exactly (equal) unchanged after the loop.
- `it("Should not allow EOA to call rebaseOptIn when already opted in to rebasing")` — assertions: Matt (default rebasing) calling `rebaseOptIn()` reverts with `"Account must be non-rebasing"` (an unrelated `usdc.mint(2)` happens first).
- `it("Should allow an EOA to call rebaseOptIn when already opted in to rebasing")` — setup: Matt transfers his entire OUSD balance to Josh. Assertions: Matt's `rebaseOptIn()` succeeds — an EOA in NotSet state may explicitly override to Rebasing without breaking invariants (despite the misleading test name, this is the zero-balance/NotSet override case).
- `it("Should not allow EOA to call rebaseOptOut when already opted out of rebasing")` — setup: Matt `rebaseOptOut()` once. Assertions: second `rebaseOptOut()` reverts with `"Account must be rebasing"`.
- `it("Should not allow contract to call rebaseOptIn when already opted in to rebasing")` — setup: `mockNonRebasing.rebaseOptIn()`. Assertions: second `rebaseOptIn()` reverts with `"Only standard non-rebasing accounts can opt in"`.
- `it("Should not allow contract to call rebaseOptOut when already opted out of rebasing")` — setup: Matt transfers 1 OUSD to `mockNonRebasing`, auto-migrating it to StdNonRebasing. Assertions: `rebaseOptOut()` reverts with `"Account must be rebasing"`.
- `it("Should allow a contract to call rebaseOptOut if no other action causing auto-converting has happened")` — assertions: a fresh `mockNonRebasing` (NotSet, never touched) can call `rebaseOptOut()` without revert.
- `it("Should maintain the correct balance on a partial transfer for a non-rebasing account without previously set creditsPerToken")` — setup: `mockNonRebasing.rebaseOptIn()` first (so no fixed creditsPerToken gets set on receipt); Josh→contract 100 (contract ≈100); Matt `rebaseOptOut()`. Assertions: `mockNonRebasing.transfer(matt, 50)` → contract ≈50, Matt ≈150; then `transfer(matt, 25)` → contract ≈25, Matt ≈175.
- `it("Should maintain the same totalSupply on many transfers between different account types")` — loop variant: setup gives `mockNonRebasing` 50 (from Josh) and `mockNonRebasingTwo` 50 (from Matt), then arranges four account types — Josh `rebaseOptOut()` (non-rebasing EOA), Matt (rebasing EOA), `mockNonRebasing` (non-rebasing contract), `mockNonRebasingTwo.rebaseOptIn()` (rebasing contract). 10 rounds × each of the 4 accounts transfers half its balance to a randomly chosen account (contract senders via `MockNonRebasing.transfer`, EOAs via `ousd.transfer`). Assertions: after every single transfer, `totalSupply()` exactly equals the initial total supply.
- `it("Should revert a transferFrom if an allowance is insufficient")` — setup: Matt approves Anna for 10; `allowance(matt, anna)` equals exactly 10. Assertions: Anna `transferFrom(matt→anna, 100)` reverts with `"Allowance exceeded"`.
- `it("Should increase users balance on supply increase")` — setup: Matt→Anna 1 (Matt 99, Anna 1); mint 2 USDC to Matt, transfer to vault, `rebase()` (vault $200 → $202). Assertions: Matt's balance is (99/200)×202 = 99.99 OUSD with a 1-wei protocol-favouring round-down tolerance (gte 99.99−1 wei, lte 99.99); Anna's balance is (1/200)×202 = 1.01 with the same 1-wei tolerance.
- `it("Should mint correct amounts on non-rebasing account without previously set creditsPerToken")` — setup: Josh sends 100 USDC to `mockNonRebasing`; contract balance of OUSD is 0; contract `approveFor(usdc, vault, 100)`. Assertions: `mockNonRebasing.mintOusd(vault, 50)` emits `AccountRebasingDisabled(mockNonRebasing.address)`; `totalSupply()` exactly equals before + 50; `nonRebasingSupply()` ≈ 50; manual supply invariant ≈ totalSupply.
- `it("Should mint correct amounts on non-rebasing account with previously set creditsPerToken")` — setup: as above, mint 50 (totalSupply exactly +50); record contract `creditsBalanceOf`; yield 200 + rebase. Assertions: contract's creditsPerToken now differs from Josh's (rebasing) creditsPerToken (`not.equal`); second `mintOusd(vault, 50)` → `totalSupply()` exactly equals before + 100 + 200 (mints + simulated yield); contract balance exactly 100; `nonRebasingSupply()` ≈ 100; manual supply invariant ≈ totalSupply.
- `it("Should burn the correct amount for non-rebasing account")` — setup: Josh sends 100 USDC to contract; contract mints 50 OUSD (totalSupply exactly +50); yield 200 + rebase; contract creditsPerToken differs from Josh's. Assertions: `mockNonRebasing.redeemOusd(vault, 25)` → `totalSupply()` exactly equals before + 225 (+50 mint +200 yield −25 burn); contract balance exactly 25; `nonRebasingSupply()` ≈ 25; manual supply invariant ≈ totalSupply.
- `it("Should exact transfer to new contract accounts")` — loop variant: setup mints and transfers 9,671.2345 USDC of yield to the vault + `rebase()` so creditsPerToken needs high resolution. Then wei-exact transfer checks: transfer-in amounts of 1, 2, 5, 9, 100, 2, 5, 9 wei from Matt to `mockNonRebasing`, each asserting the receiver's balance increases by exactly the amount; then transfer-out of the same amount sequence from the contract back to Matt, each asserting the contract's balance decreases by exactly the amount.

**describe: "Token" > "Delegating yield"**

- `it("Should delegate rebase to another account")` — setup: Matt→Anna 10 and Matt→Josh 10 (Josh ≈110, Matt ≈80, Anna ≈10); governor calls `delegateYield(matt, anna)`; yield 200 + rebase. Assertions: Josh ≈220, Matt stays ≈80 (his yield delegated away), Anna exactly 100 (10 existing + 10 own rebase share + 80 delegated from Matt); Anna→Josh 10 → Josh ≈230, Matt ≈80, Anna exactly 90; then Matt→Josh 80 and Anna→Josh 90 → Josh ≈400, Matt ≈0, Anna exactly 0.
- `it("Should delegate rebase to another account initially having 0 balance")` — setup: Josh ≈100, Matt ≈100, Anna exactly 0; Matt `rebaseOptOut()` (TODO comment in test to delete this later); governor `delegateYield(matt, anna)`; yield 200 + rebase. Assertions: Josh ≈200, Matt stays ≈100, Anna exactly 100 (receives Matt's delegated yield); Anna→Josh 10 → Josh ≈210, Matt ≈100, Anna exactly 90.
- `it("Should not delegate yield from a zero address")` — assertions: governor `delegateYield(0x0, matt)` reverts with `"Zero from address not allowed"`.
- `it("Should not delegate yield to a zero address")` — assertions: governor `delegateYield(matt, 0x0)` reverts with `"Zero to address not allowed"`.
- `it("Should not delegate yield to self")` — assertions: governor `delegateYield(matt, matt)` reverts with `"Cannot delegate to self"`.

**describe: "Token" > "Old code migrated contract accounts"** — inner `beforeEach` replaces the fixture with `loadTokenTransferFixture()` (account-type fixture; provides `ousdUnlocked` = `TestUpgradedOUSD` at the OUSD proxy with storage-overwrite test hooks, plus the 16 pre-built account-type wallets described under token-transfers.js).

- `it("Old code auto migrated contract when calling rebase OptIn shouldn't affect invariables")` — uses `nonrebase_contract_notSet_altcpt_gt_0` (legacy account: rebaseState NotSet but alternativeCreditsPerToken > 0, balance 65). Assertions: after `rebaseOptIn()`, `nonRebasingSupply()` decreased by exactly the contract's OUSD balance (pre-supply − balance equals post-supply).
- `it("Non rebasing accounts with cpt set to 1e27 should return value non corrected for resolution increase")` — setup: transfer 10 OUSD from `rebase_eoa_notset_0` to `mockNonRebasing`; via `ousdUnlocked` overwrite `creditBalances[mockNonRebasing]` to 10×1e27 and alternativeCPT to 1e27. Assertions: `creditsBalanceOf(mockNonRebasing)` returns exactly (10×1e27, 1e27) — values are NOT divided by the 1e9 resolution-increase factor when cpt ≥ 1e27.
- `it("Should report correct creditBalanceOf and creditsBalanceOfHighres")` — setup: transfer 10 OUSD to `mockNonRebasing`; overwrite creditBalances = 5×1e26 and alternativeCPT = 5×1e26. Assertions: `creditsBalanceOfHighres` returns exactly (5e26, 5e26); `nonRebasingCreditsPerToken(mockNonRebasing)` equals exactly 5e26; `creditsBalanceOf` returns both values scaled down by 1e9 resolution increase → exactly (5e17, 5e17).
- `it("Contract should auto migrate to StdNonRebasing")` — assertions: `rebaseState(nonrebase_contract_notSet_0)` equals 0 (NotSet) initially; after receiving a 10 OUSD transfer from `rebase_eoa_notset_0`, `rebaseState` equals 1 (StdNonRebasing).
- `it("Yield delegating account should not rebase opt out")` — assertions: `rebaseOptOut()` from `rebase_delegate_target_0` (YieldDelegationTarget) reverts with `"Only standard rebasing accounts can opt out"`.
- `it("Should not un-delegate yield from a zero address or address not part of yield delegation")` — assertions: governor `undelegateYield(0x0)` reverts with `"Zero address not allowed"`; governor `undelegateYield(rebase_eoa_notset_0)` (an account with no delegation entry) also reverts with `"Zero address not allowed"`.

---

### `test/token/token-transfers.js` — unit test (mainnet/local mocks)

Context: `describe("Account type variations")`; `beforeEach` loads `loadTokenTransferFixture()` from `test/_fixture.js`. That fixture runs the full unit-test deployment, mints 1000 OUSD to Matt via the Vault (USDC), then constructs 16 accounts covering every OUSD account-type storage configuration — fresh random EOAs, `MockNonRebasing` contract instances, and legacy layouts forged via `ousdUnlocked` (`TestUpgradedOUSD` storage-overwrite hooks: `overwriteCreditBalances`, `overwriteAlternativeCPT`, `overwriteRebaseState`) — and finally burns Matt's remaining OUSD via `vault.requestWithdrawal` so totalSupply is exactly the sum of the 16 balances. Contract under test: `OUSD` (via proxy). Account inventory (name → balance, rebaseState):

| account | balance | rebaseState | how it was built |
|---|---|---|---|
| `rebase_eoa_notset_0/1` | 11 / 12 | 0 NotSet | plain EOA, received transfer |
| `rebase_eoa_stdRebasing_0/1` | 21 / 22 | 2 StdRebasing | EOA optOut then optIn |
| `rebase_contract_0/1` | 33 / 34 | 2 StdRebasing | MockNonRebasing contract, rebaseOptIn |
| `nonrebase_eoa_0/1` | 44 / 45 | 1 StdNonRebasing | EOA rebaseOptOut |
| `nonrebase_contract_0/1` | 55 / 56 | 1 StdNonRebasing | contract optIn then optOut |
| `nonrebase_contract_notSet_0/1` | 0 / 0 | 0 NotSet | contract, never received tokens |
| `nonrebase_contract_notSet_altcpt_gt_0/1` | 65 / 66 | 0 NotSet, altCPT > 0 (0.934232e27 / 0.890232e27) | legacy migrated layout forged via ousdUnlocked overwrites |
| `rebase_delegate_source_0/1` | 76 / 87 | 3 YieldDelegationSource | governor delegateYield(source, target) |
| `rebase_delegate_target_0/1` | 77 / 88 | 4 YieldDelegationTarget | governor delegateYield(source, target) |

Global expectations used throughout: `totalSupply` == exactly 792 OUSD (sum of all 16 balances) and `nonRebasingSupply` == exactly 331 OUSD (44+45+55+56+65+66).

**describe: "Account type variations"**

- `it("Accounts and ousd contract should have correct initial states")` — assertions: for each of the 16 accounts above, `rebaseState(account)` equals the exact enum value (0 NotSet / 1 StdNonRebasing / 2 StdRebasing / 3 YieldDelegationSource / 4 YieldDelegationTarget) and `balanceOf` equals the exact balance from the table; plus `totalSupply()` equals exactly 792 OUSD and `nonRebasingSupply()` equals exactly 331 OUSD.

**describe: "Account type variations" — generated transfer matrix (81 `it()` blocks, loop variant)**

Generated by a double loop over 9 `fromAccounts` (`rebase_eoa_notset_0`, `rebase_eoa_stdRebasing_0`, `rebase_contract_0`, `nonrebase_eoa_0`, `nonrebase_contract_0`, `nonrebase_contract_notSet_0`, `nonrebase_contract_notSet_altcpt_gt_0`, `rebase_delegate_source_0`, `rebase_delegate_target_0`) × 9 `toAccounts` (the corresponding `_1` variants: `rebase_eoa_notset_1`, `rebase_eoa_stdRebasing_1`, `rebase_contract_1`, `nonrebase_eoa_1`, `nonrebase_contract_1`, `nonrebase_contract_notSet_1`, `nonrebase_contract_notSet_altcpt_gt_1`, `rebase_delegate_source_1`, `rebase_delegate_target_1`). Each `from` account is tagged with `balancePartOfRebasingCredits` (true for rebase_eoa_notset, rebase_eoa_stdRebasing, rebase_contract, rebase_delegate_source/target; false for nonrebase_eoa, nonrebase_contract, nonrebase_contract_notSet, nonrebase_contract_notSet_altcpt_gt) and `isContract`; each `to` account with `balancePartOfRebasingCredits`.

- `it("Should transfer from ${fromName} to ${toName}")` × 81 — a randomized amount between 2 and 8 OUSD (`2 + Math.random()*6`) is transferred; contract senders use `MockNonRebasing.transfer(to, amount)`, EOA senders use `ousd.connect(from).transfer(to, amount)`. Assertions (all exact `equal`, no tolerance): sender balance decreases by exactly `amount`; receiver balance increases by exactly `amount`; `totalSupply()` stays exactly 792 OUSD; `nonRebasingSupply()` equals exactly 331 OUSD adjusted by −`amount` if the sender is non-rebasing (`balancePartOfRebasingCredits: false`) and +`amount` if the receiver is non-rebasing. The 9 variants with `fromName == nonrebase_contract_notSet_0` are (skipped) via `it.skip` (`skipTransferTest: true` — the account holds 0 balance), leaving 72 active tests.

**describe: "Account type variations" — generated yield-delegation matrix (81 `it()` blocks, loop variant)**

Same 9×9 from/to account grid; each side additionally tagged `inYieldDelegation` (true only for `rebase_delegate_source_*` and `rebase_delegate_target_*`).

- `it("Non rebasing supply should be correct when ${fromName} delegates to ${toName}")` × 81 — governor calls `delegateYield(from, to)`. Assertions (all exact `equal`): both accounts' balances are unchanged by the delegation; `totalSupply()` stays exactly 792 OUSD; `nonRebasingSupply()` equals exactly 331 OUSD minus the `from` balance if `from` was non-rebasing (`balancePartOfRebasingCredits: false`, becomes rebasing when delegating) and minus the `to` balance if `to` was non-rebasing (becomes rebasing as delegation target). Variants where either side is already in a yield delegation are (skipped) via `it.skip` — i.e. `from ∈ {rebase_delegate_source_0, rebase_delegate_target_0}` or `to ∈ {rebase_delegate_source_1, rebase_delegate_target_1}` — 32 skipped (81 − 7×7), leaving 49 active tests.

---

# Wrapped tokens + OToken fork tests (all chains)

## Wrapped tokens + OToken fork tests (all chains)

This area covers the ERC-4626 wrapper tokens (WOETH, WOUSD, wOS, and their bridged variants) plus lightweight per-chain OToken sanity fork tests. The two unit files exercise deposit/mint/withdraw/redeem exchange-rate math against a mock instant-rebase vault, donation-attack resistance, proxy ERC-20 metadata, and governor-only token recovery. The mainnet WOETH fork test verifies live 4626 behavior (event-derived shares/assets, donation resistance, rebase pass-through, adjuster). The Base/Arbitrum WOETH fork tests cover the bridged AccessControl mint/burn token (MINTER_ROLE/BURNER_ROLE/DEFAULT_ADMIN_ROLE). The remaining fork files are small config/state checks for wOUSD, wOS, OETH (mainnet, incl. yield delegation and EIP-7702 rebasing), superOETHb (Base), superOETHp (Plume), and OS (Sonic yield forwarding). None of these files consume or define `test/behaviour/` shared suites.

Files covered:
- `test/token/woeth.js` (unit)
- `test/token/wousd.js` (unit)
- `test/token/woeth.mainnet.fork-test.js` (fork, mainnet)
- `test/token/woeth.base.fork-test.js` (fork, Base)
- `test/token/woeth.arb.fork-test.js` (fork, Arbitrum)
- `test/token/wousd.mainnet.fork-test.js` (fork, mainnet)
- `test/token/wos.sonic.fork-test.js` (fork, Sonic)
- `test/token/oeth.mainnet.fork-test.js` (fork, mainnet)
- `test/token/oeth.base.fork-test.js` (fork, Base)
- `test/token/oeth.plume.fork-test.js` (fork, Plume)
- `test/token/os.sonic.fork-test.js` (fork, Sonic)

Total: 72 `it()` blocks (2 of which are `it.skip`).

### `test/token/woeth.js` — unit test (mainnet mocks)

Fixture: `createFixtureLoader(instantRebaseVaultFixture, "weth")` — upgrades both `VaultProxy` and `OETHVaultProxy` implementations to `MockVaultCoreInstantRebase` (WETH-backed) so that transferring WETH to the vault + `rebase()` instantly inflates OETH supply. Contracts under test: `WOETH` (4626 wrapper) against `OETH` and the mock OETH vault. beforeEach: matt and josh each mint 100 OETH via `oethVault.mint`; josh approves WOETH for 1000 OETH and deposits 50 OETH (gets 50 wOETH); then a helper (`increaseOETHSupplyAndRebase`) deposits WETH equal to the whole OETH totalSupply into the vault and rebases, doubling all OETH balances — so 1 wOETH = 2 OETH and josh starts every test with 100 OETH + 50 wOETH; WOETH totalSupply is 50 and holds ~100 OETH.

**describe: "WOETH" > "General functionality"**
- `it("Initialize2 should not be called twice")` — governor calling `woeth.initialize2()` (already called by fixture/deploy) reverts with exact string `"Initialize2 already called"`.
- `it("Initialize2 should not be called by non governor")` — josh calling `initialize2()` reverts with `"Caller is not the Governor"`.

**describe: "WOETH" > "Funds in, Funds out"**
- `it("should deposit at the correct ratio")` — starting from totalSupply 50, josh deposits another 50 OETH; asserts josh wOETH balance 75 (50 + 50/2), josh OETH balance 50, WOETH totalSupply 75.
- `it("should withdraw at the correct ratio")` — josh withdraws 50 OETH of assets; asserts josh wOETH balance 25 (burned 25 shares), josh OETH balance 150, totalSupply 25.
- `it("should mint at the correct ratio")` — josh mints 25 wOETH shares; asserts josh wOETH balance 75, josh OETH balance 50 (paid 50 OETH), totalSupply 75.
- `it("should redeem at the correct ratio")` — josh redeems all 50 wOETH shares; asserts josh wOETH balance 0, josh OETH balance 200 (received 100 OETH), totalSupply 0.
- `it("should be able to redeem all WOETH")` — matt approves and mints 50 wOETH (paying 100 OETH), so totalSupply 100 and `totalAssets()` exactly 200 OETH; then josh and matt each redeem 50 shares; asserts both wOETH balances 0, both OETH balances 200, totalSupply 0 and `totalAssets()` exactly 0.
- `it("should be allowed to deposit 0")` — `deposit(0, josh)` succeeds (no revert; no other assertions).
- `it("should be allowed to mint 0")` — `mint(0, josh)` succeeds.
- `it("should be allowed to redeem 0")` — `redeem(0, josh, josh)` succeeds.
- `it("should be allowed to withdraw 0")` — `withdraw(0, josh, josh)` succeeds.

**describe: "WOETH" > "Collects Rebase"**
- `it("should increase with an OETH rebase")` — precondition: totalSupply 50 and WOETH's OETH balance ~100 (approx matcher); funds josh with 250 native ETH via `hardhatSetBalance`, then adds 200 WETH to the vault and rebases; asserts WOETH's OETH balance grows to ~150 while wOETH totalSupply stays 50 (rebase accrues to holders via exchange rate, not share count).
- `it("should not increase exchange rate when OETH is transferred to the contract")` — donation attack: josh transfers 50 OETH directly to the WOETH contract, then redeems his 50 wOETH; asserts he still receives exactly the pre-donation entitlement (josh wOETH 0, WOETH's raw OETH balance ~50 = the stranded donation), `totalAssets()` returns exactly 0 and totalSupply 0 — i.e. the donation does not move the share price (WOETH tracks assets internally via credits/adjuster, not `balanceOf`).

**describe: "WOETH" > "Check proxy"**
- `it("should have correct ERC20 properties")` — `decimals() == 18`, `name() == "Wrapped OETH"`, `symbol() == "wOETH"`.

**describe: "WOETH" > "Token recovery"**
- `it("should allow a governor to recover tokens")` — matt transfers 2 USDS to the WOETH contract (balance checks: WOETH holds 2 USDS, governor holds 1000 USDS); governor calls `transferToken(usds, 2)`; asserts WOETH USDS balance 0 and governor 1002.
- `it("should not allow a governor to collect OETH")` — governor `transferToken(oeth, 2)` reverts with `"Cannot collect core asset"`.
- `it("should not allow a non governor to recover tokens ")` — josh `transferToken(oeth, 2)` reverts with `"Caller is not the Governor"`.

### `test/token/wousd.js` — unit test (mainnet mocks)

Fixture: `createFixtureLoader(instantRebaseVaultFixture)` (default USDC-backed `MockVaultCoreInstantRebase` swapped into the OUSD `VaultProxy`). Contracts under test: `WrappedOusd` (WOUSD) against `OUSD` and the mock vault. beforeEach: matt and josh start with 100 OUSD each (default fixture); josh approves WOUSD for 1000 OUSD and deposits 50 OUSD; then supply is doubled by minting USDC equal to OUSD totalSupply (scaled /1e12 to 6 decimals) to matt, transferring it to the vault and rebasing — so 1 wOUSD = 2 OUSD and josh starts each test with 100 OUSD + 50 wOUSD.

**describe: "WOUSD" > "Funds in, Funds out"**
- `it("should deposit at the correct ratio")` — josh deposits another 50 OUSD; asserts josh wOUSD balance 75 and OUSD balance 50. (Also `console.log`s josh's wOUSD balance first — no assertion.)
- `it("should withdraw at the correct ratio")` — josh withdraws 50 OUSD of assets; asserts josh wOUSD 25 and OUSD 150.
- `it("should mint at the correct ratio")` — josh mints 25 wOUSD shares; asserts josh wOUSD 75 and OUSD 50.
- `it("should redeem at the correct ratio")` — precondition josh has 50 wOUSD; redeems 50 shares; asserts josh wOUSD 0 and OUSD 200.

**describe: "WOUSD" > "Collects Rebase"**
- `it("should increase with an OUSD rebase")` — precondition: WOUSD's OUSD balance ~100 (approx); josh transfers 200 USDC to the vault and rebases; asserts WOUSD's OUSD balance grows to ~150.

**describe: "WOUSD" > "Check proxy"**
- `it("should have correct ERC20 properties")` — `decimals() == 18`, `name() == "Wrapped OUSD"`, `symbol() == "WOUSD"` (note: uppercase, unlike wOETH).

**describe: "WOUSD" > "Token recovery"**
- `it("should allow a governor to recover tokens")` — matt sends 2 USDC to WOUSD (checks WOUSD holds 2 USDC, governor 1000); governor `transferToken(usdc, 2)`; asserts WOUSD 0 and governor 1002 USDC.
- `it("should not allow a governor to collect OUSD")` — governor `transferToken(ousd, 2)` reverts with `"Cannot collect core asset"`.
- `it("should not allow a non governor to recover tokens ")` — josh `transferToken(ousd, 2)` reverts with `"Caller is not the Governor"`.

**describe: "WOUSD" > "WOUSD upgrade"**
- `it("should be upgradable")` — deploys `MockLimitedWrappedOusd` (constructor arg: OUSD address) and has governor `upgradeTo` it on `WrappedOUSDProxy`; asserts metadata preserved (decimals 18, name "Wrapped OUSD", symbol "WOUSD"); asserts pre-upgrade state preserved (WOUSD holds 100 OUSD, josh 50 wOUSD, matt 0 wOUSD); the mock caps deposits at 1 OUSD: a 1-OUSD deposit succeeds and a 25-OUSD deposit reverts with `"ERC4626: deposit more then max"` (sic).

### `test/token/woeth.mainnet.fork-test.js` — fork test (mainnet)

Fixture: local `oethWhaleFixture` wrapping `simpleOETHFixture` (from `test/_fixture.js`) — domen mints 20,000 OETH through the real `oethVault` and approves WOETH for 20,000 OETH. Contracts under test: deployed mainnet `WOETH` (post-adjuster upgrade) + `OETH` + `OETHVault`. `this.timeout(0)`.

**describe: "ForkTest: wOETH"** (top-level its)
- `it("Should have correct name and symbol and adjuster")` — `name() == "Wrapped OETH"`, `symbol() == "wOETH"`, `adjuster() > 0` (proves the adjuster-based accounting upgrade is initialized).
- `it("Should prevent total asset manipulation by donations")` — records `totalAssets()`, domen transfers 100 OETH directly to the WOETH contract, asserts `totalAssets()` is exactly unchanged.
- `it("Deposit should not be manipulated by donations")` — domen starts with ~0 wOETH; deposits 1000 OETH; snapshots share price as `convertToAssets(1000)`; donates 10,000 OETH straight to the contract (note: transfer not awaited in source); asserts share price after donation `approxEqual` to before (message "Price manipulation"); deposits another 1000 OETH; asserts domen's wOETH balance ≈ `2000 * 1000 / sharePriceAfterDonate` (i.e. both deposits priced at the un-manipulated rate).
- `it("Withdraw should not be manipulated by donations")` — domen starts with ~0 wOETH and ~20,000 OETH; deposits 3000 OETH; snapshots `convertToAssets(1000)`; donates 10,000 OETH to the contract; asserts share price unchanged (approxEqual, "Price manipulation"); withdraws `maxWithdraw(domen)`; asserts domen ends with ~10,000 OETH (20,000 − 10,000 donated; the 3000 round-trips back, donation stays stranded).

**describe: "ForkTest: wOETH" > "Funds in, Funds out"**
- `it("should deposit at the correct ratio")` — domen deposits 50 OETH; parses the tx receipt's third event (index 2, the ERC-4626 `Deposit` event after the two ERC-20 `Transfer`s) for `shares`/`assets` args; asserts `assets == 50 OETH` exactly, `convertToShares(assets) ≈ shares` (approxEqual), wOETH totalSupply == prior supply + mintedShares (exact), domen's wOETH balance == mintedShares (exact), domen's OETH balance == prior balance − assets (exact).
- `it("should withdraw at the correct ratio")` — after depositing 50 OETH, withdraws `maxWithdraw(domen)`; from the `Withdraw` event (index 2) asserts `assets ≈ 50 OETH`, `convertToShares(assets) ≈ burnedShares`, totalSupply == prior − burnedShares (exact), domen wOETH balance == 0 (exact), domen OETH balance ≈ prior + assets.
- `it("should mint at the correct ratio")` — domen mints 25 wOETH shares; from `Deposit` event asserts `shares == 25` exactly, `convertToAssets(shares) ≈ assets`, totalSupply == prior + shares (exact), domen wOETH == mintedShares (exact), domen OETH == prior − assets (exact).
- `it("should redeem at the correct ratio")` — after minting 25 shares, redeems `maxRedeem(domen)`; from `Withdraw` event asserts `shares == 25` exactly, `convertToAssets(shares) ≈ assets`, totalSupply == prior − shares (exact), domen wOETH == 0, domen OETH ≈ prior + assets.
- `it("should redeem at the correct ratio after rebase")` — domen deposits 50 OETH; then a real rebase is triggered (josh funded with 250 ETH via `hardhatSetBalance`, wraps 200 WETH, transfers it to the OETH vault, strategist calls `rebase()`); asserts `totalAssets()` increased; domen redeems `maxRedeem`; computes 1e18-scaled rate increases: domen's OETH-balance growth rate vs. the wOETH redemption growth rate (`(assetsOut − 50) / 50`); asserts the two rates equal within ±2 wei (`withinRange`), that assets transferred > initial deposit (note: assertion written without matcher — effectively a no-op in source), `burnedShares ≈ convertToShares(assetsTransferred)`, and domen ends with 0 wOETH.

**describe: "ForkTest: wOETH redeem balances"** (separate top-level describe, deliberately not using the whale fixture)
- `it.skip("upgrade of WOETH shouldn't change WOETH balances, or redemption amounts")` (skipped — meant to be run manually with the fork pinned to block 22116006) — hardcodes 5 mainnet holder addresses with their pre-`112_upgrade_woeth` wOETH balances and expected OETH redemption amounts (e.g. `0xdCa0...6d0` → 16231824385055731314284 wOETH / 18229274520877989755302 OETH); for each account asserts `balanceOf` equals the recorded balance exactly and `previewRedeem(balance)` matches the recorded redeem amount within ±1 wei.

### `test/token/woeth.base.fork-test.js` — fork test (Base)

Fixture: `createFixtureLoader(defaultBaseFixture)` from `test/_fixture-base.js`, which grants `MINTER_ROLE` to a `minter` signer and `BURNER_ROLE` to a `burner` signer via governor. Contract under test: bridged `WOETH` on Base (plain AccessControl-gated mint/burn ERC-20, not a 4626 vault). Role hashes: MINTER_ROLE = `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`, BURNER_ROLE = `0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848`, DEFAULT_ADMIN_ROLE = `0x00…00`.

**describe: "ForkTest: Bridged wOETH (Base)"**
- `it("Should have right config")` — `decimals() == 18`, `symbol() == "wOETH"`, `name() == "Wrapped OETH"`.
- `it("Should allow minter to mint")` — minter mints 1.2344 wOETH to rafael; asserts totalSupply diff and rafael balance diff both exactly 1.2344e18.
- `it("Should not allow anyone else to mint")` — loop over [governor, rafael, nick, burner]: each `mint(self, 1)` reverts with exact string `` `AccessControl: account ${addr.toLowerCase()} is missing role 0x9f2d…56a6` `` (MINTER_ROLE).
- `it("Should allow burner to burn")` — burner calls `burn(address,uint256)` burning 0.787 from nick; asserts totalSupply and nick balance both decrease by exactly 0.787e18.
- `it("Should allow burner to burn using sugar method")` — nick transfers 0.787 wOETH to burner; burner calls `burn(uint256)` (self-burn overload); asserts totalSupply and burner balance both decrease by exactly 0.787e18.
- `it("Should not allow anyone else to burn")` — loop over [governor, rafael, nick, minter]: `burn(address,uint256)` reverts with `` `AccessControl: account ${addr} is missing role 0x3c11…a848` `` (BURNER_ROLE).
- `it("Should allow Governor to grant roles")` — governor grants MINTER_ROLE to rafael and BURNER_ROLE to nick; asserts `hasRole` true for both.
- `it("Should not allow anyone else to grant roles")` — loop over [rafael, nick, minter, burner]: `grantRole(MINTER_ROLE, rafael)` reverts with `` `AccessControl: account ${addr} is missing role 0x00…00` `` (DEFAULT_ADMIN_ROLE).
- `it("Should allow Governor to revoke roles")` — governor revokes MINTER_ROLE from minter and BURNER_ROLE from burner; asserts `hasRole` false for both.
- `it("Should not allow anyone else to revoke roles")` — loop over [rafael, nick, minter, burner]: `revokeRole(BURNER_ROLE, burner)` reverts with the DEFAULT_ADMIN_ROLE AccessControl message.

### `test/token/woeth.arb.fork-test.js` — fork test (Arbitrum)

Fixture: `createFixtureLoader(defaultArbitrumFixture)` from `test/_fixture-arb.js` (grants MINTER_ROLE/BURNER_ROLE the same way). Contract under test: bridged `WOETH` on Arbitrum. This file is an exact mirror of the Base file (same 10 tests, same amounts 1.2344 / 0.787 / 1, same role hashes and exact AccessControl revert strings) with two differences: the top describe is `"ForkTest: WOETH"` and the expected symbol is `"WOETH"` (uppercase) instead of `"wOETH"`.

**describe: "ForkTest: WOETH"**
- `it("Should have right config")` — `decimals() == 18`, `symbol() == "WOETH"`, `name() == "Wrapped OETH"`.
- `it("Should allow minter to mint")` — identical to Base variant (mint 1.2344 to rafael; exact supply/balance diffs).
- `it("Should not allow anyone else to mint")` — identical to Base variant (loop [governor, rafael, nick, burner]; MINTER_ROLE AccessControl revert).
- `it("Should allow burner to burn")` — identical to Base variant (`burn(address,uint256)` 0.787 from nick).
- `it("Should allow burner to burn using sugar method")` — identical to Base variant (`burn(uint256)` self-burn 0.787).
- `it("Should not allow anyone else to burn")` — identical to Base variant (loop [governor, rafael, nick, minter]; BURNER_ROLE revert).
- `it("Should allow Governor to grant roles")` — identical to Base variant.
- `it("Should not allow anyone else to grant roles")` — identical to Base variant (DEFAULT_ADMIN_ROLE revert).
- `it("Should allow Governor to revoke roles")` — identical to Base variant.
- `it("Should not allow anyone else to revoke roles")` — identical to Base variant.

### `test/token/wousd.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `loadDefaultFixture()` from `test/_fixture.js`. Contract under test: deployed mainnet `WOUSD` (`WrappedOusd`). `this.timeout(0)`; retries up to 3 times on CI (`this.retries(isCI ? 3 : 0)`).

**describe: "ForkTest: wOUSD"**
- `it("Should have correct name, symbol and adjuster")` — `name() == "Wrapped OUSD"`, `symbol() == "WOUSD"`, `adjuster() > 0`.

### `test/token/wos.sonic.fork-test.js` — fork test (Sonic)

Fixture: `createFixtureLoader(defaultSonicFixture)` from `test/_fixture-sonic.js`. Contract under test: deployed `WOSonic` (wrapped OS).

**describe: "ForkTest: Wrapped Origin Sonic Token"**
- `it("Should have right config")` — `decimals() == 18`, `symbol() == "wOS"`, `name() == "Wrapped OS"`, `adjuster() > 0`.

### `test/token/oeth.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `loadDefaultFixture()` from `test/_fixture.js`. Contract under test: deployed mainnet `OETH` token (+ `OETHVault`, WETH). `this.timeout(0)`; retries 3× on CI. Header comment explains addresses are intentionally hardcoded (not from `addresses.js`) to avoid a single point of failure.

**describe: "ForkTest: OETH" > "verify state"**
- `it("Should get total value")` — asserts `oeth.rebaseState(0xa4c637e0f704745d182e4d38cab7e7485321d059)` (an EigenLayer strategy contract) equals `2` (the `OptIn` enum value). (Name is misleading; it checks rebase opt-in state.)
- `it("Should delegate or undelegate yield with strategist")` — impersonates and funds the strategist address; asserts `delegateYield(matt, josh)` and then `undelegateYield(matt)` from the impersonated strategist do not revert with `"Caller is not the Strategist or Governor"` (note: the `expect(await …).to.not.be.revertedWith` pattern effectively just requires the txs to succeed).
- `it("Should earn yield even if EIP7702 user")` — turns josh's EOA into an EIP-7702 delegated account by `hardhat_setCode`-ing bytecode `0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b` (0xef0100 delegation-designator prefix) onto `josh.address`, then impersonates it; the 7702 user wraps 13 ETH to WETH, approves and mints 3 OETH via the vault; transfers 1 OETH to a smart contract address (the USDC token contract, standing in for "a contract") and 1 OETH to josh's wallet address (same address as the 7702 user); records balances; simulates yield by transferring 10 WETH to the vault, advances time 1 day, and strategist calls `rebase()`; asserts josh's OETH balance strictly increased, the EIP-7702 user's balance strictly increased (i.e. an address with 7702 delegation code still rebases like an EOA), and the USDC contract's OETH balance is exactly unchanged (plain contracts stay non-rebasing).

### `test/token/oeth.base.fork-test.js` — fork test (Base)

Fixture: `createFixtureLoader(defaultBaseFixture)` from `test/_fixture-base.js`. Contracts under test: deployed `OETHb` (superOETHb) token, `wOETHb` (Wrapped Super OETH 4626), `OETHbVault`.

**describe: "ForkTest: OETHb"**
- `it("Should have right symbol and name")` — `oethb.symbol() == "superOETHb"`, `name() == "Super OETH"`, `decimals() == 18`.
- `it("Should have right symbol and name for 4626 vault")` — `wOETHb.symbol() == "wsuperOETHb"`, `name() == "Wrapped Super OETH"`, `decimals() == 18`.
- `it("Should have the right governor")` — `oethb.governor() == addresses.base.timelock` (from `utils/addresses.js`).
- `it("Should have the right Vault address")` — `oethb.vaultAddress() == oethbVault.address`.

### `test/token/oeth.plume.fork-test.js` — fork test (Plume)

Fixture: `createFixtureLoader(defaultPlumeFixture)` from `test/_fixture-plume.js`. Contracts under test: deployed `OETHp` (superOETHp) token, `wOETHp`, `OETHpVault`. Mirror of the Base file with Plume names.

**describe: "ForkTest: OETHp"**
- `it("Should have right symbol and name")` — `oethp.symbol() == "superOETHp"`, `name() == "Super OETH"`, `decimals() == 18`.
- `it("Should have right symbol and name for 4626 vault")` — `wOETHp.symbol() == "wsuperOETHp"`, `name() == "Wrapped Super OETH"`, `decimals() == 18`.
- `it("Should have the right governor")` — `oethp.governor()` equals the `timelockAddr` named account (via `getNamedAccounts()`, not `addresses.js`).
- `it("Should have the right Vault address")` — `oethp.vaultAddress() == oethpVault.address`.

### `test/token/os.sonic.fork-test.js` — fork test (Sonic)

Fixture: `createFixtureLoader(defaultSonicFixture)` from `test/_fixture-sonic.js`. Contract under test: deployed `OSonic` (OS) token — specifically its on-chain yield-delegation (`yieldFrom`/`yieldTo`) state.

**describe: "ForkTest: Origin Sonic Token"**
- `it.skip("Should have OS/USDC.e SwapX pool's yield forwarded to a SwapX multisig address")` (skipped) — would assert `yieldFrom(0x4636269e7CDc253F6B0B210215C3601558FE80F6)` (SwapX multisig) `== 0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96` (SwapX OS/USDC.e pool) and `yieldTo(pool) == multisig`.
- `it("Should have OS/GEMSx SwapX pool's yield forwarded to a pool booster")` — asserts `yieldFrom(0x1ea8Db4053f806636250bb2BFa6B1E0c4923c209)` (OS/GEMSx pool booster) `== 0xeDFa946815c5CDb14BF894aEd1542D3049a7Be0c` (SwapX OS/GEMSx pool) and `yieldTo(pool) == booster`.

---

## Compounding SSV staking strategy (unit)

Unit tests for the compounding (0x02 withdrawal-credential) beacon-chain staking strategies: `CompoundingStakingSSVStrategy` (SSV-registered validators, plus the `CompoundingStakingStrategyView` helper) and the SSV-free `CompoundingStakingStrategy`. Coverage spans strategy configuration (registrator, initial deposit amount, pause), the validator lifecycle (registerSsvValidator → stakeEth → verifyValidator → verifyDeposit → verifyBalances → validatorWithdrawal → removeSsvValidator), vault-facing deposit/withdraw accounting (`depositedWethAccountedFor`, `checkBalance`), the snapBalances/verifyBalances merkle-proof accounting (using real proofs from `compoundingSSVStaking-validatorsData.json` and a `MockBeaconProofs` variant for front-run/slashing edge cases), and first-deposit anti-front-running protections. Files covered:

- `test/strategies/compoundingSSVStaking.js`
- `test/strategies/compoundingStaking.js`

Validator state enum used throughout: 0 NON_REGISTERED, 1 REGISTERED, 2 STAKED, 3 VERIFIED, 4 ACTIVE, 5 EXITING, 6 EXITED, 7 REMOVED, 8 INVALID. Deposit status enum: 2 = VERIFIED.

### `test/strategies/compoundingSSVStaking.js` — unit test (mainnet mocks)

Fixture: `compoundingStakingSSVStrategyFixture` (builds on `beaconChainFixture`; strategy proxy pinned at a fixed unit-test address, approved and set as the OETH vault default strategy, registrator set, `MockSSVNetwork`, mock `beaconRoots` contract); a nested describe swaps to `compoundingStakingSSVStrategyMerkleProofsMockedFixture` which replaces the `BEACON_PROOFS` library bytecode with `MockBeaconProofs` (proofs not verified, mockable validator balances). Contracts under test: `CompoundingStakingSSVStrategy` (proxy) + `CompoundingStakingStrategyView`. Top-level `beforeEach` impersonates+funds the strategy governor (`sGov`) and the vault address (`sVault`), and josh approves the strategy for MAX_UINT256 WETH. Suite runs with `this.timeout(0)` and retries 3x on CI. `INITIAL_DEPOSIT_AMOUNT` = 1 ETH.

Key shared helpers (used by many tests below):
- `processValidator(testValidator, state)` — drives a validator from `testValidators` (JSON proof data) to the given state: `registerSsvValidator` (REGISTERED) → deposit 1 WETH to strategy + `stakeEth` 1 ETH with computed `depositDataRoot` (STAKED) → set mock beacon root and `verifyValidator` with 0x02 withdrawal credentials (VERIFIED_VALIDATOR) → set beacon root at depositSlot+10000 and `verifyDeposit` (VERIFIED_DEPOSIT).
- `topUpValidator(testValidator, amount, state)` — deposit WETH + `stakeEth(amount)` (STAKED), optionally `verifyDeposit` (VERIFIED_DEPOSIT).
- `snapBalances(blockRoot)` — sets the mock beacon root and calls `snapBalances()` from the registrator in the same block (automine toggled off/on).
- `assertBalances({wethAmount, ethAmount, balancesProof, pendingDepositAmount, activeValidators, hackDeposits})` — force-sets strategy WETH/raw-ETH balances, snaps balances at the proof's block root, filters balance leaves/proofs to the given active-validator indexes, rewrites the on-chain `depositList` roots + `deposits` mapping entries via `setStorageAt` (slots 53/52) to match the proof's pending-deposit roots, then calls `verifyBalances` and asserts: `BalancesVerified` event withNamedArgs `{totalDepositsWei, totalValidatorBalance, ethBalance}` matching expected values, and `lastVerifiedEthBalance == totalDepositsWei + totalValidatorBalance + ethBalance`. Returns the components plus `checkBalance(weth)`.
- `depositToStrategy(amount)` — josh transfers WETH to the strategy and the vault signer calls `depositAll()`.

Consumes shared behaviour suites (see `test/behaviour/` docs; bullets not duplicated here):
- `shouldBehaveLikeGovernable(() => ({...fixture, strategy: fixture.compoundingStakingSSVStrategy}))` — standard 2-step governor transfer suite from `test/behaviour/governable.js`.
- `shouldBehaveLikeStrategy(() => ({...fixture, strategy: fixture.compoundingStakingSSVStrategy, assets: [weth], valueAssets: [], harvester: oethHarvester, vault: oethVault, newBehavior: true}))` — generic strategy suite from `test/behaviour/strategy.js` (with `newBehavior: true` branch).

**describe: "Unit test: Compounding SSV Staking Strategy" > "Initial setup"**
- `it("Should anyone to send ETH")` — assertions: sending a plain 2 ETH transaction from the strategist to the strategy address does not revert (receive() accepts ETH from anyone).

**describe: "Unit test: Compounding SSV Staking Strategy" > "Configuring the strategy"**
- `it("Governor should be able to change the registrator address")` — assertions: `setRegistrator(strategist)` from governor emits `RegistratorChanged(strategist.address)`.
- `it("Non governor should not be able to change the registrator address")` — assertions: `setRegistrator` from strategist reverts with `"Caller is not the Governor"`.
- `it("Should support WETH as the only asset")` — assertions: `supportsAsset(weth)` returns true.
- `it("Should initialize the first deposit amount to 1 ETH")` — assertions: `initialDepositAmountWei()` equals 1 ETH.
- `it("Governor should be able to change the first deposit amount")` — assertions: governor `setInitialDepositAmount(2048 ETH)` emits `InitialDepositAmountChanged(2048e18)` and `initialDepositAmountWei()` reads back 2048 ETH.
- `it("Non governor should not be able to change the first deposit amount")` — assertions: strategist call reverts with `"Caller is not the Governor"`.
- `it("Should revert when setting the first deposit amount below 1 ETH")` — assertions: governor setting 0.5 ETH reverts with `"Deposit too small"`.
- `it("Should revert when setting the first deposit amount above 2048 ETH")` — assertions: governor setting 2048 ETH + 1 wei reverts with `"Deposit too large"`.
- `it("Should not collect rewards")` — assertions: after governor sets itself as harvester, `collectRewardTokens()` reverts with custom error `UnsupportedFunction()`.
- `it("Should not set platform token")` — assertions: governor `setPTokenAddress(weth, weth)` reverts with custom error `UnsupportedFunction()`.
- `it("Should not remove platform token")` — assertions: governor `removePToken(0)` reverts with custom error `UnsupportedFunction()`.
- `it("Regular user should not be able to reset the first deposit flag")` — assertions: josh calling `resetFirstDeposit()` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should revert reset of first deposit if there is no first deposit")` — assertions: governor `resetFirstDeposit()` with no first deposit pending reverts with custom error `NoFirstDeposit()`.
- `it("Registrator or governor should be the only ones to pause the strategy")` — assertions: governor pause/unPause and registrator pause succeed (no revert); josh calling `pause()` reverts with custom error `NotRegistratorOrGovernor()`.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Register, stake, withdraw and remove validators"** — beforeEach funds the strategy with 1000 SSV and 5000 WETH. Local helper `stakeValidators(idx, amount)` asserts validator state 0 (NON_REGISTERED) before, registers with 2 ETH msg.value → state 1 (REGISTERED), then `stakeEth` and asserts `ETHStaked` event withNamedArgs `{pubKeyHash, pubKey, amountWei = amountGwei*1e9}` → state 2 (STAKED).
- `it("Should stake the initial deposit amount to a validator")` — assertions: full `stakeValidators(0, 1 ETH)` flow: state transitions 0→1→2 and `ETHStaked` event as described in the helper.
- `it("Should stake less than the initial deposit amount to a validator")` — assertions: after governor raises `initialDepositAmount` to 2 ETH, staking only 1 ETH still succeeds with the same state transitions/event.
- `it("Should stake the initial deposit amount then 2047 ETH to a validator")` — assertions: registers + stakes 1 ETH, checks `hashPubKey(publicKey) == publicKeyHash`, verifies validator and first deposit against mock beacon roots; then stakes another 2047 ETH and asserts `ETHStaked` with exact args `(publicKeyHash, pendingDepositRoot2, publicKey, 2047e18)`; verifies the second deposit (reusing the first proof); final `checkBalance(weth)` equals the pre-test balance (staking doesn't change the strategy's total balance).
- `it("Should revert when first stake amount is above the initial deposit amount")` — assertions: after registering, first `stakeEth` of 32 ETH reverts with custom error `InvalidFirstDepositAmount()`.
- `it("Should revert registerSsvValidator when contract paused")` — assertions: after governor `pause()`, `registerSsvValidator` reverts with `"Pausable: paused"`.
- `it("Should revert stakeEth when contract paused")` — assertions: register first, then pause; `stakeEth` reverts with `"Pausable: paused"`.
- `it("Should revert when registering a validator that is already registered")` — assertions: second `registerSsvValidator` for the same pubkey reverts with custom error `AlreadyRegistered()`.
- `it("Should revert when re-registering a removed validator")` — assertions: register then `removeSsvValidator` → validator state is 7 (REMOVED); re-registering reverts with custom error `AlreadyRegistered()`.
- `it("Should revert when staking because of insufficient ETH balance")` — assertions: `stakeEth` for (strategy WETH balance in gwei + 1) reverts with `"Insufficient WETH"`.
- `it("Should revert when staking a validator that hasn't been registered")` — assertions: `stakeEth` of 1 ETH to an unregistered validator reverts (generic revert, no reason asserted).
- `it("Should exit a validator with no pending deposit")` — assertions: after processValidator + topUp to ~1588.9 ETH and `assertBalances` (proof #1, active validator index 2), validator state moves 3 (VERIFIED) → 4 (ACTIVE); `validatorWithdrawal(pubkey, 0, {value:1})` (0 = full exit) emits `ValidatorWithdraw(publicKeyHash, 0)` and state becomes 5 (EXITING).
- `it("Should exit a validator that is already exiting")` — assertions: same setup; after a first full-exit request (state 5 EXITING), a second `validatorWithdrawal(pubkey, 0)` still succeeds and emits `ValidatorWithdraw(publicKeyHash, 0)`.
- `it("Should revert when validator's balance hasn't been confirmed to equal or surpass 32.25 ETH")` — assertions: validator only VERIFIED_DEPOSIT (no verifyBalances so still VERIFIED); full-exit `validatorWithdrawal(pubkey, 0)` reverts with `"Validator not active/exiting"`.
- `it("Should revert partial withdrawal when validator's balance hasn't been confirmed to equal or surpass 32 ETH")` — assertions: same setup with a top-up but no verifyBalances; partial `validatorWithdrawal(pubkey, 1)` reverts with `"Validator not active/exiting"`.
- `it("Should revert when exiting a validator with a pending deposit")` — assertions: after activating the validator via `assertBalances`, a fresh 1 ETH `topUpValidator(..., "STAKED")` leaves an unverified pending deposit; full exit `validatorWithdrawal(pubkey, 0, {value:1})` reverts with `"Pending deposit"`.
- `it("Should revert when verifying deposit between snapBalances and verifyBalances")` — assertions: validator at VERIFIED_VALIDATOR with a pending deposit; registrator calls `snapBalances()` and then `verifyDeposit` at depositSlot+10000 reverts with `"Deposit after balance snapshot"`.
- `it("Should partial withdraw from a validator with a pending deposit")` — assertions: ACTIVE validator (state 4) with a fresh unverified 1 ETH deposit; partial `validatorWithdrawal(pubkey, 5 gwei-ETH)` succeeds, emits `ValidatorWithdraw(publicKeyHash, 5e18)` and state remains 4 (ACTIVE).
- `it("Should remove a validator when validator is registered")` — assertions: registered validator (state 1); `removeSsvValidator` emits `SSVValidatorRemoved(publicKeyHash, operatorIds)`.
- `it("Should revert when removing a validator that is not registered")` — assertions: validator state 0; `removeSsvValidator` reverts (generic).
- `it("Should remove a validator when validator is exited")` — assertions: ACTIVE validator (view contract reports 1 verified validator); a second `assertBalances` with a zero-balance proof (proof #2) marks it exited (0 verified validators); `removeSsvValidator` then emits `SSVValidatorRemoved(publicKeyHash, operatorIds)`.
- `it("Should not remove a validator if it still has a pending deposit")` — assertions: ACTIVE validator with a later unverified deposit; verifyBalances with zero-balance proof keeps 1 verified validator (not exited because of the pending deposit, `pendingDepositAmount: 50.497526`); after `verifyDeposit` of that deposit and another zero-balance `assertBalances`, verified validators drops to 0.
- `it("Should revert when removing a validator that has been found")` — assertions: despite the name, only asserts that after `stakeValidators(0, 1 ETH)` the validator state is 2 (STAKED); no remove call is made.
- `it("Should fail removing a strategy with funds")` — assertions: after staking, governor clears the vault default strategy if needed, then `oethVault.removeStrategy(strategy)` reverts with `"Strategy has funds"`.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Verify deposits"** — beforeEach: `processValidator(testValidators[1], "VERIFIED_VALIDATOR")` and captures the last `pendingDepositRoot` + `depositSlot`.
- `it("Should revert first pending deposit slot is zero")` — assertions: `verifyDeposit` with `firstPendingDeposit.slot = 0` reverts with `"Zero 1st pending deposit slot"`.
- `it("Should revert when no deposit")` — assertions: `verifyDeposit` with a random 32-byte pendingDepositRoot reverts with `"Deposit not pending"`.
- `it("Should revert when deposit verified again")` — assertions: after a successful `verifyDeposit` at depositSlot+100 (beacon root pre-set), a second `verifyDeposit` for the same root reverts with `"Deposit not pending"`.
- `it("Should revert when processed slot is after snapped balances")` — assertions: advance 12s, registrator `snapBalances()`; `verifyDeposit` with `depositProcessedSlot` = current slot reverts with `"Deposit after balance snapshot"`.
- `it("Should verify deposit with no snapped balances")` — assertions: `verifyDeposit` at depositSlot+1 (beacon root set) emits `DepositVerified(pendingDepositRoot, 1e18)`.
- `it("Should verify deposit with processed slot 1 before the snapped balances slot")` — assertions: advance 24s, snap balances; `verifyDeposit` with processed slot = snappedBalance slot − 1 emits `DepositVerified(pendingDepositRoot, 1e18)`.
- `it("Should verify deposit with processed slot well before the snapped balances slot")` — assertions: advance 120s (10 slots), snap balances; `verifyDeposit` at depositSlot+1 emits `DepositVerified(pendingDepositRoot, 1e18)`.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Deposit/Withdraw in the strategy"**
- `it("Should deposit ETH in the strategy")` — assertions: after transferring 10 WETH and vault calling `deposit(weth, 10e18)`: emits `Deposit(weth, address(0), 10e18)`; `depositedWethAccountedFor` increases by 10e18; `checkBalance(weth)` increases by 10e18.
- `it("Should depositAll ETH in the strategy when depositedWethAccountedFor is zero")` — assertions: transfer 10 WETH then vault `depositAll()`: emits `Deposit(weth, 0x0, 10e18)`; `depositedWethAccountedFor` and `checkBalance(weth)` each increase by 10e18.
- `it("Should depositAll ETH in the strategy when depositedWethAccountedFor is not zero")` — assertions: first `deposit` of 10 WETH sets `depositedWethAccountedFor` to 10e18; then transfer 20 WETH and `depositAll()` emits `Deposit(weth, 0x0, 20e18)` (only the new WETH), incrementing `depositedWethAccountedFor` and `checkBalance(weth)` by 20e18.
- `it("Should revert when depositing 0 ETH in the strategy")` — assertions: vault `deposit(weth, 0)` reverts with `"Must deposit something"`.
- `it("Should withdraw ETH from the strategy, no ETH")` — assertions: after 10 WETH deposited, vault `withdraw(vault, weth, 10e18)` emits `Withdrawal(weth, 0x0, 10e18)`; `depositedWethAccountedFor` becomes 0; `checkBalance(weth)` decreases by 10e18.
- `it("Should withdraw ETH from the strategy, withdraw some ETH")` — assertions: 10 WETH deposited plus 5 raw ETH set on the strategy; registrator `withdraw(vault, weth, 15e18)` emits `Withdrawal(weth, 0x0, 15e18)` (raw ETH is wrapped and included); `depositedWethAccountedFor` = 0; `checkBalance(weth)` decreases by only the 10e18 accounted WETH (donated raw ETH is intentionally not part of checkBalance).
- `it("Should revert when withdrawing other than WETH")` — assertions: vault `withdraw(josh, josh-as-asset, 10e18)` reverts with custom error `UnsupportedAsset()`.
- `it("Should revert when withdrawing 0 ETH from the strategy")` — assertions: `withdraw(josh, weth, 0)` reverts with `"Must withdraw something"`.
- `it("Should revert when withdrawing to the zero address")` — assertions: `withdraw(address(0), weth, 10e18)` reverts with `"Recipient not Vault"`.
- `it("Should revert when withdrawing to a user")` — assertions: `withdraw(josh, weth, 10e18)` reverts with `"Recipient not Vault"`.
- `it("Should withdrawAll ETH from the strategy, no ETH")` — assertions: after 10 WETH deposited, vault `withdrawAll()` emits `Withdrawal(weth, 0x0, 10e18)`; `depositedWethAccountedFor` = 0 and `checkBalance(weth)` = 0.
- `it("Should withdrawAll ETH from the strategy, withdraw some ETH")` — assertions: 10 WETH deposited + 5 raw ETH donated; `withdrawAll()` emits `Withdrawal(weth, 0x0, 15e18)` (raw ETH swept too); `depositedWethAccountedFor` = 0 and `checkBalance(weth)` = 0.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Strategy balances" > "When no execution rewards (ETH), no pending deposits and no active validators"** — local helper `verifyBalancesNoDepositsOrValidators()` calls `verifyBalances` with empty leaf/proof arrays and empty pending-deposit proofs.
- `it("Should verify balances with no WETH")` — assertions: after `snapBalances()`, `verifyBalances` emits `BalancesVerified(snapTimestamp, 0, 0, 0)`; `lastVerifiedEthBalance` = 0; `checkBalance(weth)` = 0.
- `it("Should verify balances with some WETH transferred before snap")` — assertions: 1.23 WETH deposited (depositAll) before snap; `BalancesVerified(timestamp, 0, 0, 0)` (WETH is excluded from verified ETH); `lastVerifiedEthBalance` = 0; `checkBalance(weth)` = 1.23e18.
- `it("Should verify balances with some WETH transferred after snap")` — assertions: 5.67 WETH transferred after snap; `BalancesVerified(timestamp, 0, 0, 0)`; `lastVerifiedEthBalance` = 0; `checkBalance(weth)` = 5.67e18.
- `it("Should verify balances with some WETH transferred before and after snap")` — assertions: 1.23 WETH before + 5.67 WETH after snap; `BalancesVerified(timestamp, 0, 0, 0)`; `lastVerifiedEthBalance` = 0; `checkBalance(weth)` = 6.90e18 (sum).
- `it("Should verify balances with one registered validator")` — assertions: validator only REGISTERED; `assertBalances` with 10 WETH, no deposits/validators (proof #2, no active validators): wethBalance 10e18, `verifiedEthBalance` = 0, strategy `checkBalance` = 10e18; plus assertBalances' internal `BalancesVerified` and `lastVerifiedEthBalance` checks.
- `it("Should verify balances with one staked validator")` — assertions: validator STAKED (1 ETH pending deposit); `assertBalances` with pendingDepositAmount 1: `totalDepositsWei` = 1e18, `verifiedEthBalance` = 1e18, `checkBalance` = 1e18 (all via `BalancesVerified` named args + lastVerifiedEthBalance equality).
- `it("Should verify balances with one exited verified validator")` — assertions: validator index 4 (beacon index 2018225, 32.008954871 ETH balance) at VERIFIED_VALIDATOR with a 1 ETH pending deposit; `assertBalances` with proof #5 passes its internal checks (`BalancesVerified` named args match `{totalDepositsWei: 1e18, totalValidatorBalance, ethBalance: 0}`, `lastVerifiedEthBalance` = sum).
- `it("Should not verify a validator with incorrect withdrawal credential validator type")` — assertions: mutating the validator proof's credential type byte from 0x02 to 0x01 makes `processValidator(..., "VERIFIED_DEPOSIT")` revert with `"Invalid withdrawal cred"` (proof restored afterwards).
- `it("Should not verify a validator with incorrect withdrawal zero padding")` — assertions: corrupting the credential zero-padding bytes (`0x020001...`) makes `processValidator` revert with `"Invalid withdrawal cred"` (proof restored afterwards).
- `it("Should verify balances with one verified deposit")` — assertions: validator at VERIFIED_DEPOSIT; `assertBalances` (proof #2, active validator 0): `totalDepositsWei` = 0, `totalValidatorBalance` = proof balance of validator 0, `verifiedEthBalance` and `checkBalance` both equal that validator balance.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Strategy balances" > "When an active validator does a" > "partial withdrawal"** — beforeEach: testValidators[3] to VERIFIED_DEPOSIT plus top-up to ~1588.9 ETH, then `assertBalances` (proof #0, active validator 2) to activate and record `balancesBefore`.
- `it("Should account for a pending partial withdrawal")` — assertions: registrator `validatorWithdrawal(pubkey, 640 ETH in gwei)` (strategy funded 1 wei for the request fee) emits `ValidatorWithdraw(publicKeyHash, 640e18)`; a subsequent `assertBalances` with the same proof (withdrawal not yet processed on beacon) yields `stratBalance` (checkBalance) unchanged vs before.
- `it("Should account for a processed partial withdrawal")` — assertions: same 640 ETH withdrawal request + `ValidatorWithdraw(publicKeyHash, 640e18)`; re-verify with proof #1 (lower validator balance) and strategy ETH set to `640 + consensusRewards` (rewards computed as proof0.balance − proof1.balance − 640): `stratBalance` unchanged vs before (validator balance decrease exactly offset by strategy ETH).

**describe: "Unit test: Compounding SSV Staking Strategy" > "Strategy balances" > "When an active validator does a" > "full withdrawal"** — beforeEach: same validator setup; `assertBalances` with proof #1 records `balancesBefore`.
- `it("Should account for full withdrawal")` — assertions: view contract has 1 verified validator and state is 4 (ACTIVE); withdrawal request for the full 1588.918094377 ETH emits `ValidatorWithdraw(publicKeyHash, fullAmount)`; re-verify with proof #2 (zero validator balance) and strategy ETH = withdrawn amount: `stratBalance` unchanged, verified validators drops to 0 and validator state becomes 6 (EXITED).

**describe: "Unit test: Compounding SSV Staking Strategy" > "Strategy balances" > "When WETH, ETH, no pending deposits and 2 active validators"** — beforeEach: validators 0 and 1 processed + topped up to full deposit amounts; `assertBalances` with 10 WETH + 0.987 ETH (proof #3, active validators [0,1]) records `balancesBefore`.
- `it("consensus rewards are earned by the validators")` — assertions: re-verifying with proof #4 (higher validator balances) increases `totalValidatorBalance` and `totalBalance` by exactly 0.007672545 ETH.
- `it("execution rewards are earned as ETH in the strategy")` — assertions: re-verifying with ETH raised from 0.987 to 1 (same proof #3) increases `ethBalance` and `totalBalance` by exactly 0.013 ETH.

**describe: "... > When WETH, ETH, no pending deposits and 2 active validators > when balances have been snapped"** — beforeEach: `snapBalances(proof #3 blockRoot)`.
- `it("Fail to verify balances with not enough validator leaves")` — assertions: `verifyBalances` with 1 leaf / 2 proofs for 2 active validators reverts with `"Invalid balance leaves"`.
- `it("Fail to verify balances with too many validator leaves")` — assertions: 3 leaves / 2 proofs reverts with `"Invalid balance leaves"`.
- `it("Fail to verify balances with not enough validator proofs")` — assertions: 2 leaves / 1 proof reverts with `"Invalid balance proofs"`.
- `it("Fail to verify balances with too many proofs")` — assertions: 2 leaves / 3 proofs reverts with `"Invalid balance proofs"`.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Strategy balances" > "With 21 active validators"** — beforeEach loops over testValidators[0..20]: asserts `hashPubKey(publicKey) == publicKeyHash` for each, processes each to VERIFIED_DEPOSIT and tops each up to its full deposit amount (loop variant of the single-validator flow).
- `it("Should verify balances with some WETH, ETH and no deposits")` — assertions: `assertBalances` over all 21 validators (proof #5) with 123.456 WETH + 0.345 ETH and 0 pending deposits passes its internal checks (`BalancesVerified` named args, `lastVerifiedEthBalance` = deposits+validators+eth).
- `it("Should verify balances with one validator exited with two pending deposits")` — assertions: two extra unverified deposits (1 + 2 ETH) to validator index 3 (zero balance in proof #5, i.e. exited); `assertBalances` with `pendingDepositAmount: 3` passes — the deposits to the exited validator are treated as removed from the pending totals per the proof data.
- `it("Should verify balances with one validator exited with two pending deposits and three deposits to non-exiting validators")` — assertions: deposits 2+3 ETH to validator 0, 4 ETH to validator 1 (kept — validators have balances) and 5+6 ETH to exited validator 3; `assertBalances` with `pendingDepositAmount: 20` (2+3+4+5+6) passes its internal checks.

**describe: "Unit test: Compounding SSV Staking Strategy" > "Compounding SSV Staking Strategy Mocked proofs"** — beforeEach reloads `compoundingStakingSSVStrategyMerkleProofsMockedFixture` (BEACON_PROOFS replaced by `MockBeaconProofs` so merkle proofs are not checked and validator balances can be set), re-impersonates sGov/sVault and re-approves WETH.
- `it("Should be allowed 2 deposits to an exiting validator ")` — assertions: validator processed then two extra staked deposits; validator's `withdrawableEpoch` mocked to 2 epochs ahead (simulated slashing); both `verifyDeposit` calls succeed and both deposit records have status 2 (VERIFIED); after advancing 4 epochs and mocking validator balance to 0 (fully swept), `assertBalances` (empty mocked proofs, `hackDeposits: false`, pendingDepositAmount 0) passes; `getPendingDeposits()` is then empty and both deposits remain status 2 (VERIFIED).
- `it("Should verify validator that has a front-run deposit")` — assertions: validator STAKED; `verifyValidator` with withdrawal credentials pointing at a random attacker address emits `ValidatorInvalid(publicKeyHash)`; validator state becomes 8 (INVALID); `getPendingDeposits()` is empty; the deposit's status is 2 (VERIFIED); `lastVerifiedEthBalance` is reduced by the 1 ETH initial deposit; `firstDeposit()` remains true.
- `it("Should verify validator with incorrect type")` — assertions: `verifyValidator` with 0x01-type credentials (strategy address) emits `ValidatorInvalid(publicKeyHash)` and state becomes 8 (INVALID).
- `it("Should verify validator with malformed credentials")` — assertions: `verifyValidator` with non-zero padding bytes in otherwise-0x02 credentials emits `ValidatorInvalid(publicKeyHash)` and state becomes 8 (INVALID).
- `it("Should fail to verify front-run deposit")` — assertions: after `verifyValidator` marks the validator INVALID (attacker credentials), `verifyDeposit` for the front-run deposit reverts with `"Deposit not pending"`; also asserts `firstDeposit()` was true before.
- `it("Governor should reset first deposit after front-run deposit")` — assertions: after the validator is invalidated, governor `resetFirstDeposit()` emits `FirstDepositReset` and `firstDeposit()` becomes false.
- `it("Should remove a validator from SSV cluster when validator is invalid")` — assertions: after invalidation, registrator `removeSsvValidator` emits `SSVValidatorRemoved(publicKeyHash, operatorIds)`.
- `it("Should fail to active a validator with a 32.25 ETH balance")` — assertions: validator at VERIFIED_DEPOSIT (state 3); snap, mock balance to exactly 32.25 ETH (gwei); `verifyBalances` emits `BalancesVerified` withNamedArgs `{totalDepositsWei: 0}` but state remains 3 (VERIFIED — needs > 32.25 ETH to activate).
- `it("Should active a validator with more than 32.25 ETH balance")` — assertions: same setup with mocked balance 32.26 ETH; `verifyBalances` emits `BalancesVerified` `{totalDepositsWei: 0}` and state becomes 4 (ACTIVE).

**describe: "... Mocked proofs" > "When a verified validator is exiting after being slashed And a new deposit is made to the validator"** — beforeEach: testValidators[11] to VERIFIED_DEPOSIT + full top-up, then a new 3 ETH deposit left STAKED; computes `withdrawableEpoch` = current epoch + 4 (and its slot/timestamp) and builds `strategyValidatorData` with that withdrawableEpoch (simulated slashing exit).
- `it("Should fail verify deposit when first pending deposit slot before the withdrawable epoch")` — assertions: `verifyDeposit` with firstPendingDeposit slot = withdrawableSlot − 1 reverts with `"Exit Deposit likely not proc."`.
- `it("Should verify deposit when the pending deposit queue is empty")` — assertions: `verifyDeposit` using the empty-pending-deposit-queue proof (slot 1) emits `DepositVerified(pendingDepositRoot, 3e18)`; deposit status = 2 (VERIFIED); `getPendingDeposits()` is empty.
- `it("Should verify deposit when the first pending deposit slot equals the withdrawable epoch")` — assertions: firstPendingDeposit slot == withdrawableSlot: emits `DepositVerified(pendingDepositRoot, 3e18)`; deposit status 2; no pending deposits.
- `it("Should verify deposit when the first pending deposit slot is after the withdrawable epoch")` — assertions: firstPendingDeposit slot = withdrawableSlot + 1 (processed slot +5): emits `DepositVerified(pendingDepositRoot, 3e18)`; deposit status 2; no pending deposits.

**describe: "... Mocked proofs > When a verified validator is exiting after being slashed ... > When deposit has been verified to an exiting validator"** — beforeEach: the 3 ETH deposit is verified with the slashed-validator data.
- `it("Should verify balances")` — assertions: advance EVM time past the withdrawable timestamp (asserted greater-than), snap balances, mock the validator balance to MAX_UINT256 sentinel (exited/swept); `verifyBalances` with one empty balance leaf + one pending-deposit proof emits `BalancesVerified` withNamedArgs `{totalDepositsWei: 0}` (the verified deposit to the exited validator no longer counts).

- `it("Deposit alternate deposit_data_root ")` (skipped — entire test commented out) — would have asserted `depositContractUtils.calculateDepositDataRoot` for a mainnet pubkey/signature with 0x01 withdrawal credentials equals a hardcoded root `0xf7d7...f446`.

### `test/strategies/compoundingStaking.js` — unit test (mainnet mocks)

Fixture: `compoundingStakingStrategyFixture` (builds on `beaconChainFixture`; deploys a fresh `CompoundingStakingStrategyProxy` + `CompoundingStakingStrategy` implementation — the SSV-free variant — initialized with a 1 ETH initial validator deposit amount, approved on the OETH vault, registrator + harvester set). Contract under test: `CompoundingStakingStrategy`. beforeEach impersonates+funds the vault address (`sVault`) and josh approves the strategy for MAX_UINT256 WETH. Local helpers: `depositToStrategy(amount)` (josh transfers WETH; vault calls `depositAll()`) and `stakeValidator({validator, amount})` (registrator calls `stakeEth` with a computed `depositDataRoot`; no SSV registration step). All tests are direct children of the top-level describe.

**describe: "Unit test: Compounding Staking Strategy"**
- `it("allows the first deposit to a vanilla validator without SSV registration")` — assertions: validator state starts 0 (NON_REGISTERED); after depositing 1 WETH, `stakeEth` of 1 ETH succeeds without any SSV registration and emits `ETHStaked(pubKeyHash, pendingDepositRoot (taken from the receipt), publicKey, 1e18)`; validator state becomes 2 (STAKED); `firstDeposit()` is true.
- `it("allows the first deposit to be less than the initial deposit amount")` — assertions: governor sets `initialDepositAmount` to 2 ETH; staking only 1 ETH still emits `ETHStaked(pubKeyHash, pendingDepositRoot, publicKey, 1e18)` and `firstDeposit()` is true.
- `it("allows a large 2030 ETH initial deposit to a compounding validator")` — assertions: governor sets `initialDepositAmount` to 2030 ETH; state 0 before; staking 2030 ETH emits `ETHStaked(pubKeyHash, pendingDepositRoot, publicKey, 2030e18)`; state becomes 2 (STAKED); `firstDeposit()` true.
- `it("allows a 32.25 ETH initial deposit when initialDepositAmount is set to 2040 ETH")` — assertions: governor sets `initialDepositAmount` to 2040 ETH; staking 32.25 ETH emits `ETHStaked(pubKeyHash, pendingDepositRoot, publicKey, 32.25e18)`; state becomes 2 (STAKED); `firstDeposit()` true.
- `it("does not allow a follow-up deposit before the validator is verified or active")` — assertions: after a first 1 ETH stake to a validator, a second `stakeEth` to the same validator reverts with `"Not registered or verified"`.
- `it("still only allows one pending first deposit at a time")` — assertions: after a first stake to validator 0, staking validator 1 reverts with `"Existing first deposit"`.
- `it("allows the governor to reset the first deposit flag")` — assertions: after a first stake, governor `resetFirstDeposit()` emits `FirstDepositReset` and `firstDeposit()` becomes false.
- `it("allows the strategist to reset the first deposit flag")` — assertions: impersonates the vault's `strategistAddr`; after a first stake, strategist `resetFirstDeposit()` emits `FirstDepositReset` and `firstDeposit()` becomes false.
- `it("does not allow a regular user to reset the first deposit flag")` — assertions: after a first stake, josh calling `resetFirstDeposit()` reverts with `"Caller is not the Strategist or Governor"`.

---

# Native SSV staking strategy (unit + behaviour + mainnet fork)

## Native SSV staking strategy (unit + behaviour + mainnet fork)

This area covers `NativeStakingSSVStrategy` (ETH native staking via SSV validators) plus its `FeeAccumulator`: unit tests against local mocks (accounting of beacon-chain ETH via fuse intervals, `manuallyFixAccounting` guardrails, harvest/`checkBalance` math, validator register/stake/threshold flows, deposit-data-root calculation), a reusable behaviour suite exercising initial config, WETH deposit, full validator lifecycle against a real SSV network, ETH accounting and harvesting, and a (fully skipped) mainnet fork test that instantiates the behaviour suite against the three deployed Native Staking strategy proxies. All files use `nativeStakingSSVStrategyFixture` from `test/_fixture.js` (unit mode: mock SSV network, strategy approved and set as OETH Vault default strategy, fuse interval 21.6–25.6 ETH, governor as registrator, `simpleOETHHarvester` set as harvester; fork mode: impersonated mainnet `validatorRegistrator`, real `ISSVNetwork`, 100 SSV funded to the strategy).

Files covered:
- `test/strategies/nativeSSVStaking.js` — unit tests (92 `it()` blocks)
- `test/behaviour/ssvStrategy.js` — behaviour suite `shouldBehaveLikeAnSsvStrategy` (12 `it()` blocks)
- `test/strategies/nativeSsvStaking.mainnet.fork-test.js` — mainnet fork test, consumes the behaviour suite 3× (all `describe.skip`)

### `test/strategies/nativeSSVStaking.js` — unit test (hardhat local)

Context: `loadFixture(nativeStakingSSVStrategyFixture)` (unit mode with mock SSV network / mock beacon deposit contract); contracts under test: `NativeStakingSSVStrategy`, `FeeAccumulator` (`nativeStakingFeeAccumulator`), `DepositContractUtils` helper. `this.retries(3)` on CI. Constant `minFixAccountingCadence = 7201` blocks. Helpers `setActiveDepositedValidators` / `setConsensusRewards` write storage slots 52 / 104 directly and verify via the public getters.

Consumed behaviour suites (documented in their own suite docs, not duplicated here):
- `shouldBehaveLikeGovernable(() => ({ ...fixture, strategy: fixture.nativeStakingSSVStrategy }))` — see `test/behaviour/governable.js`.
- `shouldBehaveLikeHarvestable(() => ({ ...fixture, harvester: fixture.oethHarvester, strategy: fixture.nativeStakingSSVStrategy, newBehavior: true }))` — see `test/behaviour/harvestable.js`.
- `shouldBehaveLikeStrategy(() => ({ ...fixture, strategy: fixture.nativeStakingSSVStrategy, assets: [fixture.weth], valueAssets: [], harvester: fixture.oethHarvester, vault: fixture.oethVault, newBehavior: true }))` — see `test/behaviour/strategy.js`.

**describe: "Unit test: Native SSV Staking Strategy" > "Initial setup"**
- `it("Should not allow ETH to be sent to the strategy if not FeeAccumulator or WETH")` — strategist sends a plain 2 ETH transaction to the strategy address; reverts with exact string `"Eth not from allowed contracts"`.
- `it("SSV network should have allowance to spend SSV tokens of the strategy")` — `ssv.allowance(strategy, strategy.SSV_NETWORK())` equals `MAX_UINT256`.

**describe: "Unit test: Native SSV Staking Strategy" > "Configuring the strategy"**
- `it("Governor should be able to change the registrator address")` — governor calls `setRegistrator(strategist)`; emits `RegistratorChanged(strategist.address)`.
- `it("Non governor should not be able to change the registrator address")` — strategist calls `setRegistrator` → reverts `"Caller is not the Governor"`.
- `it("Non governor should not be able to update the fuse intervals")` — strategist calls `setFuseInterval(21.6e18, 25.6e18)` → reverts `"Caller is not the Governor"`.
- `it("Fuse interval start needs to be larger than fuse end")` — governor calls `setFuseInterval(25.6e18, 21.6e18)` (start > end) → reverts `"Incorrect fuse interval"`.
- `it("There should be at least 4 ETH between interval start and interval end")` — governor calls `setFuseInterval(21.6e18, 25.5e18)` (3.9 ETH gap) → reverts `"Incorrect fuse interval"`.
- `it("Revert when fuse intervals are larger than 32 ether")` — governor calls `setFuseInterval(32.1e18, 32.1e18)` → reverts `"Incorrect fuse interval"`.
- `it("Governor should be able to change fuse interval")` — governor calls `setFuseInterval(22.6e18, 26.6e18)`; emits `FuseIntervalUpdated(22.6e18, 26.6e18)`.

**describe: "Unit test: Native SSV Staking Strategy" > "Accounting" > "Should account for beacon chain ETH"**

Parameterised loop over 29 test cases (fixture fuse interval is 21.6–25.6 ETH). Per-test setup: `setBalance(strategy, ethBalance)` (if > 0), `setActiveDepositedValidators(30)` (storage slot 52), `setConsensusRewards(previousConsensusRewards)` (storage slot 104); then governor calls `doAccounting()`. Common assertions for every case: emits `AccountingConsensusRewards(expectedConsensusRewards)` iff expected > 0 (otherwise asserts the event is NOT emitted); iff `expectedValidatorsFullWithdrawals > 0` emits `AccountingFullyWithdrawnValidator(n, 30 - n, n*32 ETH)` AND `Withdrawal(weth, address(0), n*32 ETH)` (otherwise not emitted); iff `fuseBlown` emits `Paused` (otherwise not); iff `slashDetected` emits `AccountingValidatorSlashed` with named arg `remainingValidators = 30 - n - 1` AND `Withdrawal(weth, address(0), ethBalance - n*32 ETH)` (otherwise not emitted). Generated test names follow the pattern `it("given X ETH balance and Y previous consensus rewards, then Z consensus rewards, W withdraws[, fuse blown][, slash detected].")` for each row (ethBalance / previousConsensusRewards → expectedConsensusRewards / withdrawals / flags):
- `it("given 0 ... and 0 previous ...")` — 0 rewards, 0 withdraws; no events.
- `it("given 0.001 ... and 0.001 previous ...")` — 0 rewards, 0 withdraws (no new rewards on previous rewards).
- `it("given 1.9 ... and 2 previous ..., fuse blown")` — ETH balance below previous rewards is invalid → `Paused` emitted, 0 rewards.
- `it("given 0.001 ... and 0 previous ...")` — 0.001 consensus rewards.
- `it("given 0.03 ... and 0.02 previous ...")` — 0.01 consensus rewards.
- `it("given 5.04 ... and 5 previous ...")` — 0.04 consensus rewards.
- `it("given 14 ... and 0 previous ...")` — 14 consensus rewards (large, below fuse start).
- `it("given 21.5 ... and 0 previous ...")` — 21.5 consensus rewards (just under fuse start).
- `it("given 21.6 ... and 0 previous ..., fuse blown")` — exactly fuse start → fuse blown, 0 rewards.
- `it("given 22 ... and 0 previous ..., fuse blown")` — inside fuse interval → fuse blown.
- `it("given 25.5 ... and 0 previous ..., fuse blown")` — just under fuse end → fuse blown.
- `it("given 25.6 ... and 0 previous ..., fuse blown")` — exactly fuse end → fuse blown.
- `it("given 25.7 ... and 0 previous ..., slash detected")` — just over fuse end → slash detected (`AccountingValidatorSlashed` with `remainingValidators=29`, `Withdrawal(weth, 0, 25.7 ETH)`).
- `it("given 26.6 ... and 0 previous ..., slash detected")` — 1 validator slashed.
- `it("given 31.9 ... and 0 previous ..., slash detected")` — slashed validator, no rewards.
- `it("given 32 ... and 0 previous ..., 1 withdraws")` — 1 full validator withdrawal (`AccountingFullyWithdrawnValidator(1, 29, 32 ETH)` + `Withdrawal(weth, 0, 32 ETH)`).
- `it("given 32.01 ... and 0 previous ..., 1 withdraws")` — 0.01 rewards + 1 withdrawal.
- `it("given 33 ... and 32.3 previous ...")` — 0.7 rewards, no withdrawal (previous rewards > 32).
- `it("given 34 ... and 0 previous ..., 1 withdraws")` — 2 rewards + 1 withdrawal.
- `it("given 44 ... and 24 previous ...")` — 20 rewards, 0 withdrawals.
- `it("given 54 ... and 0 previous ..., 1 withdraws, fuse blown")` — 1 withdrawal + remaining 22 ETH inside fuse → `Paused`.
- `it("given 55 ... and 1 previous ..., 1 withdraws, fuse blown")` — same with previous rewards.
- `it("given 58.6 ... and 0 previous ..., 1 withdraws, slash detected")` — 32 withdrawn + 26.6 slashed remainder (`Withdrawal` of 26.6 for slash path).
- `it("given 64 ... and 0 previous ..., 2 withdraws")` — 2 full withdrawals (64 ETH to vault).
- `it("given 64.1 ... and 0 previous ..., 2 withdraws")` — 0.1 rewards + 2 withdrawals.
- `it("given 66 ... and 2 previous ..., 2 withdraws")` — 0 new rewards, 2 withdrawals.
- `it("given 66 ... and 65 previous ...")` — 1 reward on large previous rewards, 0 withdrawals.
- `it("given 100 ... and 65 previous ..., 1 withdraws")` — 3 rewards + 1 withdrawal.
- `it("given 276 ... and 0 previous ..., 8 withdraws")` — 20 rewards + 8 withdrawals (256 ETH to vault).

**describe: "Unit test: Native SSV Staking Strategy" > "Accounting"** (direct tests)
- `it("Only strategist is allowed to manually fix accounting")` — strategist pauses; governor calls `manuallyFixAccounting(1, 2e18, 2e18)` → reverts `"Caller is not the Strategist"`.
- `it("Accounting needs to be paused in order to call fix accounting function")` — strategist calls `manuallyFixAccounting(1, 2e18, 2e18)` without pausing → reverts `"Pausable: not paused"`.
- `it("Validators delta should not be <-4 or >4 for fix accounting function")` — after pause + `mine(7201)`, both `manuallyFixAccounting(-4, 0, 0)` and `(4, 0, 0)` revert `"Invalid validatorsDelta"` (bounds are exclusive: ±3 allowed).
- `it("Consensus rewards delta should not be <-333> and >333 for fix accounting function")` — after pause + mine, both `manuallyFixAccounting(0, -333e18, 0)` and `(0, 333e18, 0)` revert `"Invalid consensusRewardsDelta"`.
- `it("WETH to Vault amount should not be > 96 for fix accounting function")` — after pause + mine, `manuallyFixAccounting(0, 0, 97e18)` reverts `"Invalid wethToVaultAmount"`.

**describe: "Unit test: Native SSV Staking Strategy" > "Accounting" > "Should allow strategist to recover paused contract"**
- Loop over `validatorsDelta` in `[-3, -2, -1, 0, 1, 2, 3]`: `it("by changing validators by <delta>")` — setup: 10 active deposited validators (slot 52), strategist pauses, `mine(7201)`; strategist calls `manuallyFixAccounting(delta, 0, 0)`; asserts `AccountingManuallyFixed(delta, 0, 0)` event and `activeDepositedValidators()` equals prior value + delta. (7 tests)
- Loop over consensus rewards `delta` in `[-332, -320, -1, 0, 1, 320, 332]`: `it("by changing consensus rewards by <delta>")` — setup: strategy ETH balance set to 670, `consensusRewards` storage set to 336 ETH, 10000 active validators; pause + `mine(7201)`; strategist calls `manuallyFixAccounting(0, delta ETH, 0)`; asserts `AccountingManuallyFixed(0, delta ETH, 0)` event and that `consensusRewards()` equals the strategy's ETH balance afterwards. (7 tests)
- Loop over `eth` in `[0, 1, 26, 32, 63, 65, 95]`: `it("by sending <eth> ETH wrapped to WETH to the vault")` — setup: strategy ETH balance set to `eth + 2` (so contract isn't emptied); pause + `mine(7201)`; strategist calls `manuallyFixAccounting(0, 0, eth ETH)`; asserts `AccountingManuallyFixed(0, 0, eth ETH)` event, strategy ETH balance decreased by exactly `eth`, and `consensusRewards()` equals the remaining ETH balance. (7 tests)
- `it("by marking a validator as withdrawn when severely slashed and sent its funds to the vault")` — pause + mine; strategist `manuallyFixAccounting(1, 0, 0)` to seed 1 validator; `setBalance(strategy, 24 ETH)` simulating a validator slashed/penalised by 8 ETH; governor `doAccounting()` → asserts `Paused` emitted (fuse blown); `mine(7201)`; strategist `manuallyFixAccounting(-1, 0, 24e18)` → asserts `AccountingManuallyFixed(-1, 0, 24e18)` and `Withdrawal(weth, address(0), 24e18)` events.
- `it("by changing all three manuallyFixAccounting delta values")` — setup: 5 ETH set on the strategy + josh transfers 5 WETH to it; pause + mine; strategist `manuallyFixAccounting(1, 2.3e18, 2.2e18)` → asserts `AccountingManuallyFixed(1, 2.3e18, 2.2e18)` event.
- `it("Calling manually fix accounting too often should result in an error")` — pause + `mine(7201)` + fix(0,0,0) succeeds; pause again + `mine(7201 - 4)` (insufficient cadence); second fix → reverts `"Fix accounting called too soon"`.
- `it("Calling manually fix accounting twice with enough blocks in between should pass")` — two rounds of pause + `mine(7201)` + `manuallyFixAccounting(0, 0, 0)`; both succeed (no revert; no other assertions).

**describe: "Unit test: Native SSV Staking Strategy" > "Harvest and strategy balance" > "given X execution rewards, Y consensus rewards, Z deposits and N validators"**

Parameterised: 7 cases × 2 tests each. Shared `beforeEach`: `setBalance(strategy, consensusRewards)` if > 0; `setBalance(feeAccumulator, feeAccumulatorEth)` if > 0; josh transfers `deposits` WETH to the strategy if > 0; set `activeDepositedValidators` (slot 52) and `consensusRewards` (slot 104); governor calls `doAccounting()`. Expected: `expectedHarvester = feeAccumulatorEth + consensusRewards`; `expectedBalance = deposits + validators * 32`. Cases (feeAccumulatorEth / consensusRewards / deposits / validators → harvester / balance): (0/0/0/0 → 0/0), (0.1/0/0/0 → 0.1/0), (0/0.2/0/0 → 0.2/0), (0.1/0.2/0/0 → 0.3/0), (2.2/16.3/100/7 → 18.5/324), (10.2/21.5/0/5 → 31.7/160), (10.2/21.5/1/0 → 31.7/1).
- `it("then should harvest <expectedHarvester> WETH")` — impersonates the `oethHarvester` address and calls `collectRewardTokens()`; iff `expectedHarvester > 0` asserts `RewardTokenCollected(oethHarvester, weth, expectedHarvester)` emitted (else NOT emitted); iff `feeAccumulatorEth > 0` asserts FeeAccumulator emits `ExecutionRewardsCollected(strategy, feeAccumulatorEth)` (else NOT emitted); harvester WETH balance diff equals exactly `expectedHarvester`. (7 tests)
- `it("then the strategy should have a <expectedBalance> balance")` — `checkBalance(weth)` equals exactly `deposits + validators*32` ETH. (7 tests)

**describe: "Unit test: Native SSV Staking Strategy" > "Register and stake validators"**

`beforeEach`: strategy funded with 1000 SSV (`setERC20TokenBalance`), josh transfers 256 WETH to the strategy, governor sets `setStakingMonitor(anna)` and `setStakeETHThreshold(64 ETH)`. Two helpers used by the tests: `stakeValidatorsSingle(n, expectThresholdError, startIdx)` — per validator: asserts `validatorsStates(keccak256(pubkey)) == 0` (NON_REGISTERED); `registerSsvValidators([pubkey], operatorIds, [sharesData], emptyCluster, {value: 2 ETH})` emits `SSVValidatorRegistered(keccak256(pubkey), pubkey, operatorIds)` and state becomes 1 (REGISTERED); `stakeEth([{pubkey, signature, depositDataRoot}])` — on the last validator when the threshold error is expected reverts `"Staking ETH over threshold"`, otherwise emits `ETHStaked(keccak256(pubkey), pubkey, 32 ETH)` and state becomes 2 (STAKED). `stakeValidatorsBulk` does the same via a single multi-validator `registerSsvValidators` + single multi-validator `stakeEth` call (asserting per-pubkey events/states, or the bulk revert).
- `it("Should stake to a validator")` — `stakeValidatorsSingle(1, false)`: full register→stake happy path for 1 validator.
- `it("Should stake to 2 validators")` — `stakeValidatorsSingle(2, false)`: 64 ETH staked hits but does not exceed the 64 ETH threshold.
- `it("Should not stake to 3 validators as stake threshold is triggered")` — `stakeValidatorsSingle(3, true)`: first two stake fine, third `stakeEth` reverts `"Staking ETH over threshold"`.
- `it("Should register and stake 2 validators together")` — `stakeValidatorsBulk(2, false)`: bulk register emits `SSVValidatorRegistered` per pubkey; bulk stake emits `ETHStaked` per pubkey; states 1 then 2.
- `it("Should register 3 but not stake 3 validators together")` — `stakeValidatorsBulk(3, true)`: all 3 register fine, single bulk `stakeEth` reverts `"Staking ETH over threshold"`.
- `it("Fail to stake a validator that hasn't been registered")` — `stakeEth` for an unregistered pubkey reverts `"Validator not registered"`.
- `it("Should stake to 2 validators continually when threshold is reset")` — stakes validators 0–1, staking monitor (anna) calls `resetStakeETHTally()`, stakes validators 2–3, resets, stakes validators 4–5, resets; every register/stake asserts the events/states from the single helper.
- `it("Should not reset stake tally if not governor")` — josh calls `resetStakeETHTally()` → reverts `"Caller is not the Monitor"`.
- `it("Should not set stake threshold if not governor")` — josh calls `setStakeETHThreshold(32 ETH)` → reverts `"Caller is not the Governor"`.

**describe: "Unit test: Native SSV Staking Strategy"** (top-level test)
- `it("Deposit alternate deposit_data_root ")` — builds withdrawal credentials via `solidityPack(["bytes1","bytes11","address"], ["0x01", 11 zero bytes, mainnet Native Staking Strategy proxy 0x34ed…0238])` and asserts the packed value equals `0x01000000000000000000000034edb2ee25751ee67f68a45813b22811687c0238`; then calls `depositContractUtils.calculateDepositDataRoot(pubkey, withdrawalCredentials, signature)` with the mainnet-fork test validator's pubkey/signature and asserts the result equals `0xf7d704e25a2b5bea06fafa2dfe5c6fa906816e5c1622400339b2088a11d5f446`.

### `test/behaviour/ssvStrategy.js` — behaviour suite (shared; runs on mainnet fork via its consumer)

This file IS a behaviour suite: `shouldBehaveLikeAnSsvStrategy(context)`. `context` is an async function returning a fixture augmented with: `nativeStakingSSVStrategy`, `nativeStakingFeeAccumulator`, `addresses` (a network address book, e.g. `addresses.mainnet`), `validatorRegistrator` (impersonated signer), `ssvNetwork` (`ISSVNetwork`), and a `testValidator` `{publicKey, operatorIds, sharesData, signature, depositDataRoot}`. Consumers in `contracts/test`: only `test/strategies/nativeSsvStaking.mainnet.fork-test.js` (3 instances, all skipped). Contracts under test: `NativeStakingSSVStrategy`, `FeeAccumulator`, real `ISSVNetwork`, OETH Vault, `simpleOETHHarvester`.

**describe: "Initial setup"**
- `it("Should verify the initial state")` — asserts immutable/config getters against `context().addresses`: `WETH()`, `SSV_TOKEN()` (== addresses.SSV), `SSV_NETWORK()` (== addresses.SSVNetwork), `BEACON_CHAIN_DEPOSIT_CONTRACT()` (== addresses.beaconChainDepositContract), `VAULT_ADDRESS()` (== addresses.OETHVaultProxy); `fuseIntervalStart() == 21.6e18`, `fuseIntervalEnd() == 25.6e18`; `validatorRegistrator() == addresses.validatorRegistrator`; `stakingMonitor() == addresses.Guardian`; `stakeETHThreshold() == 512 ETH`; `MAX_VALIDATORS() == 500`.
- `it("Anyone should be able to set the MEV fee recipient")` — matt (arbitrary account) calls `setFeeRecipient()`; asserts the SSV Network contract emits `FeeRecipientAddressUpdated(strategy, feeAccumulator)`.

**describe: "Deposit/Allocation"**
- `it("Should accept and handle WETH allocation")` — impersonates the OETH Vault address; domen transfers 32 WETH to the strategy; vault signer calls `deposit(weth, 32 ETH)`; asserts `Deposit(weth, address(0), 32 ETH)` event, strategy WETH balance increased by exactly 32 and `checkBalance(weth)` increased by exactly 32.

**describe: "Validator operations"**

`beforeEach`: `this.skip()`s the whole block if `activeDepositedValidators() >= 500` (strategy full); impersonates `addresses.Guardian` (staking monitor) and calls `resetStakeETHTally()`. Helpers: `depositToStrategy(amount)` — tops up the Vault's WETH taking the withdrawal-queue shortfall (`queued - claimed`) into account, then the vault's strategist calls `oethVault.depositToStrategy(strategy, [weth], [amount])`; `registerAndStakeEth()` — fetches the live SSV cluster via `getClusterInfo` (SSV subgraph/utils), funds the strategy with 1000 SSV, asserts validator state 0 (NON_REGISTERED), `registerSsvValidators([pubkey], operatorIds, [sharesData], cluster, {value: 2 ETH})` emits `SSVValidatorRegistered(keccak256(pubkey), pubkey, operatorIds)` → state 1 (REGISTERED), `stakeEth([{pubkey, signature, depositDataRoot}])` emits `ETHStaked(keccak256(pubkey), pubkey, 32 ETH)` → state 2 (STAKED), and the strategy's WETH balance decreased by 32.
- `it("Should register and stake 32 ETH by validator registrator")` — `depositToStrategy(32 ETH)` then the full `registerAndStakeEth()` assertion chain above.
- `it("Should fail to register a validator twice")` — deposit 32 WETH; register the test validator once (`value: 3 ETH`), parse the `ValidatorAdded` event from the receipt (event index 3 on mainnet chainId 1, else 2) to obtain the updated cluster; attempt to register the same pubkey again with different operator IDs `[1, 20, 300, 4000]` and the updated cluster → reverts `"Validator already registered"`.
- `it("Should emit correct values in deposit event")` — deposit 40 WETH and `registerAndStakeEth()` (leaving ≥ 8 WETH on the strategy); a second `depositToStrategy(10 ETH)` (which triggers `depositAll` on the strategy) must emit `Deposit(weth, address(0), 10 ETH)` — only the newly deposited amount, excluding pre-existing WETH.
- `it("Should register and stake 32 ETH even if half supplied by a 3rd party")` — deposit only 16 WETH via the vault; domen (malicious actor) transfers 16 WETH directly to the strategy; `registerAndStakeEth()` still passes all its assertions (donation doesn't break accounting).
- `it("Should exit and remove validator by validator registrator")` — deposit 32; get cluster + fund 1000 SSV; register (`value: 4 ETH`) and extract the post-registration cluster from the SSV network's `ValidatorAdded` log; `stakeEth` 32; `exitSsvValidator(pubkey, operatorIds)` emits `SSVValidatorExitInitiated(keccak256(pubkey), pubkey, operatorIds)`; `removeSsvValidator(pubkey, operatorIds, newCluster)` emits `SSVValidatorExitCompleted(keccak256(pubkey), pubkey, operatorIds)`.
- `it("Should remove registered validator by validator registrator")` — same setup but removes the validator right after registration (no stake, no exit); `removeSsvValidator(pubkey, operatorIds, newCluster)` emits `SSVValidatorExitCompleted(keccak256(pubkey), pubkey, operatorIds)`.

**describe: "Accounting for ETH"**

`beforeEach`: validatorRegistrator calls `doAccounting()` to clear pending ETH; `simpleOETHHarvester.harvestAndTransfer(strategy)` clears consensus rewards; `activeDepositedValidators` forced to 30000 via storage slot 52; snapshots `checkBalance(weth)` and `consensusRewards()`.
- `it("Should account for new consensus rewards")` — `setBalance(strategy, consensusRewardsBefore + 2 ETH)` simulating rewards; validatorRegistrator `doAccounting()` → emits `AccountingConsensusRewards(2 ETH)`; `checkBalance(weth)` unchanged; `consensusRewards()` increased by exactly 2 ETH.
- `it("Should account for withdrawals and consensus rewards")` — `setBalance(strategy, 64 + 3 ETH)` simulating 2 full validator withdrawals + rewards; `expectedConsensusRewards = 3 ETH - consensusRewards()` before; `doAccounting()` → emits `AccountingFullyWithdrawnValidator(2, 29998, 64 ETH)` and `AccountingConsensusRewards(expectedConsensusRewards)`; asserts strategy ETH balance afterwards (note: written as `expect(value, rewards, msg)` with no matcher, so effectively a truthiness check only); `checkBalance(weth)` decreased by exactly 64 ETH; `consensusRewards()` increased by `expectedConsensusRewards`; `activeDepositedValidators() == 29998`; vault WETH balance increased by 64 ETH.

**describe: "Harvest"**
- `it("Should account for new execution rewards")` — snapshots dripper (`oethFixedRateDripperProxy`) WETH, strategy `checkBalance(weth)` and fee accumulator ETH; josh tops up the FeeAccumulator so it holds exactly 7 ETH (execution rewards); `setBalance(strategy, 5 ETH)` (consensus rewards) then validatorRegistrator `doAccounting()`; josh calls `simpleOETHHarvester["harvestAndTransfer(address)"](strategy)` → emits `Harvested(strategy, weth, 12 ETH, oethFixedRateDripperProxy)` (7 execution + 5 consensus); `checkBalance(weth)` unchanged; dripper WETH balance increased by exactly 12 ETH.

### `test/strategies/nativeSsvStaking.mainnet.fork-test.js` — fork test (mainnet)

Context: `loadFixture(nativeStakingSSVStrategyFixture)` in fork mode (impersonated mainnet `validatorRegistrator`, real `ISSVNetwork`, strategy pre-funded with 100 SSV); contracts resolved via `resolveContract` from hardhat-deploy names. Contains NO direct `it()` blocks of its own — it only instantiates `shouldBehaveLikeAnSsvStrategy` (12 tests each, see `test/behaviour/ssvStrategy.js` above) three times. ALL THREE top-level describes are `describe.skip`, so the entire file is currently (skipped).

**describe: "ForkTest: First Native SSV Staking Strategy"** (skipped)
- Consumes `shouldBehaveLikeAnSsvStrategy(async () => ({...fixture, nativeStakingSSVStrategy, nativeStakingFeeAccumulator, addresses: addresses.mainnet, testValidator}))` where the strategy/accumulator resolve from proxies `NativeStakingSSVStrategyProxy` / `NativeStakingFeeAccumulatorProxy` (impl `NativeStakingSSVStrategy` / `FeeAccumulator`) and `testValidator` is pubkey `0xaba6ac…6e25`, operator IDs `[348, 352, 361, 377]`, with real sharesData/signature and depositDataRoot `0xf7d704e2…5f446` (same validator/values used by the unit-test deposit-data-root check).

**describe: "ForkTest: Second Native SSV Staking Strategy"** (skipped)
- Consumes `shouldBehaveLikeAnSsvStrategy` with proxies `NativeStakingSSVStrategy2Proxy` / `NativeStakingFeeAccumulator2Proxy`, `addresses.mainnet`, and testValidator pubkey `0xae2428…53ee`, operator IDs `[752, 753, 754, 755]`; comment notes the signature is intentionally not correct ("will do for testing") and depositDataRoot `0x6f9cc503…cc2c` was calculated via `npx hardhat depositRoot`.

**describe: "ForkTest: Third Native SSV Staking Strategy"** (skipped)
- Consumes `shouldBehaveLikeAnSsvStrategy` with proxies `NativeStakingSSVStrategy3Proxy` / `NativeStakingFeeAccumulator3Proxy`, `addresses.mainnet`, and testValidator pubkey `0x8a51c3…41cc`, operator IDs `[338, 339, 340, 341]`; also a placeholder signature and depositDataRoot `0x3b8409ac…5c86` from `npx hardhat depositRoot`.

---

# Curve AMO strategies OUSD/OETH (mainnet fork)

## Curve AMO strategies OUSD/OETH (mainnet fork)

These two files are near-mirror-image mainnet fork suites for the new-generation `CurveAMOStrategy` (`BaseCurveAMOStrategy` family) attached to the OUSD Vault (OUSD/USDC Curve StableSwap-NG pool + gauge) and the OETH Vault (OETH/WETH Curve pool + gauge). Both use `loadDefaultFixture()` from `test/_fixture.js` and share the same structure: a `beforeEach` that impersonates the vault / strategist / harvester / AMO governor / timelock / the strategy itself, sets the vault buffer to 100%, and seeds the Curve pool with liquidity via a large mint; a set of local helpers (`mintAndDepositToStrategy`, `balancePool`, `unbalancePool`, `simulateCRVInflation`, `snapData`/`logSnapData`/`logProfit`) used for setup and profit accounting; a "happy-path + AMO ops + front-running protection" describe block; a comprehensive revert-reason describe block; and consumption of the three shared behaviour suites (`shouldBehaveLikeStrategy`, `shouldBehaveLikeGovernable`, `shouldBehaveLikeHarvestable`). Key differences: the OUSD file works in mixed decimals (OUSD 18 / USDC 6, so amounts are frequently scaled by `1e12`) with `defaultDeposit = 10,000 OUSD`, while the OETH file is all-18-decimals with `defaultDeposit = 100`; the "deposit when heavily unbalanced" tests use `depositAll()` (OUSD file) vs a second `mintAndDepositToStrategy()` (OETH file); and the OUSD file's unbalanced-deposit assertions use a widened 3% tolerance.

Files covered:
- `contracts/test/strategies/curve-amo-ousd.mainnet.fork-test.js` (37 it() blocks + 3 consumed behaviour suites)
- `contracts/test/strategies/curve-amo-oeth.mainnet.fork-test.js` (37 it() blocks + 3 consumed behaviour suites)

Shared helper semantics (both files, needed to understand assertions):
- `mintAndDepositToStrategy({userOverride, amount, returnTransaction})` — funds the user with the hard asset (USDC/WETH), mints OTokens through the vault, then as vault governor calls `vault.depositToStrategy(strategy, [hardAsset], [amount])`; unless `returnTransaction` is set it asserts the tx emits the strategy's `Deposit` event. Default amount is `defaultDeposit` (scaled to 6 decimals in the OUSD file).
- `balancePool()` — reads `curvePool.get_balances()` and single-sidedly adds whichever token is short (minting OTokens through the vault when the OToken side is short) until reserves are balanced; ends by asserting `balances[0] ≈ balances[1]` (approxEqualTolerance, USDC side scaled by 1e12 in the OUSD file).
- `unbalancePool({balancedBefore, usdcAmount|wethAmount, ousdAmount})` — optionally balances first, then one-sidedly adds the given hard-asset amount, or mints OTokens (~101% of the amount) and adds them one-sidedly.
- `simulateCRVInflation({amount, timejump})` — sets the gauge's CRV balance via storage manipulation and advances time (the `checkpoint` branch is a no-op).
- `snapData`/`logProfit` — snapshot strategy checkBalance, OToken total/rebasing supply, vault totalValue, pool supply/reserves/virtual price, gauge balances; "profit" = Δ(vault totalValue) − Δ(OToken totalSupply).

### `test/strategies/curve-amo-ousd.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `loadDefaultFixture()`; contracts under test: `fixture.OUSDCurveAMO` (CurveAMOStrategy for OUSD/USDC), OUSD Vault, OUSD token, USDC, `curvePoolOusdUsdc`, `curveGaugeOusdUsdc`, CRV token and CRVMinter (via ABI at mainnet addresses). Top-level describe: "Fork Test: Curve AMO OUSD strategy". `defaultDeposit = 10,000 OUSD`; the `beforeEach` sets vault buffer to 1e18 (100%) via impersonated timelock and seeds the pool with 10k OUSD + 10k USDC after minting 2M OUSD from 5M funded USDC.

**describe: "Fork Test: Curve AMO OUSD strategy" > "Initial parameters"**
- `it("Should have correct parameters after deployment")` — asserts strategy getters against `utils/addresses.js` mainnet registry: `platformAddress`, `curvePool` and `lpToken` all equal `curve.OUSD_USDC.pool`; `vaultAddress` = OUSD Vault; `gauge` = `curve.OUSD_USDC.gauge`; `oToken` = OUSD; `hardAsset` = USDC; `governor` = mainnet Timelock; `rewardTokenAddresses(0)` = CRV; `maxSlippage` = 0.002e18 (0.2%); `otokenCoinIndex` = 0; `hardAssetCoinIndex` = 1.
- `it("Should deposit to strategy")` — after `balancePool()`, asserts depositor starts with 0 OUSD, runs `mintAndDepositToStrategy()` (asserts `Deposit` event via helper); then: strategy `checkBalance(USDC)` increased by ≈ 2×deposit (USDC 6-decimals, i.e. deposit×2/1e12, approxEqualTolerance), gauge LP balance increased by ≈ 2×deposit (18 decimals) — 2× because the AMO mints matching OUSD; depositor OUSD balance ≈ deposit; strategy holds exactly 0 USDC.
- `it("Should deposit all to strategy")` — funds the user and transfers `defaultDeposit/1e12` USDC directly to the strategy, asserts strategy USDC balance > 0, then vault-signer calls `depositAll()`; asserts checkBalance delta ≈ 2×deposit (6 dec), gauge delta ≈ 2×deposit (18 dec), strategy USDC balance ends exactly 0.
- `it("Should deposit all to strategy with no balance")` — with strategy USDC balance asserted exactly 0, `depositAll()` from vault signer is a no-op: checkBalance delta exactly 0 and gauge delta exactly 0.
- `it("Should protect against attacker front-running a deposit by adding a lot of usdc to the pool")` — scenario test with profit accounting: balance pool, deposit, rebase; attacker (nick) one-sidedly adds 900k USDC to the pool; vault signer transfers and `deposit()`s 10k USDC into the strategy; attacker `remove_liquidity` of all their LP tokens; asserts protocol profit (Δ vault totalValue − Δ OUSD supply since before the attack) > 0; then rebases to lock in profit and calls `vault.withdrawAllFromStrategy(strategy)` as AMO governor, asserting profit measured from the post-rebase snapshot ≥ 0; also reads the vault's `Redeem` event from the withdraw-all receipt (log-only, args[1] = OUSD burnt). Extensive `snapData`/`logSnapData`/`logProfit` logging at each phase.
- `it("Should protect against an attacker front-running a deposit by adding a lot of OUSD to the pool")` — mirror scenario: attacker one-sidedly adds 1.5M OUSD (comment says 150k, code is 1.5M) to the pool, vault deposits 10k USDC, attacker removes their LP; asserts profit since before the attack > 0; after rebase + `withdrawAllFromStrategy` (AMO governor), asserts profit measured from the post-rebase snapshot ≥ 0. (No Redeem-event read in this variant.)
- `it("Should withdraw from strategy")` — after balance + deposit, vault signer withdraws `defaultDeposit×0.999` (as 6-decimal USDC) via `withdraw(vault, USDC, amount)`; asserts checkBalance decreased by ≈ 2×amount (6 dec), gauge balance decreased by ≈ 2×amount (18 dec) (burning both sides of LP), and strategy ends with exactly 0 OUSD and 0 USDC.
- `it("Should withdraw all from strategy")` — after balance + deposit, vault signer calls `withdrawAll()`; asserts checkBalance ≈ 0 and gauge balance ≈ 0 (approxEqualTolerance), strategy OUSD and USDC balances exactly 0, and vault USDC balance ≈ previous vault balance + gaugeBalance/2e12 (half the LP was the hard-asset side, scaled 18→6 decimals); then calls `withdrawAll()` a second time and asserts it does not revert on an empty strategy.
- `it("Should mintAndAddOToken")` — pool first unbalanced with +`defaultDeposit` USDC (balanced before); strategist calls `mintAndAddOTokens(deposit×0.9999)`; asserts checkBalance increased ≈ deposit (6 dec), gauge increased ≈ deposit (18 dec) — one-sided OUSD add so 1× not 2× — and strategy holds exactly 0 OUSD / 0 USDC.
- `it("Should removeAndBurnOToken")` — balance pool, deposit 2×deposit (6 dec), then unbalance with +2×deposit OUSD; strategist calls `removeAndBurnOTokens(defaultDeposit)`; asserts checkBalance decreased ≈ deposit (6 dec), gauge decreased ≈ deposit (18 dec), strategy holds exactly 0 OUSD / 0 USDC.
- `it("Should removeOnlyAssets")` — balance pool, deposit 2×deposit, unbalance with +2×deposit USDC; strategist calls `removeOnlyAssets(defaultDeposit)` (18-dec argument); asserts checkBalance decreased ≈ deposit (6 dec), gauge decreased ≈ deposit (18 dec), and vault USDC balance increased ≈ deposit (6 dec) — withdrawn USDC goes straight to the vault.
- `it("Should collectRewardTokens")` — deposits, runs `simulateCRVInflation` (0 CRV, 60s time jump), then checkpoints the gauge via `user_checkpoint(strategy)` (called from impersonated strategy address); reads `gauge.integrate_fraction(strategy)` and `crvMinter.minted(strategy, gauge)`; harvester calls `collectRewardTokens()`; conditionally asserts harvester CRV balance strictly increased only if `integrate_fraction − alreadyMinted > 0`; unconditionally asserts CRV balance of the gauge is exactly 0 and of the strategy is exactly 0.
- `it("Should deposit when pool is heavily unbalanced with OUSD")` — balance + deposit, then unbalance with +10×deposit OUSD; vault signer calls `depositAll()`; asserts checkBalance ≈ 2×deposit(6 dec) + gaugeBalance/1e12 and gauge balance ≈ 2×deposit(6 dec) + gaugeBalance — both with a widened 3% tolerance (in-code comment: slippage vs the 1:1 LP approximation) — and strategy USDC balance exactly 0. (Note: the expected values scale `defaultDeposit.mul(2).div(1e12)` for the gauge too, relying on the 3% tolerance.)
- `it("Should deposit when pool is heavily unbalanced with usdc")` — same as above but unbalanced with +10×deposit USDC (6 dec); same three assertions with 3% tolerance and exact-0 strategy USDC balance.
- `it("Should withdraw all when pool is heavily unbalanced with OUSD")` — sets `defaultDeposit = 500 OUSD` for this test, balance + deposit, unbalance with +100×deposit OUSD; vault signer `withdrawAll()`; asserts checkBalance ≈ 0, gauge ≈ 0, strategy OUSD and USDC exactly 0, and vault USDC ≈ previous balance + gaugeBalance/2e12.
- `it("Should withdraw all when pool is heavily unbalanced with usdc")` — sets `defaultDeposit = 500 OUSD`, unbalance with +100×deposit USDC (6 dec); same five withdrawAll assertions as above (vault USDC ≈ prev + gaugeBalance/2e12).
- `it("Should set max slippage")` — AMO governor calls `setMaxSlippage(0.01456e18)`; asserts `maxSlippage()` equals exactly 0.01456e18.

**describe: "Fork Test: Curve AMO OUSD strategy" > "Should revert when"**
- `it("Deposit: Must deposit something")` — vault signer `deposit(USDC, 0)` reverts with `"Must deposit something"`.
- `it("Deposit: Unsupported asset")` — vault signer `deposit(OUSD, defaultDeposit)` reverts with `"Unsupported asset"`.
- `it("Deposit: Caller is not the Vault")` — strategist `deposit(USDC, defaultDeposit)` reverts with `"Caller is not the Vault"`.
- `it("Deposit: Protocol is insolvent")` — after balance + deposit, cheats insolvency by having the impersonated strategy call `vault.mintForStrategy(1,000,000e18)`; a subsequent `mintAndDepositToStrategy({returnTransaction: true})` reverts with `"Protocol insolvent"`.
- `it("Withdraw: Must withdraw something")` — vault signer `withdraw(vault, USDC, 0)` reverts with `"Must withdraw something"`.
- `it("Withdraw: Can only withdraw hard asset")` — vault signer `withdraw(vault, OUSD, defaultDeposit)` reverts with `"Can only withdraw hard asset"`.
- `it("Withdraw: Caller is not the vault")` — strategist `withdraw(vault, USDC, defaultDeposit)` reverts with `"Caller is not the Vault"`.
- `it("Withdraw: Amount is greater than balance")` — vault signer withdrawing 1,000,000e18 (more than the strategy's LP) reverts with `"Insufficient LP tokens"`.
- `it("Withdraw: Protocol is insolvent")` — balance + deposit 2×deposit; cheats insolvency with `mintForStrategy(1M)` and then transfers the 1M OUSD from the strategy to the vault (so it isn't burned on withdraw); vault signer `withdraw(vault, USDC, deposit/1e12)` reverts with `"Protocol insolvent"`.
- `it("Mint OToken: Asset overshot peg")` — balance + deposit, unbalance with +deposit USDC; strategist `mintAndAddOTokens(deposit×2)` reverts with `"Assets overshot peg"` (would mint more OUSD than the USDC excess).
- `it("Mint OToken: OTokens balance worse")` — balance + deposit, unbalance with +2×deposit OUSD; strategist `mintAndAddOTokens(deposit)` reverts with `"OTokens balance worse"`.
- `it("Mint OToken: Protocol insolvent")` — balance + deposit, `mintForStrategy(1M)` cheat; strategist `mintAndAddOTokens(deposit)` reverts with `"Protocol insolvent"`.
- `it("Burn OToken: Asset balance worse")` — balance + deposit 2×deposit, unbalance with +2×deposit USDC; strategist `removeAndBurnOTokens(deposit)` reverts with `"Assets balance worse"`.
- `it("Burn OToken: OTokens overshot peg")` — balance + deposit, unbalance with +deposit OUSD; strategist `removeAndBurnOTokens(deposit×1.10)` reverts with `"OTokens overshot peg"`.
- `it("Burn OToken: Protocol insolvent")` — balance + deposit, `mintForStrategy(1M)` cheat; strategist `removeAndBurnOTokens(deposit)` reverts with `"Protocol insolvent"`.
- `it("Remove only assets: Asset overshot peg")` — balance + deposit 2×deposit, unbalance with +2×deposit USDC; strategist `removeOnlyAssets(deposit×3)` reverts with `"Assets overshot peg"`.
- `it("Remove only assets: OTokens balance worse")` — balance + deposit 2×deposit, unbalance with +2×deposit OUSD; strategist `removeOnlyAssets(deposit)` reverts with `"OTokens balance worse"`.
- `it("Remove only assets: Protocol insolvent")` — balance + deposit 2×deposit, `mintForStrategy(1M)` cheat; strategist `removeOnlyAssets(deposit)` reverts with `"Protocol insolvent"`.
- `it("Check balance: Unsupported asset")` — `checkBalance(OUSD)` reverts with `"Unsupported asset"` (only the hard asset is queryable).
- `it("Max slippage is too high")` — AMO governor `setMaxSlippage(0.51e18)` reverts with `"Slippage must be less than 100%"` (limit is 0.5e18 despite the message).

**Consumed behaviour suites** (see `test/behaviour/` docs for their it() bullets):
- `shouldBehaveLikeStrategy(...)` from `test/behaviour/strategy.js` — passed the spread fixture plus `{strategy: OUSDCurveAMO, curveAMOStrategy, vault: OUSD Vault, assets: [usdc], timelock, governor: Timelock signer, strategist: rafael, harvester: fixture.strategist, newBehavior: true, beforeEach: balancePool()}` (generic deposit/withdraw/withdrawAll access control, checkBalance, transferToken, setHarvesterAddress, setRewardTokenAddresses tests).
- `shouldBehaveLikeGovernable(...)` from `test/behaviour/governable.js` — passed `{...fixture, strategist: rafael, governor: Timelock signer, strategy: OUSDCurveAMO}` (governor set/transfer/claim tests).
- `shouldBehaveLikeHarvestable(...)` from `test/behaviour/harvestable.js` — passed `{...fixture, strategy: OUSDCurveAMO, governor, oeth: ousd, harvester: fixture.strategist, strategist: impersonatedStrategist, newBehavior: true}` (collectRewardTokens access control tests).

### `test/strategies/curve-amo-oeth.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `loadDefaultFixture()`; contracts under test: `fixture.OETHCurveAMO` (CurveAMOStrategy for OETH/WETH), OETH Vault, OETH token, WETH, `curvePoolOETHWETH`, `curveGaugeOETHWETH`, CRV/CRVMinter at mainnet addresses. Top-level describe: "Curve AMO OETH strategy". `defaultDeposit = 100` (18 decimals; the file reuses `ousdUnits` for all amounts). `beforeEach` mirrors the OUSD file: vault buffer 100%, nick funded with 5M WETH, mints 2M OETH, seeds the pool with 1,000 OETH + 1,000 WETH. All decimal scaling is 1:1 (no `1e12` factors). Many log strings still say "OUSD"/"usdc" (copied from the OUSD file) but operate on OETH/WETH.

**describe: "Curve AMO OETH strategy" > "Initial parameters"**
- `it("Should have correct parameters after deployment")` — same 12 getter assertions as the OUSD file but against `curve.OETH_WETH.pool`/`.gauge`, `oToken` = OETH, `hardAsset` = WETH, `governor` = mainnet Timelock, `rewardTokenAddresses(0)` = CRV, `maxSlippage` = 0.002e18, `otokenCoinIndex` = 0, `hardAssetCoinIndex` = 1.
- `it("Should deposit to strategy")` — asserts depositor starts with 0 OETH; after `mintAndDepositToStrategy()` (asserts `Deposit` event): checkBalance(WETH) delta ≈ 2×deposit, gauge delta ≈ 2×deposit, depositor OETH ≈ deposit, strategy WETH exactly 0.
- `it("Should deposit all to strategy")` — transfers `defaultDeposit` WETH directly to the strategy (asserts balance > 0), vault signer `depositAll()`; checkBalance delta ≈ 2×deposit, gauge delta ≈ 2×deposit, strategy WETH exactly 0.
- `it("Should deposit all to strategy with no balance")` — with strategy WETH exactly 0, `depositAll()` produces exactly-0 deltas in checkBalance and gauge balance.
- `it("Should protect against attacker front-running a deposit by adding a lot of weth to the pool")` — same scenario as the OUSD variant: attacker adds 1.5M WETH one-sidedly, vault deposits 10k WETH via `deposit()`, attacker removes all LP; asserts profit (Δ vault totalValue − Δ OETH supply since pre-attack) > 0; after rebase + `withdrawAllFromStrategy` (AMO governor), asserts post-rebase-measured profit ≥ 0; reads the OETH vault's `Redeem` event args[1] from the withdraw-all receipt (log only). Full snapshot/profit logging throughout.
- `it("Should protect against an attacker front-running a deposit by adding a lot of OETH to the pool")` — attacker adds 1.5M OETH one-sidedly (comment says 150k OUSD; code is 1.5M OETH), vault deposits 10k WETH, attacker removes LP; asserts profit since pre-attack > 0; after rebase + `withdrawAllFromStrategy`, asserts post-rebase profit ≥ 0.
- `it("Should withdraw from strategy")` — vault signer withdraws `defaultDeposit×0.999` WETH; asserts checkBalance decreased ≈ 2×amount, gauge decreased ≈ 2×amount, strategy OETH and WETH exactly 0.
- `it("Should withdraw all from strategy")` — vault signer `withdrawAll()`; asserts checkBalance ≈ 0, gauge ≈ 0, strategy OETH/WETH exactly 0, vault WETH ≈ previous + gaugeBalance/2e12 (note: the `/1e12` scaling is copied from the USDC file even though WETH is 18-decimals, so the expected delta is ≈ previous balance within the approx tolerance); second `withdrawAll()` on the empty strategy asserted not to revert.
- `it("Should mintAndAddOToken")` — unbalance with +deposit WETH (balanced first); strategist `mintAndAddOTokens(deposit×0.9999)`; checkBalance delta ≈ deposit, gauge delta ≈ deposit, strategy OETH/WETH exactly 0.
- `it("Should removeAndBurnOToken")` — balance, deposit 2×deposit, unbalance with +2×deposit OETH; strategist `removeAndBurnOTokens(deposit)`; checkBalance decreased ≈ deposit, gauge decreased ≈ deposit, strategy OETH/WETH exactly 0.
- `it("Should removeOnlyAssets")` — balance, deposit 2×deposit, unbalance with +2×deposit WETH; strategist `removeOnlyAssets(deposit)`; checkBalance decreased ≈ deposit, gauge decreased ≈ deposit, vault WETH increased ≈ deposit.
- `it("Should collectRewardTokens")` — identical logic to the OUSD variant: CRV inflation sim (0 CRV, 60s), gauge `user_checkpoint`, conditional assertion that harvester CRV balance strictly increases only when `integrate_fraction − minted > 0`; gauge and strategy CRV balances asserted exactly 0.
- `it("Should deposit when pool is heavily unbalanced with OUSD")` — balance + deposit, unbalance with +10×deposit OETH, then a second `mintAndDepositToStrategy()` (not depositAll); asserts checkBalance ≈ 2×deposit + prior gaugeBalance and gauge ≈ 2×deposit + prior gaugeBalance (default tolerance, no 3% widening), strategy WETH exactly 0.
- `it("Should deposit when pool is heavily unbalanced with weth")` — balance + deposit, unbalance with +100×deposit WETH, second `mintAndDepositToStrategy()`; asserts checkBalance ≈ 3×deposit + prior gaugeBalance and gauge ≈ 3×deposit + prior gaugeBalance (3× because the one-sided add into a WETH-heavy pool yields extra LP), strategy WETH exactly 0.
- `it("Should withdraw all when pool is heavily unbalanced with OUSD")` — sets `defaultDeposit = 500`; unbalance with +100×deposit OETH; `withdrawAll()`; asserts checkBalance ≈ 0, gauge ≈ 0, strategy OETH/WETH exactly 0, vault WETH ≈ previous + gaugeBalance/2e12 (same copied 6-decimal scaling as above).
- `it("Should withdraw all when pool is heavily unbalanced with weth")` — sets `defaultDeposit = 500`; unbalance with +2×deposit WETH; `withdrawAll()`; same first four assertions, and vault WETH ≈ previous + gaugeBalance/2 (correct 18-decimal halving in this variant).
- `it("Should set max slippage")` — AMO governor `setMaxSlippage(0.01456e18)`; asserts `maxSlippage()` equals exactly 0.01456e18.

**describe: "Curve AMO OETH strategy" > "Should revert when"**
- `it("Deposit: Must deposit something")` — vault signer `deposit(WETH, 0)` reverts with `"Must deposit something"`.
- `it("Deposit: Unsupported asset")` — vault signer `deposit(OETH, defaultDeposit)` reverts with `"Unsupported asset"`.
- `it("Deposit: Caller is not the Vault")` — strategist `deposit(WETH, defaultDeposit)` reverts with `"Caller is not the Vault"`.
- `it("Deposit: Protocol is insolvent")` — after balance + deposit, impersonated strategy calls `oethVault.mintForStrategy(1,000,000e18)`; a subsequent `mintAndDepositToStrategy({returnTransaction: true})` reverts with `"Protocol insolvent"`.
- `it("Withdraw: Must withdraw something")` — vault signer `withdraw(vault, WETH, 0)` reverts with `"Must withdraw something"`.
- `it("Withdraw: Can only withdraw hard asset")` — vault signer `withdraw(vault, OETH, defaultDeposit)` reverts with `"Can only withdraw hard asset"`.
- `it("Withdraw: Caller is not the vault")` — strategist `withdraw(vault, WETH, defaultDeposit)` reverts with `"Caller is not the Vault"`.
- `it("Withdraw: Amount is greater than balance")` — vault signer withdrawing 1,000,000e18 WETH reverts with `"Insufficient LP tokens"`.
- `it("Withdraw: Protocol is insolvent")` — balance + deposit 2×deposit; `mintForStrategy(1M)` cheat plus transfer of the minted OETH to the vault; vault signer `withdraw(vault, WETH, deposit)` reverts with `"Protocol insolvent"`.
- `it("Mint OToken: Asset overshot peg")` — unbalance with +deposit WETH; strategist `mintAndAddOTokens(deposit×2)` reverts with `"Assets overshot peg"`.
- `it("Mint OToken: OTokens balance worse")` — unbalance with +2×deposit OETH; strategist `mintAndAddOTokens(deposit)` reverts with `"OTokens balance worse"`.
- `it("Mint OToken: Protocol insolvent")` — `mintForStrategy(1M)` cheat; strategist `mintAndAddOTokens(deposit)` reverts with `"Protocol insolvent"`.
- `it("Burn OToken: Asset balance worse")` — deposit 2×deposit, unbalance with +2×deposit WETH; strategist `removeAndBurnOTokens(deposit)` reverts with `"Assets balance worse"`.
- `it("Burn OToken: OTokens overshot peg")` — unbalance with +deposit OETH; strategist `removeAndBurnOTokens(deposit×1.10)` reverts with `"OTokens overshot peg"`.
- `it("Burn OToken: Protocol insolvent")` — `mintForStrategy(1M)` cheat; strategist `removeAndBurnOTokens(deposit)` reverts with `"Protocol insolvent"`.
- `it("Remove only assets: Asset overshot peg")` — deposit 2×deposit, unbalance with +2×deposit WETH; strategist `removeOnlyAssets(deposit×3)` reverts with `"Assets overshot peg"`.
- `it("Remove only assets: OTokens balance worse")` — deposit 2×deposit, unbalance with +2×deposit OETH; strategist `removeOnlyAssets(deposit)` reverts with `"OTokens balance worse"`.
- `it("Remove only assets: Protocol insolvent")` — deposit 2×deposit, `mintForStrategy(1M)` cheat; strategist `removeOnlyAssets(deposit)` reverts with `"Protocol insolvent"`.
- `it("Check balance: Unsupported asset")` — `checkBalance(OETH)` reverts with `"Unsupported asset"`.
- `it("Max slippage is too high")` — AMO governor `setMaxSlippage(0.51e18)` reverts with `"Slippage must be less than 100%"`.

**Consumed behaviour suites** (see `test/behaviour/` docs for their it() bullets):
- `shouldBehaveLikeStrategy(...)` from `test/behaviour/strategy.js` — passed the spread fixture plus `{strategy: OETHCurveAMO, curveAMOStrategy, vault: OETH Vault, assets: [weth], timelock, governor: Timelock signer, strategist: rafael, harvester: fixture.strategist, newBehavior: true, beforeEach: balancePool()}`.
- `shouldBehaveLikeGovernable(...)` from `test/behaviour/governable.js` — passed `{...fixture, strategist: rafael, governor: Timelock signer, strategy: OETHCurveAMO}`.
- `shouldBehaveLikeHarvestable(...)` from `test/behaviour/harvestable.js` — passed `{...fixture, strategy: OETHCurveAMO, governor, oeth, harvester: fixture.strategist, strategist: impersonatedStrategist, newBehavior: true}`.

---

# Algebra AMO behaviour suite + Hydrex AMO (Base fork)

This area covers the shared, parameterized fork-test behaviour suite for Algebra/Solidly-style AMO strategies (`shouldBehaveLikeAlgebraAmoStrategy`) and its Base-network consumer, the OETHb Hydrex AMO fork test. The behaviour suite exercises an AMO strategy against a real two-token (asset/OToken) stable pool + gauge: deployment config, access control, deposits/withdrawals (with exact event and supply/reserve accounting), strategist pool-rebalancing via `swapAssetsToPool`/`swapOTokensToPool` under five pool-imbalance regimes, attacker front-running scenarios, small-pool-share stress swaps, and insolvency guards. All monetary amounts are supplied via a `scenarioConfig` object (defaults defined at the top of the suite, Sonic-scale; deep-merged with per-consumer overrides), so the same `it()` blocks run with different magnitudes per network.

Files covered:
- `contracts/test/behaviour/algebraAmoStrategy.js` (behaviour suite, 69 `it()` blocks)
- `contracts/test/strategies/base/oethb-hydrex-amo.base.fork-test.js` (Base fork consumer, 6 own `it()` blocks + consumes the suite)

Consumers of the behaviour suite (grep of `contracts/test`):
- `test/strategies/base/oethb-hydrex-amo.base.fork-test.js` (OETHb Hydrex AMO, Base)
- `test/strategies/sonic/swapx-amo.sonic.fork-test.js` (OS SwapX AMO, Sonic; uses `swapXAMOFixture`, its own scenarioConfig, and `harvest.collectedBy: "strategist"`)

### `test/behaviour/algebraAmoStrategy.js` — behaviour suite (network-agnostic; runs as fork test on the consumer's network)

Context: exports `shouldBehaveLikeAlgebraAmoStrategy(contextFunction)`. The context function returns `{ scenarioConfig, loadFixture }`; `loadFixture(opts)` accepts `{ assetMintAmount, depositToStrategy, balancePool, poolAddAssetAmount, poolAddOTokenAmount }` and must return a fixture with `assetToken, oToken, rewardToken, amoStrategy, pool, gauge, governor, timelock, strategist, nick, oTokenPoolIndex, vaultSigner, vault, harvester`. Top-level `describe("ForkTest: Algebra AMO Strategy")` retries each test up to 3 times on CI. Every sub-describe's `beforeEach` re-invokes `contextFunction()` and `loadFixture(...)` with scenario-specific options.

**Shared assertion helpers** (referenced by many bullets below; not tests themselves):
- `assertDeposit(amount)`: nick mints `amount` OToken via `vault.mint`; vaultSigner transfers `amount` asset to strategy and calls `deposit(asset, amount)`. Asserts: `Deposit` event with args `(asset, pool, amount)` AND a second `Deposit` event `(oToken, pool, oTokenMintAmount)` where `oTokenMintAmount = amount * oTokenReserves / assetReserves`; strategy `checkBalance(asset)` increased by the balanced-pool value of the deposited pair (Solidly stable-invariant `calcReserveValue`), within ±15 wei; `oToken.totalSupply()` increased by exactly `oTokenMintAmount`; pool reserves increased by exactly `(amount, oTokenMintAmount)`; vault's asset balance decreased by exactly `amount`; strategy's pool-LP balance == 0 and strategy's OToken balance == 0. (A `gaugeSupply` delta is passed but the checker only asserts `stratGaugeBalance`, so gauge supply is effectively unchecked.)
- `assertWithdrawAll()`: computes proportional `assetTokenWithdrawAmount`/`oTokenBurnAmount` from the strategy's gauge LP share of pool reserves; vaultSigner calls `withdrawAll()`. Asserts: `Withdrawal` events `(asset, pool, assetTokenWithdrawAmount)` and `(oToken, pool, oTokenBurnAmount)`; strategy `checkBalance` decreased by the balanced-pool value of the withdrawn pair ±15 wei; OToken supply decreased by exactly the burn amount; pool reserves decreased by exactly the two amounts; vault asset balance increased by exactly the withdrawn asset; strategy gauge balance goes to ~0 (±1 wei); `assetTokenWithdrawAmount + oTokenBurnAmount >= strategy balance before`; strategy pool-LP and OToken balances == 0.
- `assertWithdrawPartial(amount)`: vaultSigner calls `withdraw(vault, asset, amount)`. Asserts: `Withdrawal` event `(asset, pool, amount)` plus a second `Withdrawal` with named args `{_asset: oToken, _pToken: pool}`; strategy `checkBalance` decreased by the balanced-pool value of `(amount, oTokenBurnAmount)` ±15 wei where `oTokenBurnAmount` derives from `lpBurn = amount*lpSupply/assetReserves + 1`; OToken supply decreased by exactly `oTokenBurnAmount`; asset reserves within `[expected-50, expected]` wei of `before - amount`; OToken reserves decreased exactly; vault asset balance increased by exactly `amount`; strategy pool-LP and OToken balances == 0.
- `assertFailedDeposit(amount, msg)` / `assertFailedDepositAll(amount, msg)`: tops up the vault via `setERC20TokenBalance` if needed, transfers `amount` asset to the strategy, then expects `deposit(asset, amount)` / `depositAll()` from vaultSigner to revert with `msg`.
- `assertSwapAssetsToPool(assetAmount)`: strategist calls `swapAssetsToPool(assetAmount)`. Asserts `SwapAssetsToPool` event with: asset amount within ±1 wei of requested; exact expected LP burn amount; OToken burnt approx-equal (10% tolerance) to estimated removal+swap amount; vault asset balance unchanged (exact); strategy pool-LP and OToken balances == 0.
- `assertSwapOTokensToPool(oTokenAmount)`: strategist calls `swapOTokensToPool(oTokenAmount)`. Asserts `SwapOTokensToPool` event with named arg `{oTokenMinted: oTokenAmount}`; vault asset balance unchanged (exact); strategy pool-LP and OToken balances == 0.
- `poolSwapTokensIn(tokenIn, amountIn)`: nick transfers `amountIn` to the pool and calls the low-level Solidly `pool.swap(...)` using `pool.getAmountOut` and `oTokenPoolIndex`; returns the amount out. `logProfit(dataBefore)` computes vault profit = Δ`vault.totalValue()` − Δ`oToken.totalSupply()`.

**describe: "ForkTest: Algebra AMO Strategy" > "post deployment"** (fixture: `loadFixture()` with defaults — no mint, no deposit)
- `it("Should have constants and immutables set")` — assertions: `SOLVENCY_THRESHOLD() == 0.998e18`; `asset()`, `oToken()`, `pool()`, `gauge()`, `governor()` equal the fixture's assetToken/oToken/pool/gauge/governor addresses; `supportsAsset(asset)` is true; `maxDepeg() == 0.01e18`.
- `it("Should be able to check balance")` — assertions: `checkBalance(asset) >= 0`; additionally sends `checkBalance` as a real transaction from nick (populateTransaction + sendTransaction) so gas usage can be reported.
- `it("Only Governor can approve all tokens")` — assertions: `isGovernor()` true for timelock; timelock's `safeApproveAllTokens()` emits an `Approval` event on the pool; strategist, nick and vaultSigner each revert with "Caller is not the Governor".
- `it("Only Governor can set the max depeg")` — assertions: timelock `setMaxDepeg(0.02e18)` emits `MaxDepegUpdated(0.02e18)` and `maxDepeg()` returns the new value; strategist, nick and vaultSigner each revert with "Caller is not the Governor".
- `it("Governor should fail to set max depeg too small (1bp)")` — assertions: timelock `setMaxDepeg(0.0001e18)` reverts with "Invalid max depeg range".
- `it("Governor should fail to set max depeg too large (1100bp)")` — assertions: timelock `setMaxDepeg(0.11e18)` reverts with "Invalid max depeg range".

**describe: "ForkTest: Algebra AMO Strategy" > "with asset token in the vault"** (fixture: `assetMintAmount = bootstrapPool.largeAssetBootstrapIn`, `depositToStrategy: false`, `balancePool: true`)
- `it("Vault should deposit asset token to AMO strategy")` — assertions: full `assertDeposit(mintValues.small)` accounting (dual `Deposit` events, exact OToken mint/supply/reserve/vault-balance deltas, strat balance ±15 wei, zero residual LP/OToken on strategy).
- `it("Only vault can deposit asset token to AMO strategy")` — setup: vaultSigner transfers `mintValues.extraSmall` asset to the strategy; assertions: `deposit(asset, amount)` from strategist, timelock and nick each reverts with "Caller is not the Vault".
- `it("Only vault can deposit all asset tokens to AMO strategy")` — setup: same transfer; assertions: `depositAll()` from strategist, timelock and nick each reverts with "Caller is not the Vault"; then vaultSigner's `depositAll()` succeeds and emits `Deposit` with named args `{_asset: assetToken, _pToken: pool}`.

**describe: "ForkTest: Algebra AMO Strategy" > "with the strategy having OToken and asset token in a balanced pool"** (fixture: `assetMintAmount = largeAssetBootstrapIn`, `depositToStrategy: true`, `balancePool: true`)
- `it("Vault should deposit asset token")` — assertions: full `assertDeposit(mintValues.medium)` accounting.
- `it("Vault should be able to withdraw all")` — assertions: full `assertWithdrawAll()` accounting (dual `Withdrawal` events with exact amounts, supply/reserve/vault-balance deltas, gauge balance zeroed ±1 wei).
- `it("Vault should be able to withdraw all in SwapX Emergency")` — setup: impersonates `gauge.owner()` and calls `gauge.activateEmergencyMode()`; assertions: full `assertWithdrawAll()` still passes in emergency mode, and a second `withdrawAll()` on the now-empty strategy does not revert.
- `it("Should fail to deposit zero asset token")` — assertions: vaultSigner `deposit(asset, 0)` reverts with "Must deposit something".
- `it("Should fail to deposit oToken")` — assertions: vaultSigner `deposit(oToken, 1e18)` reverts with "Unsupported asset".
- `it("Should fail to withdraw zero asset token")` — assertions: vaultSigner `withdraw(vault, asset, 0)` reverts with "Must withdraw something".
- `it("Should fail to withdraw oToken")` — assertions: vaultSigner `withdraw(vault, oToken, 1e18)` reverts with "Unsupported asset".
- `it("Should fail to withdraw to a user")` — assertions: vaultSigner `withdraw(nick, asset, 1e18)` reverts with "Only withdraw to vault allowed".
- `it("Vault should be able to withdraw all from empty strategy")` — assertions: after a full `assertWithdrawAll()`, a second `withdrawAll()` succeeds but emits NO `Withdrawal` event.
- `it("Vault should be able to partially withdraw")` — assertions: full `assertWithdrawPartial(mintValues.small)` accounting.
- `it("Only vault can withdraw asset token from AMO strategy")` — assertions: `withdraw(vault, asset, mintValues.extraSmall)` from strategist, timelock and nick each reverts with "Caller is not the Vault".
- `it("Only vault and governor can withdraw all from AMO strategy")` — assertions: `withdrawAll()` from strategist and nick reverts with "Caller is not the Vault or Governor"; from timelock (governor) it succeeds and emits `Withdrawal`.
- `it("Harvester can collect rewards")` — setup: impersonates the gauge's `DISTRIBUTION()` address, funds it with `mintValues.small` reward tokens via `setERC20TokenBalance`, and calls `gauge.notifyRewardAmount(rewardToken, amount)`; then harvests per `scenarioConfig.harvest.collectedBy`: `"strategist"` → strategist calls `amoStrategy.collectRewardTokens()`, `"harvester"` → nick calls `harvester.harvestAndTransfer(strategy)` (throws for any other value); assertions: tx emits `RewardTokenCollected` on the strategy and the strategist's reward-token balance strictly increases.
- `it("Attacker front-run deposit within range by adding asset token to the pool")` — scenario: nick swaps `attackerFrontRun.moderateAssetIn` asset into the pool (tilting price but within the depeg band), vault then deposits `rebalanceProbe.frontRun.depositAmount` to the strategy (vault topped up if needed), attacker swaps the OToken back out; assertions: the deposit transaction succeeds despite the moderate tilt (no explicit expect beyond successful execution); profit/attacker P&L is only logged.

**describe: "ForkTest: Algebra AMO Strategy" > "with the strategy having OToken and asset token in a balanced pool" > "When attacker front-run by adding a lot of asset token to the pool"** (beforeEach re-loads fixture with `assetMintAmount = rebalanceProbe.frontRun.tiltSeedWithdrawAmount`, `depositToStrategy: true`, no pool balancing; then nick swaps `attackerFrontRun.largeAssetIn` asset into the pool, heavily tilting it toward asset)
- `it("Strategist fails to deposit to strategy")` — assertions: `assertFailedDeposit(rebalanceProbe.frontRun.failedDepositAmount, "price out of range")` — vault deposit reverts with exactly "price out of range".
- `it("Strategist fails to deposit all to strategy")` — assertions: `assertFailedDepositAll(rebalanceProbe.frontRun.failedDepositAllAmount, "price out of range")` — `depositAll()` reverts with "price out of range".
- `it("Strategist should withdraw from strategy with a profit")` — scenario: vaultSigner withdraws `rebalanceProbe.frontRun.assetTiltWithdrawAmount` asset (the OToken burn amount is read from the `Withdrawal` event for logging), then the attacker swaps the acquired OToken back into the pool; assertions: vault profit (Δ`vault.totalValue()` − Δ`oToken.totalSupply()` versus the pre-attack snapshot) is strictly > 0, i.e. the protocol gains from the attacker's round trip.

**describe: "ForkTest: Algebra AMO Strategy" > "with the strategy having OToken and asset token in a balanced pool" > "When attacker front-run by adding a lot of OToken to the pool"** (beforeEach re-loads fixture with `assetMintAmount = tiltSeedWithdrawAmount`, `depositToStrategy: true`; nick mints `attackerFrontRun.largeOTokenIn` OToken via `vault.mint` and swaps it into the pool, tilting it toward OToken)
- `it("Strategist fails to deposit to strategy")` — assertions: vault deposit of `failedDepositAmount` reverts with "price out of range".
- `it("Strategist fails to deposit all to strategy")` — assertions: `depositAll()` after transferring `failedDepositAllAmount` reverts with "price out of range".
- `it("Strategist should withdraw from strategy with a profit")` — scenario: vaultSigner withdraws `rebalanceProbe.frontRun.oTokenTiltWithdrawAmount` asset (OToken burn read from `Withdrawal` event for logging), attacker swaps the asset back into the pool for OToken; assertions: vault profit versus the pre-attack snapshot is strictly > 0; attacker's OToken/asset P&L only logged.

**describe: "ForkTest: Algebra AMO Strategy" > "with a lot more OToken in the pool"** (fixture: `assetMintAmount = bootstrapPool.smallAssetBootstrapIn`, `depositToStrategy: true`, `balancePool: true`, `poolAddOTokenAmount = poolImbalance.lotMoreOToken.addOToken` — pool heavily OToken-tilted)
- `it("Vault should fail to deposit asset token to AMO strategy")` — assertions: `assertFailedDeposit(rebalanceProbe.lotMoreOToken.failedDepositAmount, "price out of range")`.
- `it("Vault should be able to withdraw all")` — assertions: full `assertWithdrawAll()` accounting.
- `it("Vault should be able to partially withdraw")` — assertions: full `assertWithdrawPartial(rebalanceProbe.lotMoreOToken.partialWithdrawAmount)` accounting.
- `it("Strategist should swap a little assets to the pool")` — assertions: full `assertSwapAssetsToPool(smallSwapAssetsToPool)` (event args ±1 wei / exact LP burn / OToken burnt within 10%, vault asset balance unchanged, no residual LP/OToken).
- `it("Strategist should swap enough asset token to get the pool close to balanced")` — setup: computes assetAmount = 5% of the pool's OToken excess, scaled by the reserve ratio; assertions: full `assertSwapAssetsToPool(assetAmount)`.
- `it("Strategist should swap a lot of assets to the pool")` — assertions: full `assertSwapAssetsToPool(largeSwapAssetsToPool)`.
- `it("Strategist should swap most of the asset token owned by the strategy")` — assertions: full `assertSwapAssetsToPool(nearMaxSwapAssetsToPool)`.
- `it("Strategist should fail to add more asset token than owned by the strategy")` — assertions: strategist `swapAssetsToPool(excessiveSwapAssetsToPool)` reverts with "Not enough LP tokens in gauge".
- `it("Strategist should fail to add more OToken to the pool")` — assertions: strategist `swapOTokensToPool(disallowedSwapOTokensToPool)` reverts with "OTokens balance worse" (swapping OToken in when the pool already has excess OToken is disallowed).

**describe: "ForkTest: Algebra AMO Strategy" > "with a little more OToken in the pool"** (fixture: `assetMintAmount = mediumAssetBootstrapIn`, `depositToStrategy: true`, `balancePool: true`, `poolAddOTokenAmount = poolImbalance.littleMoreOToken.addOToken`)
- `it("Vault should deposit asset token to AMO strategy")` — assertions: full `assertDeposit(rebalanceProbe.littleMoreOToken.depositAmount)` accounting (deposits are allowed under a small tilt).
- `it("Vault should be able to withdraw all")` — assertions: full `assertWithdrawAll()` accounting.
- `it("Vault should be able to partially withdraw")` — assertions: full `assertWithdrawPartial(partialWithdrawAmount)` accounting.
- `it("Strategist should swap a little assets to the pool")` — assertions: full `assertSwapAssetsToPool(smallSwapAssetsToPool)`.
- `it("Strategist should swap enough asset token to get the pool close to balanced")` — setup: assetAmount computed from 50% of the OToken excess scaled by the reserve ratio; assertions: full `assertSwapAssetsToPool(assetAmount)`.
- `it("Strategist should fail to add too much asset token to the pool")` — assertions: strategist `swapAssetsToPool(excessiveSwapAssetsToPool)` reverts with "Assets overshot peg" (swap would push the pool past balanced in the other direction).
- `it("Strategist should fail to add zero asset token to the pool")` — assertions: strategist `swapAssetsToPool(0)` reverts with "Must swap something".
- `it("Strategist should fail to add more OToken to the pool")` — assertions: strategist `swapOTokensToPool(disallowedSwapOTokensToPool)` reverts with "OTokens balance worse".

**describe: "ForkTest: Algebra AMO Strategy" > "with a lot more asset token in the pool"** (fixture: `assetMintAmount = smallAssetBootstrapIn`, `depositToStrategy: true`, `balancePool: true`, `poolAddAssetAmount = poolImbalance.lotMoreAsset.addAsset` — pool heavily asset-tilted)
- `it("Vault should fail to deposit asset token to strategy")` — assertions: `assertFailedDeposit(rebalanceProbe.lotMoreAsset.failedDepositAmount, "price out of range")`.
- `it("Vault should be able to withdraw all")` — assertions: full `assertWithdrawAll()` accounting.
- `it("Vault should be able to partially withdraw")` — assertions: full `assertWithdrawPartial(partialWithdrawAmount)` accounting.
- `it("Strategist should swap a little OToken to the pool")` — assertions: full `assertSwapOTokensToPool(smallSwapOTokensToPool)` (`SwapOTokensToPool` event with `oTokenMinted` == requested, vault asset balance unchanged, no residual LP/OToken on strategy).
- `it("Strategist should swap a lot of OToken to the pool")` — assertions: full `assertSwapOTokensToPool(largeSwapOTokensToPool)`.
- `it("Strategist should get the pool close to balanced")` — setup: oTokenAmount = 32% of the pool's asset excess; assertions: full `assertSwapOTokensToPool(oTokenAmount)`.
- `it("Strategist should fail to add so much OToken that it overshoots")` — assertions: strategist `swapOTokensToPool(overshootSwapOTokensToPool)` reverts with "OTokens overshot peg".
- `it("Strategist should fail to add more asset token to the pool")` — assertions: strategist `swapAssetsToPool(disallowedSwapAssetsToPool)` reverts with "Assets balance worse".

**describe: "ForkTest: Algebra AMO Strategy" > "with a little more asset token in the pool"** (fixture: `assetMintAmount = mediumAssetBootstrapIn`, `depositToStrategy: true`, `balancePool: true`, `poolAddAssetAmount = poolImbalance.littleMoreAsset.addAsset`)
- `it("Vault should deposit asset token to AMO strategy")` — assertions: full `assertDeposit(rebalanceProbe.littleMoreAsset.depositAmount)` accounting.
- `it("Vault should be able to withdraw all")` — assertions: full `assertWithdrawAll()` accounting.
- `it("Vault should be able to partially withdraw")` — assertions: full `assertWithdrawPartial(partialWithdrawAmount)` accounting.
- `it("Strategist should swap a little OToken to the pool")` — assertions: full `assertSwapOTokensToPool(smallSwapOTokensToPool)`.
- `it("Strategist should get the pool close to balanced")` — setup: oTokenAmount = 50% of the pool's asset excess; assertions: full `assertSwapOTokensToPool(oTokenAmount)`.
- `it("Strategist should fail to add zero OToken to the pool")` — assertions: strategist `swapOTokensToPool(0)` reverts with "Must swap something".
- `it("Strategist should fail to add too much OToken to the pool")` — assertions: strategist `swapOTokensToPool(overshootSwapOTokensToPool)` reverts with "OTokens overshot peg".
- `it("Strategist should fail to add more asset token to the pool")` — assertions: strategist `swapAssetsToPool(disallowedSwapAssetsToPool)` reverts with "Assets balance worse".

**describe: "ForkTest: Algebra AMO Strategy" > "with the strategy owning a small percentage of the pool"** (beforeEach: fixture with `smallAssetBootstrapIn` + deposit + balanced pool; then nick swaps `smallPoolShare.bootstrapAssetSwapIn` asset into the pool to acquire OToken, keeps a `smallPoolShare.oTokenBuffer` OToken buffer aside — asserted > 0 remaining for the pool — and adds `smallPoolShare.bigLiquidityAsset` asset plus the remaining OToken as third-party liquidity via `pool.mint(nick)`, so the strategy owns only a small pool share; snapshots `dataBefore`)
- `it("A lot of OToken is swapped into the pool")` — scenario: nick swaps `stressSwapOToken` OToken in (asset out); assertions: strategy `checkBalance(asset)` stays within `[before, before+1 wei]`; then nick swaps `stressSwapAsset` asset in (OToken out); `checkBalance` stays within `[before, before+2 wei]` — i.e. large third-party swaps cannot move the strategy's reported balance by more than rounding dust.
- `it("A lot of asset token is swapped into the pool")` — scenario: nick swaps `stressSwapAssetAlt` asset in; assertions: `checkBalance` within `[before, before+3 wei]`; then swaps `stressSwapOToken` OToken in; `checkBalance` still within `[before, before+3 wei]`.

**describe: "ForkTest: Algebra AMO Strategy" > "with an insolvent vault"** (beforeEach: fixture with `largeAssetBootstrapIn`, no strategy deposit; vaultSigner then deposits `mintValues.extraSmallPlus` asset to the strategy; then transfers 0.21% (21bp) of `vault.totalValue()` asset token to `addresses.dead`, pushing the protocol below the 0.998 `SOLVENCY_THRESHOLD`; asserts the vault held enough asset token to burn that loss)
- `it("Should fail to deposit")` — assertions: after transferring `mintValues.extraSmall` asset to the strategy, vaultSigner `deposit(asset, amount)` reverts with "Protocol insolvent".
- `it("Should fail to withdraw")` — assertions: vaultSigner `withdraw(vault, asset, mintValues.extraSmall)` reverts with "Protocol insolvent".
- `it("Should withdraw all")` — assertions: vaultSigner `withdrawAll()` does NOT revert with "Protocol insolvent" (full emergency exit remains possible while insolvent).
- `it("Should fail to swap assets to the pool")` — assertions: strategist `swapAssetsToPool(mintValues.extraSmall)` reverts with "Protocol insolvent".
- `it("Should fail to swap OToken to the pool")` — assertions: strategist `swapOTokensToPool(insolvent.swapOTokensToPool)` reverts with "Protocol insolvent".

No `it.skip`/`xit`/commented-out tests in this file.

### `test/strategies/base/oethb-hydrex-amo.base.fork-test.js` — fork test (Base)

Context: fixture `oethbHydrexAMOFixture` from `test/_fixture-base.js` via `createFixtureLoader`; contracts under test: `OETHbHydrexAMOStrategy` (behind `OETHbHydrexAMOProxy`, deployed and wired by deploy script `deploy/base/048_oethb_hydrex_amo`), the Hydrex superOETHb/WETH pool (`IPair`) + gauge (`IGauge`, rewards in oHYDX), the OETHb Vault, and the OETHBase Harvester. The fixture seeds the near-empty Hydrex pool with 150 WETH + 150 OETHb if needed and impersonates the vault as `oethbVaultSigner`.

**describe: "Base Fork Test: OETHb Hydrex AMO Strategy" > "deploy script wires the strategy correctly"** (uses a single `before` hook loading `oethbHydrexAMOFixture` with default options; explicitly verifies the 048 deploy script bring-up so regressions fail loudly rather than as downstream behaviour-suite failures)
- `it("Strategy.pool() matches addresses.base.HydrexOETHb_WETH.pool")` — assertions: `fixture.hydrexPool.address` (which the fixture reads from `strategy.pool()`) equals `addresses.base.HydrexOETHb_WETH.pool` (case-insensitive compare).
- `it("Strategy.gauge() is non-zero")` — assertions: `fixture.hydrexGauge.address` (from `strategy.gauge()`) is not the zero address.
- `it("Strategy.harvesterAddress() is the OETHBase harvester")` — assertions: `strategy.harvesterAddress()` equals `fixture.harvester.address`.
- `it("OETHBase Vault has approved the strategy")` — assertions: `oethbVault.strategies(strategy).isSupported == true`.
- `it("OETHBase Vault has the strategy on the mint whitelist")` — assertions: `oethbVault.isMintWhitelistedStrategy(strategy) == true`.
- `it("Harvester has the strategy marked as supported")` — assertions: `harvester.supportedStrategies(strategy) == true`.

**Consumes shared behaviour suite:** calls `shouldBehaveLikeAlgebraAmoStrategy(contextFn)` (all 69 suite tests above run on the Base fork). The context function supplies:
- `scenarioConfig` overrides tuned ~5-10x smaller than the mainnet/Sonic defaults because the superOETHb/WETH pool bootstrap is much smaller (ratios preserved so every behavioural branch still fires): `attackerFrontRun` {moderateAssetIn: "5", largeAssetIn/largeOTokenIn: "1000"}; `bootstrapPool` {small "10", medium "50", large "50000"}; `mintValues` unchanged {0.1/0.2/1/2}; `poolImbalance` {lotMoreOToken.addOToken: 100, littleMoreOToken.addOToken: 1, lotMoreAsset.addAsset: 100, littleMoreAsset.addAsset: 1}; `smallPoolShare` {bootstrapAssetSwapIn: "20", bigLiquidityAsset: "10", oTokenBuffer: "20", stressSwapOToken: "8", stressSwapAsset: "12", stressSwapAssetAlt: "8"}; `rebalanceProbe` per-regime amounts (e.g. frontRun.depositAmount "50", frontRun.tiltSeedWithdrawAmount "15", lotMoreOToken.excessiveSwapAssetsToPool "500", lotMoreAsset.overshootSwapOTokensToPool "90"); `insolvent.swapOTokensToPool: "0.1"`; and `harvest.collectedBy: "harvester"` (so the rewards test harvests via `harvester.harvestAndTransfer` instead of the strategist).
- `loadFixture` mapping the suite's generic options to `oethbHydrexAMOFixture` (`poolAddAssetAmount` → `poolAddWethAmount`, `poolAddOTokenAmount` → `poolAddOethAmount`) and returning: `assetToken` = WETH, `oToken` = OETHb (superOETHb), `rewardToken` = oHYDX, `amoStrategy` = hydrexAMOStrategy, `pool` = hydrexPool, `gauge` = hydrexGauge, `governor`/`timelock` = Base timelock, `strategist`, `nick`, `oTokenPoolIndex` computed from `pool.token0() == oethb`, `vaultSigner` = impersonated OETHb Vault, `vault` = oethbVault, `harvester`.

No `it.skip`/`xit`/commented-out tests in this file.

Total `it()` blocks documented: 75 (69 in the behaviour suite + 6 Hydrex-specific deploy-wiring tests; the 69 suite tests additionally execute once per consumer: Base Hydrex and Sonic SwapX).

---

## Aerodrome AMO + Base Curve AMO (Base fork)

Fork tests for the two OETHb (Super OETH) AMO strategies on Base: the Aerodrome Slipstream concentrated-liquidity AMO (`AerodromeAMOStrategy` behind `AerodromeAMOStrategyProxy`, with a locally deployed `AerodromeAMOQuoter` helper used to compute swap amounts) and the Curve StableSwap AMO (`BaseCurveAMOStrategy` behind `OETHBaseCurveAMOProxy`, against the real OETHb/WETH Curve pool + child gauge). Both use `defaultBaseFixture` from `test/_fixture-base.js` via `createFixtureLoader` and exercise deposit/withdraw/rebalance/peg-management paths against real on-chain Base state, plus revert paths (access control, insolvency, peg overshoot). Files covered:

- `test/strategies/base/aerodrome-amo.base.fork-test.js`
- `test/strategies/base/curve-amo.base.fork-test.js`

### `test/strategies/base/aerodrome-amo.base.fork-test.js` — fork test (Base)

Context: `defaultBaseFixture`; contracts under test: `AerodromeAMOStrategy` (via proxy), OETHb Vault, OETHb token, Aerodrome CL pool/swap router/NFT position manager/CL gauge, `SuperOETHHarvester`, locally deployed `AerodromeAMOQuoter` (fixture deploys it pointing at the strategy and Aerodrome QuoterV2). Two top-level describes with different setups.

Shared helpers (needed to understand assertions):
- `swap({amount, swapWeth})` — pushes the pool price via `aeroSwapRouter.exactInputSingle` as user rafael (mints OETHb from the vault first if rafael lacks balance); price limit at tick ±1000.
- `quoteAmountToSwapToReachPrice({price})` — calls the quoter, reads `value`/`swapWETHForOETHB`/`sqrtPriceAfterX96` from the emitted event.
- `quoteAmountToSwapBeforeRebalance({lowValue, highValue})` (main describe only) — takes a node snapshot, temporarily transfers strategy governance to the quoter helper so the quoter can simulate `rebalance`, reads swap `value`+`direction` from the event, then reverts the snapshot.
- `rebalance(amountToSwap, swapWETH, minTokenReceived)` — strategist calls `aerodromeAmoStrategy.rebalance(...)`.
- `mintAndDepositToStrategy({amount=5 WETH})` — funds user with WETH, mints OETHb via vault, governor calls `vault.depositToStrategy(strategy, [weth], [available amount])` (capped by vault WETH minus outstanding withdrawal queue); unless `returnTransaction`, asserts the deposit tx emits `PoolRebalanced` on the strategy.
- `verifyEndConditions(lpStaked = true)` — asserts the strategy's LP NFT (`tokenId()`) is owned by the CL gauge (or by the strategy itself when `lpStaked=false`), strategy WETH balance ≤ 0.00001e18, strategy OETHb balance == 0.
- `depositLiquidityToPool()` — mints 200 OETHb via the vault and creates two NFT liquidity positions outside the AMO's active tick (ticks [-3,-1] and [0,3], 100/100 desired each) so fail states can be reached.

**describe: "Base Fork Test: Aerodrome AMO Strategy empty pool setup (Base)"** — beforeEach loads the fixture, then `setupEmpty()`: impersonates `0x...dead` and calls `decreaseLiquidity` on NFT position id 413296 to remove its entire liquidity (emptying the AMO pool), then approves the swap router for rafael.

- `it("Revert when there is no token id yet and no liquidity to perform the swap.")` (skipped, `it.skip`; comment: no way to test this in the strategy contract yet) — would mint 5 OETHb, governor `depositToStrategy` 5 WETH, then expect strategist `rebalance(0.001e18, false, 0.0008e18)` to revert with `"Can not rebalance empty pool"`.
- `it("Should be reverted trying to rebalance and we are not in the correct tick, below")` (skipped, `it.skip`) — after `depositLiquidityToPool()`, quotes and swaps to push the pool price to the sqrt ratio at tick -2 (fetched from the Sugar helper), asserts `getPoolX96Price()` ≈ that price (approxEqualTolerance), then expects strategist `rebalance(0, direction, 0)` to revert with custom error `OutsideExpectedTickRange(int24)`.
- `it("Should be reverted trying to rebalance and we are not in the correct tick, above")` — after `depositLiquidityToPool()`, quotes and swaps to push the pool price to the sqrt ratio at tick +1; asserts `getPoolX96Price()` ≈ price-at-tick-1 (approxEqualTolerance); expects strategist `rebalance(0, direction, 0)` to revert with custom error `OutsideExpectedTickRange(int24)`.

**describe: "ForkTest: Aerodrome AMO Strategy (Base)"** — beforeEach loads the fixture, impersonates the vault as signer, then runs `setup()`: deposits 5 WETH to the strategy and performs a quoter-guided `rebalance` to move the pool to the pre-configured ~20% WETH share (80:20 OETHb:WETH). If the quoter binary search throws "Out of iterations" on the current fork state, the whole test is skipped via `this.skip()`.

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "ForkTest: Initial state (Base)"**

- `it("Should have the correct initial state")` — asserts `allowedWethShareStart() == 0.010000001e18`, `allowedWethShareEnd() == 0.15e18`, `harvesterAddress()` == fixture harvester address; then `verifyEndConditions()` (LP NFT staked in gauge, ≤1e13 wei WETH and 0 OETHb on strategy).
- `it("Can safe approve all tokens")` — impersonates the strategy address to zero out WETH & OETHb approvals to the NFT manager and swap router, then the governor calls `safeApproveAllTokens()`; asserts only that nothing reverts (no explicit expects).
- `it("Should revert setting ptoken address")` — governor `setPTokenAddress(weth, aero)` reverts with `"Unsupported method"`.
- `it("Should revert setting ptoken address")` (duplicate test name; this one targets `removePToken`) — governor `removePToken(weth)` reverts with `"Unsupported method"`.

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "Configuration"**

- `it("Governor can set the allowed pool weth share interval")` — governor calls `setAllowedPoolWethShareInterval(0.19e18, 0.23e18)`; asserts `allowedWethShareStart() == 0.19e18` and `allowedWethShareEnd() == 0.23e18`.
- `it("Only the governor can set the pool weth share")` — rafael calling `setAllowedPoolWethShareInterval(0.19e18, 0.23e18)` reverts with `"Caller is not the Governor"`.
- `it("Can not set incorrect pool WETH share intervals")` — three governor calls revert: `(0.5, 0.4)` → `"Invalid interval"` (start > end); `(0.0001, 0.5)` → `"Invalid interval start"` (too low); `(0.2, 0.96)` → `"Invalid interval end"` (too high).

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "Harvest rewards"**

- `it("Should be able to collect reward tokens")` — seeds the strategy with 1337 AERO via `setERC20TokenBalance`; strategist calls `harvester["harvestAndTransfer(address)"](strategy)`; asserts strategist's AERO balance increase ≥ 1337e18 (gte because gauge rewards may have accrued on top); `verifyEndConditions()`.

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "Withdraw"** (all use the impersonated vault signer)

- `it("Should allow withdraw when the pool is 80:20 balanced")` — `withdraw(vault, weth, 1e18)`; asserts position WETH principal decreased ≈1 WETH and OETHb principal decreased ≈4 OETHb (tolerance 3%, matching the 80:20 ratio); `getPoolX96Price()` exactly unchanged (no price movement); vault WETH balance increased by exactly 1e18; residual WETH on the strategy ≤ 1e6 wei (long comment explains the `shareOfWetToRemove` round-up × `_getLiquidity()` amplification bound); `verifyEndConditions()`.
- `it("Should allow withdrawAll when the pool is 80:20 balanced")` — `withdrawAll()`; asserts both position principals == 0; vault WETH ≈ before + previous WETH principal; `oethb.totalSupply()` decreased by exactly the previous OETHb principal (burned); strategy WETH balance == 0; LP NFT is NOT staked (owner is the strategy, via `assetLpNOTStakedInGauge`).
- `it("Should withdraw when there's little WETH in the pool")` — first swaps 3.5 OETHb→WETH to drain most of the pool's ~5 WETH; then `withdraw(vault, weth, 1e18)`; asserts WETH principal decreased ≈1 WETH; the OETHb/WETH principal ratio is preserved (approx); vault WETH ≈ before + 1e18; residual strategy WETH ≤ 1e6 wei; `verifyEndConditions()`.
- `it("Should withdrawAll when there's little WETH in the pool")` — same 3.5 OETHb→WETH drain, then `withdrawAll()`; vault WETH ≈ before + previous WETH principal; strategy WETH == 0; `verifyEndConditions(false)` (LP not staked).
- `it("Should withdraw when there's little OETHb in the pool")` — swaps 3.5 WETH→OETHb to drain OETHb; `withdraw(vault, weth, 1e18)`; asserts WETH principal −≈1, principal ratio preserved, vault WETH +≈1e18, residual strategy WETH ≤ 1e6 wei; `verifyEndConditions()`.
- `it("Should withdrawAll when there's little OETHb in the pool")` — despite the name, the swap drains WETH again (`swapWeth: false`, 3.5); `withdrawAll()`; vault WETH ≈ before + WETH principal; strategy WETH == 0; `verifyEndConditions(false)`.

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "Deposit and rebalance"**

- `it("Should be able to deposit to the strategy")` — `mintAndDepositToStrategy()` (5 WETH); the helper asserts the `depositToStrategy` tx emits `PoolRebalanced` on the strategy; `verifyEndConditions()`.
- `it("Should revert when not depositing WETH or amount is 0")` — vault-signer `deposit(aero, 1)` reverts `"Unsupported asset"`; `deposit(weth, 0)` reverts `"Must deposit something"`.
- `it("Should be able to deposit to the pool & rebalance")` — deposits 5 WETH, gets a quote (default target share), calls `rebalance(value, direction, 99% of value)`; asserts the tx emits `PoolRebalanced`; `verifyEndConditions()`.
- `it("Should be able to deposit to the pool & rebalance multiple times")` — does the quoted deposit+rebalance (expects `PoolRebalanced`, `verifyEndConditions()`), then deposits another 5 WETH and calls `rebalance(0, true, 0)` (add-liquidity-only); asserts that tx also emits `PoolRebalanced`; `verifyEndConditions()` again.
- `it("Should check that add liquidity in difference cases leaves no to little weth on the contract")` — mints 5 OETHb, governor `depositToStrategy` of 5 WETH; asserts strategy WETH balance ≤ 0; `verifyEndConditions()`.
- `it("Should revert when there is not enough WETH to perform a swap")` — swaps 5 OETHb→WETH first; then `rebalance(1e9 ether, swapWETH=true, min 0.009e18)` reverts with custom error `NotEnoughWethLiquidity(uint256,uint256)`.
- `it("Should revert when pool rebalance is off target")` — quotes a swap that would push the WETH share to 0.90–0.92 (outside the allowed 0.010000001–0.15 interval); `rebalance(value, direction, 0)` reverts with custom error `PoolRebalanceOutOfBounds(uint256,uint256,uint256)`.
- `it("Should be able to rebalance the pool when price pushed very close to 1:1")` — `depositLiquidityToPool()` (outside-tick liquidity) + deposits 1 WETH; pushes the pool price to `sqrtRatioX96TickHigher − 1%` of the tick price width via quoter+swap; then quoted `rebalance(value, direction, 99% of value)` succeeds; `verifyEndConditions()`.
- `it("Should be able to rebalance the pool when price pushed to over the 1 OETHb costing 1.0001 WETH")` — pushes the price to `sqrtRatioX96TickLower + 5%` of the tick width (variable div(20)); quoted `rebalance(value, direction, 99% min)` succeeds; `verifyEndConditions()`.
- `it("Should be able to rebalance the pool when price pushed to close to the 1 OETHb costing 1.0001 WETH")` — pushes the price to `sqrtRatioX96TickLower − 5%` of the tick width (below the tick range); quoted `rebalance(value, direction, 99% min)` succeeds; `verifyEndConditions()`.
- `it("Should have the correct balance within some tolerance")` — records `checkBalance(weth)`, deposits 6 WETH, then `rebalance(0, true, 0)` (just add liquidity, no price move); asserts new `checkBalance(weth)` ≈ old + 6×4 = +24e18 with 1.5% tolerance (deposited WETH plus the ~4x matching OETHb the AMO mints at the 80:20 share); `verifyEndConditions()`.
- `it("Should revert on non WETH balance")` — `checkBalance(aero)` reverts with `"Only WETH supported"`.
- `it("Should throw an exception if not enough WETH on rebalance to perform a swap")` — swaps 4.99 OETHb→WETH to drain the pool's ~5 WETH; `rebalance(2 × pool's WETH balance, true, 4e18)` reverts with custom error `NotEnoughWethLiquidity(uint256,uint256)`; `verifyEndConditions()`.
- `it("Should not be able to rebalance when protocol is insolvent")` — deposits 1000 WETH then vault-signer `withdrawAll()`; deposits 1 WETH so an LP position exists; makes the protocol insolvent by having the vault signer transfer WETH out (0.00001 + 1 WETH to the strategy, the entire remaining vault WETH to `addresses.dead`); `rebalance(0.00001e18, true, 0.000009e18)` reverts with `"Protocol insolvent"`; asserts LP NFT still staked in gauge.

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "Perform multiple actions"**

- `it("LP token should stay staked with multiple deposit/withdraw actions")` — long sequence, each step verified: deposit 5 WETH + `rebalance(0.00001, true, 0.000009)` → emits `PoolRebalanced`, `verifyEndConditions()`; deposit 5 + `rebalance(0, true, 0)` → emits `PoolRebalanced`, verify; vault-signer `withdraw(vault, weth, 1e18)` → verify; deposit 5 + `rebalance(0, true, 0)` → emits `PoolRebalanced`, verify; `withdraw` 1 WETH → verify; `withdrawAll()` → asserts LP NFT NOT staked (owned by strategy); final deposit 5 + `rebalance(0, true, 0)` → emits `PoolRebalanced`, `verifyEndConditions()` (staked again).

**describe: "ForkTest: Aerodrome AMO Strategy (Base)" > "Deposit and rebalance with mocked Vault"** — nested describe with its own beforeEach (reloads fixture + `setup()`, no skip-guard). Local helpers: `getWethAvailable()` = vault WETH balance minus outstanding withdrawal-queue amount (queued − claimed); `depositAllWethAndConfigure1Bp()` = set vaultBuffer to 0, transfer the outstanding-queue WETH into the vault from clement, governor-deposit all available WETH to the strategy (expects `PoolRebalanced`), then set vaultBuffer to 1bp (0.0001e18) and return `minAmountReserved = totalValue × buffer` (the mint size that triggers auto-allocation).

- `it("Should not automatically deposit to strategy when below vault buffer threshold")` — after `depositAllWethAndConfigure1Bp()`, mints `minAmountReserved/2` OETHb; asserts strategy WETH balance == 0 (no auto-deposit happened) and `getWethAvailable()` ≈ the minted amount (stayed in the vault); `verifyEndConditions()`.
- `it("Should deposit amount above the vault buffer threshold to the strategy on mint")` — mints `2 × minAmountReserved`; asserts strategy WETH balance == 0 (auto-deposited amount was fully deployed into the pool) and `getWethAvailable()` ≈ `minAmountReserved` (only the buffer stays in the vault); `verifyEndConditions()`.
- `it("Should leave WETH on the contract when pool price outside allowed limits")` — pushes the pool price to `sqrtRatioX96TickLower` (1 OETHb costs 1.0001 WETH) via quoter+swap, then mints `2 × minAmountReserved`; asserts ≈`minAmountReserved` WETH sits idle on the strategy contract (deposit accepted but not deployed because price is out of bounds) and ≈`minAmountReserved` remains available in the vault; asserts LP NFT staked in gauge.

### `test/strategies/base/curve-amo.base.fork-test.js` — fork test (Base)

Context: `defaultBaseFixture`; contract under test: `BaseCurveAMOStrategy` (`OETHBaseCurveAMOProxy`) against the real Curve OETHb/WETH StableSwap pool (`addresses.base.OETHb_WETH.pool`) and child liquidity gauge, with OETHb Vault, CRV, and `SuperOETHHarvester`. beforeEach: impersonates vault/strategist/harvester/gauge-factory/AMO-governor/timelock/strategy signers; timelock sets `vaultBuffer` to 100% (1e18, so mints never auto-allocate); AMO governor sets the harvester address on the strategy; vault-signer `withdrawAll()` empties the strategy; then nick mints enough WETH via the vault to cover any withdrawal-queue shortfall so `depositToStrategy` won't revert with "Not enough assets available". `defaultDeposit = 5e18`.

Helpers: `mintAndDepositToStrategy({amount=5})` — mints OETHb from WETH, governor `depositToStrategy(strategy, [weth], [amount])`, and (unless `returnTransaction`) asserts the tx emits `Deposit` on the strategy; `balancePool()` — one-sidedly adds WETH or OETHb liquidity so pool balances are ≈ equal (asserted with approxEqualTolerance); `unbalancePool({wethbAmount | oethbAmount, balancedBefore})` — adds one-sided liquidity (mints OETHb via the vault for the OETHb side); `simulateCRVInflation({amount, timejump, checkpoint})` — sets the gauge's CRV balance via `setERC20TokenBalance`, advances time, optionally calls `user_checkpoint(strategy)` as the impersonated gauge factory.

**describe: "Base Fork Test: Curve AMO strategy" > "Initial parameters"**

- `it("Should have correct parameters after deployment")` — asserts `platformAddress()`, `curvePool()`, and `lpToken()` all == `addresses.base.OETHb_WETH.pool`; `vaultAddress()` == OETHb vault; `gauge()` == `addresses.base.OETHb_WETH.gauge`; `oeth()` == oethb; `weth()` == weth; `governor()` == `addresses.base.timelock`; `rewardTokenAddresses(0)` == `addresses.base.CRV`; `maxSlippage()` == 0.002e18.
- `it("Should deposit to strategy")` — after `balancePool()` + deposit of 5 WETH: `checkBalance(weth)` increased ≈ 2×5 = 10e18 (AMO mints matching OETHb into the pool); gauge LP balance of the strategy increased ≈10e18; depositor holds exactly 5e18 OETHb (from the vault mint); strategy WETH balance == 0.
- `it("Should deposit all to strategy")` — transfers 5 WETH directly to the strategy contract, asserts strategy WETH > 0, then vault-signer `depositAll()`; `checkBalance(weth)` +≈10e18; gauge balance +≈10e18; strategy WETH == 0.
- `it("Should deposit all to strategy with no balance")` — with strategy WETH == 0 (asserted), vault-signer `depositAll()` is a no-op: `checkBalance(weth)` delta == 0 and gauge balance delta == 0 (exact equality).
- `it("Should withdraw from strategy")` — after balance+deposit, vault-signer `withdraw(vault, weth, 1e18)`; `checkBalance(weth)` decreased ≈ 2e18 (burns matching OETHb too); gauge balance decreased ≈2e18; strategy OETHb == 0 and WETH == 0.
- `it("Should withdraw all from strategy")` — after balance+deposit, vault-signer `withdrawAll()`; `checkBalance(weth)` ≈ 0; gauge balance ≈ 0; strategy OETHb == 0 and WETH == 0; vault WETH balance ≈ before + 5e18 (the deposited WETH returned).
- `it("Should mintAndAddOToken")` — pool balanced then skewed with +10 WETH; strategist `mintAndAddOTokens(5e18)`; `checkBalance(weth)` +≈5e18; gauge balance +≈5e18; strategy OETHb == 0 and WETH == 0.
- `it("Should removeAndBurnOToken")` — balance pool, deposit 10 WETH, skew with +10 OETHb; strategist `removeAndBurnOTokens(5e18)`; `checkBalance(weth)` −≈5e18; gauge balance −≈5e18; strategy OETHb == 0 and WETH == 0.
- `it("Should removeOnlyAssets")` — balance pool, deposit 10 WETH, skew with +10 WETH; strategist `removeOnlyAssets(5e18)`; `checkBalance(weth)` −≈5e18; gauge balance −≈5e18; vault WETH balance ≈ before + 5e18.
- `it("Should collectRewardTokens")` — deposit, then `simulateCRVInflation(1,000,000 CRV, 60s, checkpoint=true)`; harvester-signer `collectRewardTokens()`; asserts harvester CRV balance strictly increased and gauge CRV balance == 0 (all claimed/forwarded).
- `it("Should deposit when pool is heavily unbalanced with OETH")` — skew pool with +15 OETHb (3×deposit); deposit 5 WETH; `checkBalance(weth)` ≈ before + 10e18 (2×deposit); gauge balance ≈ before + 10e18; strategy WETH == 0.
- `it("Should deposit when pool is heavily unbalanced with WETH")` — skew pool with +50 WETH (10×deposit); deposit 5 WETH; `checkBalance(weth)` ≈ before + 15e18 (3×deposit — AMO adds extra OETHb when the pool is WETH-heavy); gauge balance ≈ before + 15e18; strategy WETH == 0.
- `it("Should withdraw all when pool is heavily unbalanced with OETH")` — balance+deposit, skew with +5000 OETHb (1000×deposit); vault-signer `withdrawAll()`; `checkBalance(weth)` ≈ 0; gauge balance ≈ 0; strategy OETHb == 0 and WETH == 0; vault WETH ≈ before + the strategy's pre-withdraw `checkBalance` (full value recovered despite the skew).
- `it("Should withdraw all when pool is heavily unbalanced with WETH")` — identical but skewed with +5000 WETH; same five assertions.
- `it("Should set max slippage")` — AMO governor `setMaxSlippage(0.01456e18)`; `maxSlippage()` returns 0.01456e18.

**describe: "Base Fork Test: Curve AMO strategy" > "Should revert when"**

- `it("Deposit: Must deposit something")` — vault-signer `deposit(weth, 0)` reverts `"Must deposit something"`.
- `it("Deposit: Can only deposit WETH")` — vault-signer `deposit(oethb, 5e18)` reverts `"Can only deposit WETH"`.
- `it("Deposit: Caller is not the Vault")` — strategist calling `deposit(weth, 5e18)` reverts `"Caller is not the Vault"`.
- `it("Deposit: Protocol is insolvent")` — after balance+deposit, cheats by having the impersonated strategy call `vault.mintForStrategy(1,000,000e18)` (unbacked OETHb supply); a subsequent `mintAndDepositToStrategy` reverts `"Protocol insolvent"`.
- `it("Withdraw: Must withdraw something")` — vault-signer `withdraw(vault, weth, 0)` reverts `"Must withdraw something"`.
- `it("Withdraw: Can only withdraw WETH")` — vault-signer `withdraw(vault, oethb, 5e18)` reverts `"Can only withdraw WETH"`.
- `it("Withdraw: Caller is not the vault")` — strategist calling `withdraw(vault, weth, 5e18)` reverts `"Caller is not the Vault"`.
- `it("Withdraw: Amount is greater than balance")` — vault-signer `withdraw(vault, weth, 1,000,000e18)` reverts with an empty reason string (`revertedWith("")`).
- `it("Withdraw: Protocol is insolvent")` — after balance + deposit of 10 WETH, mints 1,000,000 unbacked OETHb via `mintForStrategy` and transfers them from the strategy to the vault (so they aren't burned on withdrawal); vault-signer `withdraw(vault, weth, 5e18)` reverts `"Protocol insolvent"`.
- `it("Mint OToken: Asset overshot peg")` — balance+deposit, skew +5 WETH; strategist `mintAndAddOTokens(10e18)` (2×deposit, more than the WETH excess) reverts `"Assets overshot peg"`.
- `it("Mint OToken: OTokens balance worse")` — balance+deposit, skew +10 OETHb; strategist `mintAndAddOTokens(5e18)` reverts `"OTokens balance worse"`.
- `it("Mint OToken: Protocol insolvent")` — balance+deposit, `mintForStrategy(1,000,000e18)`; strategist `mintAndAddOTokens(5e18)` reverts `"Protocol insolvent"`.
- `it("Burn OToken: Asset balance worse")` — balance, deposit 10 WETH, skew +10 WETH; strategist `removeAndBurnOTokens(5e18)` reverts `"Assets balance worse"`.
- `it("Burn OToken: OTokens overshot peg")` — balance+deposit, skew +5 OETHb; strategist `removeAndBurnOTokens(5e18)` (equal to the OETHb excess, would overshoot) reverts `"OTokens overshot peg"`.
- `it("Burn OToken: Protocol insolvent")` — balance+deposit, `mintForStrategy(1,000,000e18)`; strategist `removeAndBurnOTokens(5e18)` reverts `"Protocol insolvent"`.
- `it("Remove only assets: Asset overshot peg")` — balance, deposit 10 WETH, skew +10 WETH; strategist `removeOnlyAssets(15e18)` (3×deposit, more than the WETH excess) reverts `"Assets overshot peg"`.
- `it("Remove only assets: OTokens balance worse")` — balance, deposit 10 WETH, skew +10 OETHb; strategist `removeOnlyAssets(5e18)` reverts `"OTokens balance worse"`.
- `it("Remove only assets: Protocol insolvent")` — balance, deposit 10 WETH, `mintForStrategy(1,000,000e18)`; strategist `removeOnlyAssets(5e18)` reverts `"Protocol insolvent"`.
- `it("Check balance: Unsupported asset")` — `checkBalance(oethb)` reverts `"Unsupported asset"`.
- `it("Max slippage is too high")` — AMO governor `setMaxSlippage(0.51e18)` reverts `"Slippage must be less than 100%"`.

**Consumed shared behaviour suites** (invoked at the top level of the main describe; see the referenced files for their individual it() blocks — not duplicated here):

- `shouldBehaveLikeGovernable` (`test/behaviour/governable.js`) with context `{...fixture, anna: rafael, josh: nick, matt: clement, usds: crv, strategy: curveAMOStrategy}` — governance transfer/claim tests against the Curve AMO strategy.
- `shouldBehaveLikeHarvestable` (`test/behaviour/harvestable.js`) with context `{...fixture, anna: rafael, strategy: curveAMOStrategy, harvester, oeth: oethb}` — harvester-config/collect-rewards access tests.
- `shouldBehaveLikeStrategy` (`test/behaviour/strategy.js`) with context `{...fixture, strategy: curveAMOStrategy, checkWithdrawAmounts: false, vault: oethbVault, assets: [weth], timelock, governor, strategist: rafael, harvester, weth, anna: rafael, matt: clement, josh: nick}` and all of `usdt/usdc/usds/reth/stETH/frxETH/cvx/comp/bal/ssv` mapped to `crv` (those tokens don't exist in the Base fixture) — the generic strategy behaviour suite (deposit/withdraw/withdrawAll access control, supported assets, token transfers).

Test counts: aerodrome file 35 it() blocks (2 skipped via `it.skip`), curve file 35 it() blocks directly in the file (plus the three referenced behaviour suites) — 70 total documented.

---

# 12 — Shared strategy behaviours, VaultValueChecker, Morpho V2, Bridged WOETH

## Shared strategy behaviours, VaultValueChecker, Morpho V2, Bridged WOETH

This section documents the four shared behavioural test suites under `test/behaviour/` (generic strategy CRUD/access-control, harvester reward-token config on fork, Governable two-step governance, and Harvestable reward collection) plus three standalone strategy test files: the `VaultValueChecker` unit tests (mainnet mocks), the Yearn Morpho OUSD v2 strategy mainnet fork tests, and the Bridged WOETH strategy on Base (both a Base unit-test file against mocks and a Base fork-test file against the real deployment). The behaviour suites take a `context()` factory returning a fixture augmented with `strategy`, `vault`, `harvester`, `assets`, etc., and are composed into strategy-specific test files.

Files covered:
- `test/behaviour/strategy.js` (behaviour suite, 25 tests)
- `test/behaviour/reward-tokens.fork.js` (behaviour suite, fork-only, 1 test)
- `test/behaviour/governable.js` (behaviour suite, 7 tests)
- `test/behaviour/harvestable.js` (behaviour suite, 4 tests)
- `test/strategies/vault-value-checker.js` (mainnet unit, 12 tests)
- `test/strategies/ousd-v2-morpho.mainnet.fork-test.js` (mainnet fork, 12 tests)
- `test/strategies/base/bridged-woeth-strategy.base.js` (Base unit, 14 tests)
- `test/strategies/base/bridged-woeth-strategy.base.fork-test.js` (Base fork, 3 tests)

### `test/behaviour/strategy.js` — behaviour suite (unit + fork consumers)

Exports `shouldBehaveLikeStrategy(context)`. `context()` must return a fixture plus: `strategy`, `assets` (tokens to test), optional `valueAssets` (assets valid for `checkBalance`/`withdraw`, defaults to `assets`), `vault`, `harvester`, optional `checkWithdrawAmounts`, optional `newBehavior` flag (upgraded strategies where strategist can set harvester), optional `beforeEach` hook (run first if provided). Vault/harvester signers are obtained via `impersonateAndFund`. Consumers (grep of `contracts/test`): `test/strategies/compoundingSSVStaking.js`, `test/strategies/nativeSSVStaking.js`, `test/strategies/curve-amo-oeth.mainnet.fork-test.js`, `test/strategies/curve-amo-ousd.mainnet.fork-test.js`, `test/strategies/base/curve-amo.base.fork-test.js`.

**describe: "Strategy behaviour"**
- `it("Should have vault configured")` — asserts `strategy.vaultAddress()` equals `vault.address`.
- `it("Should be a supported asset")` — for every token in `assets`, asserts `strategy.supportsAsset(asset)` is true.
- `it("Should NOT be a supported asset")` — for each of `usdt, usdc, usds, weth` not present in `assets`, asserts `strategy.supportsAsset()` is false (skips any that are in the supported list).
- `it("Should allow transfer of arbitrary token by Governor")` — funds strategy with 2 SSV via `setERC20TokenBalance`, governor calls `transferToken(ssv, 2e18)`; asserts SSV `Transfer` event with args (strategy, governor, 2e18), governor SSV balance increased by exactly the recovery amount, strategy SSV balance is 0.
- `it("Should not transfer supported assets from strategy")` — for every asset in `assets`, governor `transferToken(asset, 2e18)` reverts with `"Cannot transfer supported asset"`.
- `it("Should not allow transfer of arbitrary token by non-Governor")` — for signers [strategist, matt, impersonated harvester, impersonated vault], `transferToken(weth, 8e18)` reverts with `"Caller is not the Governor"`.
- `it("Should not allow transfer of supported token")` — governor `transferToken(assets[0], 8e18)` reverts with `"Cannot transfer supported asset"` (duplicate of the loop test but single-asset).
- `it("Should allow the harvester to be set by the governor")` — governor calls `setHarvesterAddress(random)`; asserts `HarvesterAddressesUpdated` event with args (old harvester, random) and `strategy.harvesterAddress()` == random.
- `it("Should not allow the harvester to be set by non-governor")` — branches on `newBehavior`: if true (upgraded contracts, strategist CAN set harvester), for [matt, random impersonated signer, vault signer] `setHarvesterAddress` reverts with `"Caller is not the Strategist or Governor"`; if false, for [strategist, matt, harvester signer, vault signer] it reverts with `"Caller is not the Governor"`.
- `it("Should allow reward tokens to be set by the governor")` — governor sets 3 random addresses via `setRewardTokenAddresses`; asserts `RewardTokenAddressesUpdated` event with args (old token array, new token array) and `rewardTokenAddresses(0..2)` return the three new addresses in order.
- `it("Should not allow reward tokens to be set by non-governor")` — for [strategist, matt, harvester signer, vault signer], `setRewardTokenAddresses([3 randoms])` reverts with `"Caller is not the Governor"`.

**describe: "Strategy behaviour" > "with no assets in the strategy"** (beforeEach: governor calls `strategy.withdrawAll()` to empty the strategy)
- `it("Should check asset balances")` — for each asset, asserts `checkBalance(asset)` == 0; also sends `checkBalance` as a real transaction (via `populateTransaction`) from josh so gas usage is reported.
- `it("Should be able to deposit each asset")` — for each asset: mints 1000 units directly into the strategy via `setERC20TokenBalance`, vault signer calls `deposit(asset, 1000)`; asserts `Deposit` event with args (asset, `assetToPToken(asset)` platform address, amount). Then for each of `valueAssets || assets` asserts `checkBalance(asset)` >= 1000 units (>= because AMOs add extra OTokens).
- `it("Should not allow deposit by non-vault")` — for [harvester signer, governor, strategist, matt], `deposit(assets[0], 10e18)` reverts with `"Caller is not the Vault"`.
- `it("Should be able to deposit all asset together")` — mints `1000 * (i+1)` units of each asset into the strategy, vault signer calls `depositAll()`; asserts one `Deposit` event per asset with args (asset, platform address, 1000*(i+1) units).
- `it("Should not be able to deposit zero asset amount")` — for each asset, vault signer `deposit(asset, 0)` reverts with `"Must deposit something"`.
- `it("Should not allow deposit all by non-vault")` — for [harvester signer, governor, strategist, matt], `depositAll()` reverts with `"Caller is not the Vault"`.
- `it("Should not be able to withdraw zero asset amount")` — for each asset, vault signer `withdraw(vault, asset, 0)` reverts with `"Must withdraw something"`.
- `it("Should not allow withdraw by non-vault")` — for [harvester signer, governor, strategist, matt], `withdraw(vault, assets[0], 1e18)` must revert; uses try/catch and asserts the error message is one of `"Caller is not the Vault"` or `"Caller not Vault or Registrator"` (full VM-exception strings).
- `it("Should be able to call withdraw all by vault")` — vault signer `withdrawAll()` succeeds and asserts NO `Withdrawal` event is emitted (nothing to withdraw).
- `it("Should be able to call withdraw all by governor")` — same as above from governor: succeeds, no `Withdrawal` event.
- `it("Should not allow withdraw all by non-vault or non-governor")` — for [harvester signer, strategist, matt], `withdrawAll()` reverts with `"Caller is not the Vault or Governor"`.

**describe: "Strategy behaviour" > "with assets in the strategy"** (beforeEach: mints `10000 * (i+1)` units of each asset into the strategy via `setERC20TokenBalance`, then vault signer `depositAll()`)
- `it("Should check asset balances")` — for each of `valueAssets || assets`, asserts `checkBalance(asset)` > 0; also sends `checkBalance` as a transaction from josh for gas reporting.
- `it("Should be able to withdraw each asset to the vault")` — for each withdraw asset (i-th), vault signer calls `withdraw(vault, asset, 8000*(i+1) units)`; asserts strategy `Withdrawal` event with args (asset, platform address, amount) and an ERC-20 `Transfer` event with named args `{to: vault, value: amount}` (named args because WETH names differ; the transfer may come from the platform rather than the strategy).
- `it("Should be able to withdraw all assets")` — vault signer `withdrawAll()`; for each withdraw asset: if the strategy is the fixture's `curveAMOStrategy`, only asserts that a `Withdrawal` and a `Transfer` event were emitted (no args); otherwise asserts `Withdrawal` with args (asset, platform address, 10000*(i+1) units) and asset `Transfer` with args (strategy, vault, 10000*(i+1) units).

### `test/behaviour/reward-tokens.fork.js` — behaviour suite (fork-only, mainnet)

Exports `shouldHaveRewardTokensConfigured(context)`; returns immediately (registers nothing) when `!isFork`. `context()` must return `harvester`, `vault`, `expectedConfigs` (map reward-token address → expected Harvester config), optional `ignoreTokens` (lowercased addresses treated as pre-checked). Consumer: `test/vault/vault.mainnet.fork-test.js` (called with the OUSD vault/harvester and expected CRV/CVX Uniswap V3 configs).

**describe: "Reward Tokens"**
- `it("Should have swap config for all reward tokens from strategies")` — one large aggregate assertion: fetches `vault.getAllStrategies()`, drops strategies whose `harvesterAddress()` is `addresses.multichainStrategist`; for every remaining strategy with a non-empty `getRewardTokenAddresses()` (explicitly skipping the Morpho OUSD v2 strategy proxy, which is harvested by the Buy Back Operator): asserts `harvester.supportedStrategies(strategy)` is true; then for each reward token not in `ignoreTokens`/already checked, reads `harvester.rewardTokenConfigs(token)` and asserts: `swapPlatformAddr != address(0)` (message "Harvester not configured for token: X"), `doSwapRewardToken == true` (message "Swap disabled for token: X"), and equality with the expected config for `swapPlatform`, `swapPlatformAddr`, `harvestRewardBps`, `allowedSlippageBps`, `liquidationLimit`. Depending on `swapPlatform` it additionally asserts the route data: 0 → `uniswapV2Path`, 1 → `uniswapV3Path`, 2 → `balancerPoolId`, 3 → Curve `curvePoolIndices` (both reward-token and base-token indices as BigNumbers). Finally asserts every key of `expectedConfigs` was actually visited (`missingTokenConfigs.length == 0`, message listing missing tokens). Note: an early `return` inside the token loop (instead of `continue`) means hitting an ignored token silently ends the whole check.

### `test/behaviour/governable.js` — behaviour suite (unit + fork consumers)

Exports `shouldBehaveLikeGovernable(context)`; `context()` returns a fixture plus `strategy` (any Governable contract). Tests the two-step transfer/claim governance pattern. Consumers: `test/strategies/compoundingSSVStaking.js`, `test/strategies/nativeSSVStaking.js`, `test/strategies/curve-amo-oeth.mainnet.fork-test.js`, `test/strategies/curve-amo-ousd.mainnet.fork-test.js`, `test/strategies/base/curve-amo.base.fork-test.js`.

**describe: "Governable behaviour"**
- `it("Should have governor set")` — asserts `strategy.governor()` == fixture governor address.
- `it("Should detect if governor set or not")` — asserts `isGovernor()` returns true when called by governor and false for [strategist, anna].
- `it("Should not allow transfer of arbitrary token by non-Governor")` — for [strategist, anna], `transferToken(usds, 800e18)` reverts with `"Caller is not the Governor"`.
- `it("Should allow governor to transfer governance")` — governor calls `transferGovernance(anna)`; asserts `governor()` is unchanged (pending claim), then anna `claimGovernance()`; asserts `governor()` == anna.
- `it("Should not allow anyone to transfer governance")` — for [strategist, anna], `transferGovernance(self)` reverts with `"Caller is not the Governor"` and `governor()` stays unchanged after each attempt.
- `it("Should not allow anyone to claim governance")` — governor transfers governance to josh; for [strategist, anna], `claimGovernance()` reverts with `"Only the pending Governor can complete the claim"` and `governor()` remains the original governor.
- `it("Should allow governor to transfer governance multiple times")` — governor transfers governance sequentially to anna, josh, then matt; asserts `governor()` still original; josh's `claimGovernance()` reverts with `"Only the pending Governor can complete the claim"` (only the last pending governor can claim); matt claims successfully and `governor()` == matt.

### `test/behaviour/harvestable.js` — behaviour suite (unit + fork consumers)

Exports `shouldBehaveLikeHarvestable(context)`; `context()` returns a fixture plus `harvester`, `strategy`, and optional `newBehavior` (true for strategies upgraded with the `onlyHarvester` modifier that also accepts the strategist). Consumers: `test/strategies/nativeSSVStaking.js`, `test/strategies/curve-amo-oeth.mainnet.fork-test.js`, `test/strategies/curve-amo-ousd.mainnet.fork-test.js`, `test/strategies/base/curve-amo.base.fork-test.js`.

**describe: "Harvestable behaviour"**
- `it("Should allow rewards to be collect from the strategy by the harvester")` — impersonates/funds the harvester address and calls `collectRewardTokens()`; asserts only that the call does not revert.
- `it("Should allow strategist to collect rewards")` — early-returns (no-op pass) unless `newBehavior`; otherwise strategist calls `collectRewardTokens()` and it must not revert.
- `it("Should NOT allow rewards to be collected by non-harvester")` — for [anna, governor], `collectRewardTokens()` reverts with `"Caller is not the Harvester or Strategist"` when `newBehavior`, else `"Caller is not the Harvester"`.
- `it("Should revert when zero address attempts to be set as reward token address")` — governor `setRewardTokenAddresses([oeth, address(0)])` reverts with `"Can not set an empty address as a reward token"`.

### `test/strategies/vault-value-checker.js` — unit test (mainnet)

Fixture: `loadDefaultFixture()` from `_fixture.js` (mocks); contract under test: `VaultValueChecker` (fetched via `ethers.getContract`), exercised against the OUSD `vault`, `ousd` token, and mock `usdc`. The vault address itself is impersonated/funded as a signer. Two helpers drive every test: `changeAndSnapshot({vaultChange, supplyChange})` — matt calls `checker.takeSnapshot()`, then vault value is altered (positive `vaultChange`: `usdc.mintTo(vault)`; negative: vault signer transfers USDC out to matt at gasPrice 0) and OUSD supply is changed via `ousd.changeSupply(totalSupply + supplyChange)` from the vault signer — and `testChange(opts)` which afterwards calls `checker.checkDelta(expectedProfit, profitVariance, expectedVaultChange, vaultChangeVariance)` from matt and asserts it either passes or reverts with `opts.expectedRevert`. Note: vault changes are in USDC (6 decimals) while profit/vaultChange expectations passed to `checkDelta` are 18-decimal values (profit = vault value change − supply change).

**describe: "Check vault value"** (vault-value band tests)
- `it("should succeed if vault gain was inside the allowed band")` — vaultChange +2 USDC, supplyChange +2 OUSD; `checkDelta(profit 0 ±100, vaultChange 2 ±100)` passes (no revert).
- `it("should revert if vault gain less than allowed")` — vaultChange +50 USDC, supplyChange +2 OUSD; `checkDelta(profit 125 ±25, vaultChange 1 ±1)` reverts with `"Profit too low"`.
- `it("should revert if vault gain more than allowed")` — vaultChange +550 USDC, supplyChange +2 OUSD; `checkDelta(profit 500 ±50, vaultChange 1 ±1)` reverts with `"Vault value change too high"`.
- `it("should succeed if vault loss was inside the allowed band")` — vaultChange −200 USDC, supplyChange 0; `checkDelta(profit −200 ±100, vaultChange −200 ±0)` passes.
- `it("should revert if vault loss under allowed band")` — vaultChange −40 USDC, supplyChange 0; `checkDelta(profit −40 ±4, vaultChange 0 ±10)` reverts with `"Vault value change too low"`.
- `it("should revert if vault loss over allowed band")` — vaultChange +100 USDC, supplyChange 0; `checkDelta(profit 100 ±100, vaultChange 0 ±50)` reverts with `"Vault value change too high"`.

**describe: "Check vault value"** (OUSD-supply band tests; all use vaultChange 0, expectedVaultChange 0 ±0, raw wei amounts)
- `it("should succeed if supply gain was inside the allowed band")` — supplyChange +100 wei; `checkDelta(profit −80 ±30, 0 ±0)` passes (profit = 0 − 100 = −100, inside [−110, −50]).
- `it("should revert if supply gain less than allowed")` — supplyChange +200 wei; `checkDelta(profit −400 ±100, 0 ±0)` reverts with `"Profit too high"`.
- `it("should revert if supply gain more than allowed")` — supplyChange +400 wei; `checkDelta(profit −200 ±100, 0 ±0)` reverts with `"Profit too low"`.
- `it("should succeed if supply loss was inside the allowed band")` — supplyChange +400 wei; `checkDelta(profit −300 ±100, 0 ±0)` passes.
- `it("should revert if supply loss lower than allowed")` — supplyChange −800 wei; `checkDelta(profit 500 ±100, 0 ±0)` reverts with `"Profit too high"`.
- `it("should revert if supply loss closer to zero than allowed")` — supplyChange −200 wei; `checkDelta(profit 500 ±100, 0 ±0)` reverts with `"Profit too low"`.

### `test/strategies/ousd-v2-morpho.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `morphoOUSDv2Fixture` via `createFixtureLoader` (per-describe configs); contracts under test: `MorphoOUSDv2Strategy` (Generalized4626 strategy over Yearn's Morpho OUSD v2 ERC-4626 vault) against the real OUSD vault, USDC and MORPHO token. `this.timeout(0)`; `this.retries(3)` on CI. Uses `morphoWithdrawShortfall()` (utils/morpho) and live Merkl API data (`getMerklRewards` from tasks/merkl).

**describe: "ForkTest: Yearn's Morpho OUSD v2 Strategy" > "post deployment"** (plain `morphoOUSDv2Fixture`)
- `it("Should have constants and immutables set")` — asserts `platformAddress()` and `shareToken()` == `addresses.mainnet.MorphoOUSDv2Vault`, `vaultAddress()` == OUSD vault, `assetToken()` == mainnet USDC, `supportsAsset(USDC)` true, `assetToPToken(USDC)` == MorphoOUSDv2Vault, `governor()` == mainnet Timelock, `harvesterAddress()` == `addresses.mainnet.CoWHarvester`.
- `it("Should be able to check balance")` — sends `checkBalance(usdc)` as a real transaction from josh (populateTransaction) purely for gas reporting; asserts no revert.
- `it("Only Governor can approve all tokens")` — timelock `safeApproveAllTokens()` succeeds and emits a USDC `Approval` event; for [daniel, domen, josh, strategist, oldTimelock, vaultSigner] the same call reverts with `"Caller is not the Governor"`.

**describe: "ForkTest: ..." > "with some USDC in the vault"** (fixture config `{usdcMintAmount: 12000, depositToStrategy: false}`)
- `it("Vault should deposit some USDC to strategy")` — vault signer transfers 1,000 USDC to the strategy, strategist rebases; vault signer calls `deposit(usdc, 1000)`; asserts `Deposit` event with args (USDC, MorphoOUSDv2Vault, 1000e6); OUSD total supply increases by ~1000 within 0.1% tolerance; `checkBalance(usdc)` increases by ~1000 within 0.01% tolerance.
- `it("Only vault can deposit some USDC to the strategy")` — after transferring 50 USDC to the strategy, for [strategist, oldTimelock, timelock, josh] `deposit(usdc, 50)` reverts with `"Caller is not the Vault"`.
- `it("Only vault can deposit all USDC to strategy")` — after transferring 50 USDC to the strategy, for [strategist, oldTimelock, timelock, josh] `depositAll()` reverts with `"Caller is not the Vault"`; then vault signer's `depositAll()` succeeds and emits `Deposit`.

**describe: "ForkTest: ..." > "with the strategy having some USDC in Morpho Strategy"** (fixture config `{usdcMintAmount: 120000, depositToStrategy: true}`)
- `it("Vault should be able to withdraw all")` — computes expected withdrawal as `morphoOUSDv2Vault.convertToAssets(strategy's 4626 shares)` (asserted >= 120,000 USDC − 1 wei) minus `morphoWithdrawShortfall()` (liquidity shortfall in the underlying Morpho OUSD v1 vault); vault signer `withdrawAll()`; asserts `Withdrawal` event via `emittedEvent` with args (USDC, MorphoOUSDv2Vault, amount ≈ available amount within 0.01%); OUSD total supply unchanged within 0.01%; vault USDC balance increased by ≈ the available amount within 0.01%.
- `it("Vault should be able to withdraw some USDC")` — vault signer withdraws 1,000 USDC via `withdraw(vault, usdc, 1000)`; asserts `Withdrawal` event with exact args (USDC, MorphoOUSDv2Vault, 1000e6); OUSD total supply unchanged within 0.01%; vault USDC balance increased by exactly 1000e6.
- `it("Only vault can withdraw some USDC from strategy")` — for [strategist, timelock, oldTimelock, josh], `withdraw(oethVault, weth, 50e18)` reverts with `"Caller is not the Vault"` (note: deliberately wrong vault/asset args; access control fires first).
- `it("Only vault and governor can withdraw all USDC from the strategy")` — for [strategist, josh], `withdrawAll()` reverts with `"Caller is not the Vault or Governor"`; then timelock (governor) `withdrawAll()` succeeds and emits `Withdrawal`.

**describe: "ForkTest: ..." > "claim and collect MORPHO rewards"** (plain `morphoOUSDv2Fixture`)
- `it("Should claim MORPHO rewards")` — fetches live Merkl `{amount, proofs}` for the strategy address (chainId 1); if amount != 0, josh (anyone) calls `merkleClaim(morphoToken, amount, proofs)` and it must emit `ClaimedRewards` with args (MORPHO token, amount). Effectively a no-op pass when the live API reports 0 claimable.
- `it("Should be able to collect MORPHO rewards")` — claims via `merkleClaim` first (if Merkl amount non-zero), records the strategy's MORPHO balance, then impersonates `addresses.multichainStrategist` (the strategy's harvester) and calls `collectRewardTokens()`; if the pre-balance was > 0, asserts a MORPHO `Transfer` event with args (strategy, multichainStrategist, full pre-balance). Conditional assertions — passes trivially when no rewards exist.

### `test/strategies/base/bridged-woeth-strategy.base.js` — unit test (Base network, mocks)

Fixture: `defaultBaseFixture` from `_fixture-base.js` via `createFixtureLoader`; contract under test: `BridgedWOETHStrategy` (`woethStrategy`) with mock `woeth`, `oethb`, `weth`, and the `MockPriceFeedWOETH` mock Chainlink feed (deployed in `deploy/base/000_mock.js` with initial price 1.01e18, 18 decimals — so the strategy's `lastOraclePrice` starts at 1.01). Runs with `pnpm test:base` (the top-level describe is titled "Base Fork Test: Bridged WOETH Strategy" but this is the mock-based unit file).

**describe: "Base Fork Test: Bridged WOETH Strategy" > "Oracle price"**
- `it("Should get price from Oracle")` — sets mock feed price to 1.02; `getBridgedWOETHValue(1e18)` still returns 1.01 (cached), then after `updateWOETHOraclePrice()` returns 1.02 (exact equality).
- `it("Should not fetch price if it's out of bounds")` — sets feed price to 1.5; `getBridgedWOETHValue(1e18)` returns 1.01; `updateWOETHOraclePrice()` reverts with `"Price diff beyond threshold"`; value still returns 1.01 afterwards.
- `it("Should not fetch price if it's lower than last one")` — sets feed price to 1.001 (below cached 1.01); `getBridgedWOETHValue(1e18)` returns 1.01; `updateWOETHOraclePrice()` reverts with `"Negative wOETH yield"`.
- `it("Should allow governor to set max price diff bps")` — governor `setMaxPriceDiffBps(5000)` emits `MaxPriceDiffBpsUpdated`.
- `it("Should not allow invalid value for max price diff bps")` — governor `setMaxPriceDiffBps(0)` and `setMaxPriceDiffBps(10001)` both revert with `"Invalid bps value"`.
- `it("Should not allow anyone else to change it")` — nick's `setMaxPriceDiffBps(100)` reverts with `"Caller is not the Governor"`.

**describe: "Base Fork Test: Bridged WOETH Strategy" > "Deposit"**
- `it("Should allow governor/strategist to deposit")` — governor approves 1 wOETH and calls `depositBridgedWOETH(1e18)`; asserts `Deposit` event; expected mint 1.01 OETHb (oracle price 1.01): `oethb.totalSupply()` == 1.01, governor OETHb balance == 1.01, strategy wOETH balance == 1, `checkBalance(weth)` == 1.01 (all exact equality).
- `it("Should always update price when depositing")` — sets feed to 1.02 first; deposit of 1 wOETH emits `Deposit` and mints at the FRESH price: totalSupply == 1.02, governor balance == 1.02, strategy wOETH == 1, `checkBalance(weth)` == 1.02, and `lastOraclePrice()` == 1.02 (deposit implicitly refreshes the cached price).
- `it("should not allow non-governor/strategist to deposit")` — for [rafael, nick], `depositBridgedWOETH(1e18)` reverts with `"Caller is not the Strategist or Governor"`.

**describe: "Base Fork Test: Bridged WOETH Strategy" > "Withdraw"**
- `it("Should allow governor/strategist to withdraw")` — governor deposits 1 wOETH (mints 1.01 OETHb), approves 1.01 OETHb to the strategy and calls `withdrawBridgedWOETH(1.01e18)`; asserts `Withdrawal` event; end state (exact): OETHb totalSupply 0, governor OETHb balance 0, strategy wOETH balance 0, governor wOETH balance 1, `checkBalance(weth)` 0.
- `it("should not allow non-governor/strategist to deposit")` — (name says deposit but tests withdraw) for [rafael, nick], `withdrawBridgedWOETH(1e18)` reverts with `"Caller is not the Strategist or Governor"`.

**describe: "Base Fork Test: Bridged WOETH Strategy" > "Asset & Balance"**
- `it("checkBalance should always use lastOraclePrice")` — governor transfers 1 wOETH directly to the strategy; feed price set to 1.02; asserts `checkBalance(weth)` and `getBridgedWOETHValue(1e18)` both still return 1.01 (cached price); after `updateWOETHOraclePrice()`, both return 1.02 (exact).
- `it("checkBalance should revert for unsupported assets")` — `checkBalance(woeth)` reverts with `"Unsupported asset"`; `checkBalance(weth)` does not revert.
- `it("should only show WETH as supported asset")` — `supportsAsset(woeth)` false, `supportsAsset(weth)` true.

### `test/strategies/base/bridged-woeth-strategy.base.fork-test.js` — fork test (Base)

Fixture: `defaultBaseFixture` from `_fixture-base.js` via `createFixtureLoader`; contracts under test: the real deployed `BridgedWOETHStrategy`, `oethbVault`, `oethb`, bridged `woeth` on a Base fork; also uses `deployWithConfirmation` + `replaceContractAt` to swap the real `addresses.base.BridgedWOETHOracleFeed` with a `MockChainlinkOracleFeed` in the yield test. Three top-level `it()`s, no nested describes.

**describe: "Base Fork Test: Bridged WOETH Strategy"**
- `it("Should allow governor/strategist to mint with bridged WOETH")` — after `oethbVault.rebase()` and `updateWOETHOraclePrice()`, governor approves and deposits 1 wOETH via `depositBridgedWOETH`; with `expectedAmount = getBridgedWOETHValue(1e18)`, asserts (each within 1% via `approxEqualTolerance`, with labelled messages): OETHb totalSupply increased by expectedAmount ("Incorrect supply change"), governor OETHb balance increased by expectedAmount ("OETHb balance didn't increase"), governor wOETH balance decreased by 1 ("User has more WOETH"), strategy `checkBalance(weth)` increased by expectedAmount ("Strategy reports more balance"), strategy wOETH balance increased by 1 ("Strategy has less WOETH").
- `it("Should allow governor/strategist to get back bridged WOETH")` — deposits 1 wOETH first (after rebase + price update), then computes `expectedOETHbAmount = getBridgedWOETHValue(1e18 − 1)`, approves 1,000,000 OETHb and calls `withdrawBridgedWOETH(expectedOETHbAmount)`; asserts (each ±1%): OETHb totalSupply decreased by expectedOETHbAmount ("Incorrect supply change"), governor OETHb balance decreased by expectedOETHbAmount ("OETHb balance didn't go down"), governor wOETH balance increased by ~1 ("User has less WOETH"), strategy `checkBalance(weth)` decreased by expectedOETHbAmount ("Strategy reports incorrect balance"), strategy wOETH balance decreased by ~1 ("Strategy has more WOETH").
- `it("Should handle yields from appreciation of WOETH value")` — after rebase, deposits 1 wOETH; reads the live feed's `latestRoundData`, deploys a `MockChainlinkOracleFeed(answer, 18)` and `replaceContractAt` the real `BridgedWOETHOracleFeed` address with it; sets same price/decimals and calls `updateWOETHOraclePrice()` — asserts `checkBalance(weth)` unchanged; then raises the mock price by 0.5% (`answer * 1005 / 1000`) and asserts `checkBalance(weth)` increased ~0.5% (±1%) while the strategy's wOETH balance is unchanged (yield from price, not tokens); finally `oethbVault.rebase()` and asserts OETHb totalSupply ≈ supplyBefore + 0.5% of the pre-appreciation strategy balance (±1%). (Two commented-out balance-before reads exist in the body; no skipped tests.)

---

## Sonic staking (SFC behaviour) + SwapX AMO (Sonic fork)

This area covers the Sonic-chain staking strategy (delegating wS/S to Sonic's SFC — Special Fee Contract — validators) and the SwapX wS/OS AMO strategy. The core of the coverage lives in the reusable behaviour suite `test/behaviour/sfcStakingStrategy.js` (30 `it()` blocks exercising deposit/delegation, rewards restake/claim, undelegation, SFC withdrawal incl. slashing scenarios, and misc S-token handling), which is consumed by the Sonic fork test `sonicStaking.sonic.fork-test.js`. The SwapX AMO fork test contains no `it()` blocks of its own — it is purely a parameterisation of the shared `shouldBehaveLikeAlgebraAmoStrategy` behaviour suite (`test/behaviour/algebraAmoStrategy.js`).

Files covered:
- `test/behaviour/sfcStakingStrategy.js` (behaviour suite, 30 tests)
- `test/strategies/sonic/sonicStaking.sonic.fork-test.js` (fork, Sonic — consumer of the SFC suite)
- `test/strategies/sonic/swapx-amo.sonic.fork-test.js` (fork, Sonic — consumer of the Algebra AMO suite)

### `test/behaviour/sfcStakingStrategy.js` — behaviour suite (consumed by Sonic fork tests)

Exports `shouldBehaveLikeASFCStakingStrategy(context)`. `context` is an async function returning a fixture augmented with: `addresses` (per-chain address book, must include `wS`, `SFC`, `nodeDriveAuth`), `sfc` (an `ISFC` contract instance), `testValidatorIds`, `unsupportedValidators`, plus the standard Sonic fixture members (`sonicStakingStrategy`, `oSonicVault`, `oSonicVaultSigner`, `validatorRegistrator`, `strategist`, `timelock`, `wS`, `clement`). Contract under test: `SonicStakingStrategy` against the real SFC. Sole consumer in `contracts/test`: `test/strategies/sonic/sonicStaking.sonic.fork-test.js`.

Internal helpers the assertions rely on (referenced from bullets below):
- `depositTokenAmount(amount, useDepositAll=false)`: transfers `amount` wS from `clement` to the strategy, then as vault signer calls `deposit(wS, amount)` (or `depositAll()`); asserts events `Deposit(wS, AddressZero, amount)` and `Delegated(defaultValidatorId, amount)` on the strategy, `checkBalance(wS)` increased by exactly `amount`, and the strategy's wS ERC-20 balance unchanged from before the transfer (all wS gets unwrapped/delegated).
- `withdrawUndelegatedAmount(amount, useWithdrawAll=false)`: transfers `amount` wS from `clement` to the strategy, then as vault signer calls `withdraw(oSonicVault, wS, amount)` (or `withdrawAll()`); asserts `checkBalance(wS)` unchanged and strategy wS balance back to its pre-transfer value (loose wS forwarded to the vault, delegated funds untouched).
- `undelegateTokenAmount(amount, validatorId)`: as `validatorRegistrator` calls `undelegate(validatorId, amount)`; asserts event `Undelegated(expectedWithdrawId, validatorId, amount)` where `expectedWithdrawId = nextWithdrawId` before the call, the stored `withdrawals(id)` struct has matching `validatorId` and `undelegatedAmount`, `pendingWithdrawals()` increased by `amount`, and `checkBalance(wS)` unchanged; returns the withdrawal id.
- `withdrawFromSFC(withdrawalId, amountToWithdraw, opts)`: optionally slashes the default validator first (via `opts.slashingRefundRatio < 1e18` — impersonates `nodeDriveAuth` to `deactivateValidator(id, "128")`, asserts `sfc.isSlashed(id) == true`, then impersonates the SFC owner to `updateSlashingRefundRatio` and asserts it was set); computes `slashedWithdrawAmount = amount * ratio / 1e18` (0 if ratio is 0); advances 4 SFC epochs (the min for withdrawal) or only 1 if `advanceSufficientEpochs=false`, or none if `skipEpochAdvancement=true`; then as `validatorRegistrator` calls `withdrawFromSFC(withdrawalId)`. On the error paths it asserts revert with custom error (`opts.expectedError`) or revert string (`opts.expectedRevert`) and returns. On success it asserts: if slashed amount > 0, event `Withdrawal(wS, AddressZero, amount)` with amount within `[slashedWithdrawAmount-1, slashedWithdrawAmount]` (1-wei dust tolerance); event `Withdrawn(withdrawalId, validatorId, amountToWithdraw, withdrawnAmount)` with `withdrawnAmount` in the same dust range; vault wS balance increased by `slashedWithdrawAmount` within 1 wei; `withdrawals(id).undelegatedAmount` zeroed; `pendingWithdrawals()` reduced by exactly `amountToWithdraw`; and `checkBalance(wS) >= before - amountToWithdraw` (>= because delegations keep yielding).
- `advanceSfcEpoch(n)`: impersonates `addresses.nodeDriveAuth` and for each epoch advances time 10 minutes then calls `sfc.sealEpoch(...)` (zero offline times/blocks, uptimes of 600, fixed originatedTxsFee per validator) and `sfc.sealEpochValidators(...)` — this is what makes staking rewards accrue on the fork.
- `changeDefaultDelegator(validatorId)`: as `strategist` calls `setDefaultValidatorId(validatorId)`.

**describe: "Initial setup"**
- `it("Should verify the initial state")` — assertions: `wrappedSonic()` equals `addresses.wS`; `sfc()` equals `addresses.SFC`; `supportedValidatorsLength()` equals `testValidatorIds.length`; `isSupportedValidator(id)` is true for every id in `testValidatorIds`; `platformAddress()` equals `addresses.SFC`; `vaultAddress()` equals `oSonicVault.address`; `harvesterAddress()` equals `AddressZero`; `getRewardTokenAddresses()` is empty.

**describe: "Deposit/Delegation"**
- `it("Should fail when unsupported functions are called")` — assertions: as `timelock`, `setPTokenAddress(wS, wS)`, `collectRewardTokens()` and `removePToken(wS)` each revert with exact string "unsupported function".
- `it("Should not be able to deposit unsupported assets")` — assertions: as vault signer, `deposit(clement.address, 15000e18)` (a non-wS "asset") reverts with "Unsupported asset".
- `it("Should be able to deposit tokens using depositAll")` — assertions: runs `depositTokenAmount(15000e18, true)` — full helper assertion set via `depositAll()`: `Deposit(wS, AddressZero, 15000e18)` + `Delegated(defaultValidatorId, 15000e18)` events, `checkBalance(wS)` +15000e18 exactly, strategy wS balance unchanged.
- `it("Should accept and handle S token allocation and delegation to SFC")` — assertions: `depositTokenAmount(15000e18)` via `deposit()` — same helper assertion set as above.
- `it("Should earn rewards as epochs pass")` — assertions: after depositing 15000e18 and sealing 1 SFC epoch, `checkBalance(wS)` is strictly greater than before (pending rewards counted in balance).
- `it("Should be able to restake the earned rewards")` — assertions: after deposit of 15000e18 + 1 sealed epoch, calling `restakeRewards(testValidatorIds)` (from default signer) makes `sfc.getStake(strategy, defaultValidatorId)` strictly greater than before ("No rewards have been restaked") while `checkBalance(wS)` stays exactly equal to before ("Strategy balance changed" guard — rewards move from pending to staked, no net balance change).
- `it("Should be able to claim the earned rewards")` — assertions: after deposit of 15000e18 + 1 sealed epoch, `collectRewards(testValidatorIds)` as `validatorRegistrator` emits `Withdrawal(wS, AddressZero, amount)` with amount > 0 (checked via `emittedEvent` matcher with callback); `checkBalance(wS)` strictly decreases; vault wS balance strictly increases (claimed rewards forwarded to vault).
- `it("Can not restake rewards of an unsupported validator")` — assertions: after deposit of 15000e18 + 1 sealed epoch, `restakeRewards(unsupportedValidators)` as `validatorRegistrator` reverts with "Validator not supported".
- `it("Should accept and handle S token allocation and delegation to all delegators")` — assertions: loops over validators 15, 16, 17, 18: for each, strategist calls `setDefaultValidatorId(id)` then `depositTokenAmount(5000e18)` with its full assertion set (events with that validator id as `Delegated` arg, exact `checkBalance` increase per deposit).
- `it("Should not allow deposit of 0 amount")` — assertions: as vault signer, `deposit(wS, 0)` reverts with "Must deposit something".

**describe: "Undelegation/Withdrawal"** — beforeEach reads `defaultValidatorId` from the strategy for use in each test.
- `it("Should not be able to withdraw zero amount")` — assertions: as vault signer, `withdraw(oSonicVault, wS, 0)` reverts with "Must withdraw something".
- `it("Should not be able to withdraw without specifying a recipient")` — assertions: as vault signer, `withdraw(AddressZero, wS, 150e18)` reverts with "Must specify recipient".
- `it("Should not be able to withdraw unsupported assets")` — assertions: as vault signer, `withdraw(oSonicVault, clement.address, 15000e18)` (non-wS asset) reverts with "Unsupported asset".
- `it("Should be able to withdraw undelegated funds")` — assertions: `withdrawUndelegatedAmount(15000e18)` — wS sent loose to the strategy is swept to the vault by `withdraw()`: `checkBalance(wS)` unchanged, strategy wS ERC-20 balance restored to pre-transfer value.
- `it("Should be able to withdrawAll undelegated funds")` — assertions: same as above via `withdrawAll()` (`withdrawUndelegatedAmount(15000e18, true)`).
- `it("Should undelegate and withdraw")` — assertions: deposit 15000e18 then `undelegateTokenAmount(15000e18, defaultValidatorId)` — full helper assertion set: `Undelegated(expectedWithdrawId, validatorId, amount)` event, withdrawal struct fields, `pendingWithdrawals` +amount, `checkBalance` unchanged. (Despite the name, no SFC withdrawal is performed here.)
- `it("Should undelegate when unsupporting a validator with delegated funds")` — assertions: deposit 15000e18; snapshot `nextWithdrawId` and `sfc.getStake(strategy, defaultValidatorId)`; then `timelock` calls `unsupportValidator(defaultValidatorId)` and the tx emits `Undelegated(expectedWithdrawId, defaultValidatorId, stakedAmount)` — i.e. unsupporting auto-undelegates the full stake.
- `it("Should not undelegate with 0 amount")` — assertions: after deposit of 15000e18, `undelegate(defaultValidatorId, 0)` as `validatorRegistrator` reverts with "Must undelegate something".
- `it("Should not undelegate more than has been delegated")` — assertions: after deposit of 15000e18, `undelegate(defaultValidatorId, 1500000000e18)` reverts with "Insufficient delegation".
- `it("Withdraw what has been delegated")` — assertions: deposit 15000e18, undelegate it (helper asserts), advance 2 weeks, then `withdrawFromSFC(withdrawalId, 15000e18)` happy path — full helper assertion set with `slashingRefundRatio = 1e18` (no slash): 4 epochs sealed, `Withdrawal`/`Withdrawn` events with amounts within 1 wei of 15000e18, vault wS +15000e18 (±1 wei), withdrawal struct zeroed, `pendingWithdrawals` −15000e18 exact, `checkBalance >= before − 15000e18`.
- `it("Withdraw after being partially slashed")` — assertions: deposit + undelegate 15000e18, advance 2 weeks, then `withdrawFromSFC` with `slashingRefundRatio = 0.95e18` (5% slash): validator is deactivated with code 128 and `sfc.isSlashed` asserted true, refund ratio set and asserted; expected recovered amount is `15000e18 * 0.95` — `Withdrawal`/`Withdrawn` events and vault wS increase within 1 wei of that; `pendingWithdrawals` still reduced by the full 15000e18.
- `it("Withdraw after being fully slashed")` — assertions: same flow with `slashingRefundRatio = 0` (100% slash): slashing setup asserted as above; `slashedWithdrawAmount = 0` so no `Withdrawal` event is expected; `Withdrawn(withdrawalId, validatorId, 15000e18, ~0)` event with withdrawn amount within dust of 0; vault wS unchanged (±1 wei of +0); withdrawal struct zeroed; `pendingWithdrawals` −15000e18.
- `it("Can not withdraw too soon")` — assertions: deposit + undelegate 15000e18, advance only 1 week (not 2), seal 4 epochs; `withdrawFromSFC(id)` reverts with custom error `NotEnoughTimePassed()`.
- `it("Can not withdraw with too little epochs passing")` — assertions: deposit + undelegate 15000e18, advance 2 weeks but seal only 1 epoch (`advanceSufficientEpochs: false`, min is 4); reverts with custom error `NotEnoughEpochsPassed()`.
- `it("Can withdraw multiple times")` — assertions: deposit 15000e18; three separate undelegations of 5000e18 each (each returning consecutive withdrawal ids with full helper assertions); advance 2 weeks; withdraw id1 with normal 4-epoch advancement (full happy-path assertions), then withdraw id2 and id3 with `skipEpochAdvancement: true` (proving one epoch advancement matures all three), each with the full happy-path assertion set for 5000e18.
- `it("Incorrect withdrawal ID should revert")` — assertions: deposit + undelegate 15000e18, then `withdrawFromSFC(withdrawalId + 10)` with no epoch advancement reverts with "Invalid withdrawId".
- `it("Can not withdraw with the same ID twice")` — assertions: deposit + undelegate 15000e18, advance 2 weeks, withdraw successfully (full happy-path assertions), then a second `withdrawFromSFC` on the same id (no further epoch advancement) reverts with "Already withdrawn".

**describe: "Miscellaneous functions"**
- `it("Check balance should now be affected if S is sent to the strategy contract")` — assertions: `clement` uses `wS.withdrawTo(strategy, 100e18)` to force-send native S to the strategy; strategy's native S balance strictly increases, but `checkBalance(wS)` stays exactly equal to before (donated S is not counted).
- `it("Should not receive S tokens from non allowed accounts")` — assertions: a plain `sendTransaction` of 1e18 native S from `clement` to the strategy reverts with "S not from allowed contracts" (only wS/SFC contracts may send S).

### `test/strategies/sonic/sonicStaking.sonic.fork-test.js` — fork test (Sonic)

Fixture: `defaultSonicFixture` from `_fixture-sonic.js` (loaded fresh in a `beforeEach`, `this.timeout(0)`); contracts under test: the deployed `SonicStakingStrategy` + OSonic Vault against the real Sonic SFC on a fork. Top-level describe: **"Sonic Fork Test: Sonic Staking Strategy"**. Contains no `it()` blocks of its own — it CONSUMES `shouldBehaveLikeASFCStakingStrategy(context)` (documented above), passing a context of `{...defaultSonicFixture, addresses: addresses.sonic, sfc: ISFC at addresses.sonic.SFC, testValidatorIds: [15, 16, 17, 18, 45], unsupportedValidators: [1, 2, 3]}`. All 30 behaviour-suite tests run once against this fixture.

### `test/strategies/sonic/swapx-amo.sonic.fork-test.js` — fork test (Sonic)

Fixture: `swapXAMOFixture` from `_fixture-sonic.js` wrapped by `createFixtureLoader` from `_fixture.js`; contracts under test: `SwapXAMOStrategy` on the SwapX (Algebra-style) wS/OS pool + gauge, OSonic Vault, SWPx reward token. Top-level describe: **"Sonic Fork Test: SwapX AMO Strategy"**. Contains no `it()` blocks of its own — it CONSUMES `shouldBehaveLikeAlgebraAmoStrategy(...)` from `test/behaviour/algebraAmoStrategy.js` (a large shared AMO suite, ~113 `it()` blocks; also consumed by `test/strategies/base/oethb-hydrex-amo.base.fork-test.js` — documented with that suite, not here). It passes:
- `scenarioConfig`: per-scenario sizing parameters (string token amounts) for the suite's scenarios: `attackerFrontRun` (moderateAssetIn 20000, largeAssetIn 10000000, largeOTokenIn 10000000), `bootstrapPool` (small/medium/large asset bootstrap: 5000 / 20000 / 5000000), `mintValues` (extraSmall 50, extraSmallPlus 100, small 2000, medium 5000), `poolImbalance` (lotMoreOToken +1000000 OToken, littleMoreOToken +5000, lotMoreAsset +2000000 asset, littleMoreAsset +20000), `smallPoolShare` (bootstrapAssetSwapIn 500000, bigLiquidityAsset 100000, oTokenBuffer 100000, stress swap sizes 50000/100000/50000 — a code comment notes these were downsized to fit the current ~760k-per-side wS/OS pool depth, since millions-scale swaps broke the suite's `oTokenToPool > 0` setup check), `rebalanceProbe` with four sub-scenarios (`frontRun`, `lotMoreOToken`, `littleMoreOToken`, `lotMoreAsset`, `littleMoreAsset`) each parameterising deposit/withdraw/swapAssetsToPool/swapOTokensToPool amounts including failing/excessive/disallowed sizes, `insolvent` (swapOTokensToPool 10), and `harvest` (collectedBy: "harvester").
- `loadFixture({assetMintAmount, depositToStrategy, balancePool, poolAddAssetAmount, poolAddOTokenAmount})`: builds the SwapX fixture (mapping the generic options to `wsMintAmount` / `depositToStrategy` / `balancePool` / `poolAddwSAmount` / `poolAddOSAmount`), computes `oTokenPoolIndex` from whether `pool.token0()` is OS, and returns the suite's generic interface: `assetToken` = wS, `oToken` = OSonic, `rewardToken` = SWPx, `amoStrategy` = swapXAMOStrategy, `pool` = swapXPool, `gauge` = swapXGauge, `governor`/`timelock` both = governor, `strategist`, `nick`, `vaultSigner` = oSonicVaultSigner, `vault` = oSonicVault, `harvester`, plus `oTokenPoolIndex` and `scenarioConfig`.

---

## Cross-chain master/remote strategies (unit + mainnet/base/hyperevm fork)

Covers the CCTP-based cross-chain strategy pair: `CrossChainMasterStrategy` (lives on mainnet, registered with the OUSD vault) and `CrossChainRemoteStrategy` (lives on Base/HyperEVM, deposits USDC into a Morpho vault). USDC moves between them via Circle CCTP V2 burn messages with Origin-specific hook data (message version 1010; message types: 1=deposit, 2=withdraw, 3=balanceCheck). The unit suite simulates the whole round trip on one chain via a `CCTPMessageTransmitterMock` FIFO queue; the fork suites test each side in isolation against real deployed proxies, swapping the real CCTP transmitter for `CCTPMessageTransmitterMock2` (via `replaceContractAt`) so hand-crafted messages can be relayed with a fake attestation. All encode/decode helpers (`encodeCCTPMessage`, `encodeBurnMessageBody`, `encodeDepositMessageBody`, `encodeWithdrawMessageBody`, `encodeBalanceCheckMessageBody`, decoders, `replaceMessageTransmitter`, `setRemoteStrategyBalance` which pokes storage slot 207) live in `test/strategies/crosschain/_crosschain-helpers.js`. None of these files consume or define a `test/behaviour/` shared suite.

Files covered:
- `test/strategies/crosschain/cross-chain-strategy.js` (unit, 46 tests)
- `test/strategies/crosschain/crosschain-master-strategy.mainnet.fork-test.js` (mainnet fork, 9 tests)
- `test/strategies/crosschain/crosschain-remote-strategy.base.fork-test.js` (Base fork, 6 tests)
- `test/strategies/crosschain/crosschain-remote-strategy.hyperevm.fork-test.js` (HyperEVM fork, 6 tests)
- `test/strategies/crosschain/decode-origin-nonce.js` (unit, 5 tests)

### `test/strategies/crosschain/cross-chain-strategy.js` — unit test (local mocks; describe is misleadingly named "ForkTest")

Fixture: `crossChainFixtureUnit` from `_fixture.js` — deploys both `CrossChainMasterStrategy` and `CrossChainRemoteStrategy` proxies on the same local chain, approves master on the OUSD vault, wires `CCTPMessageTransmitterMock` (a FIFO message queue with `messagesInQueue()`, `processFront()`, `processBack()`, and `override*`/`processFrontOverride*` tamper helpers) as operator on both strategies, plus `MockMorphoV1Vault` + `MockMorphoV1VaultLiquidityAdapter` as the remote yield venue, and an impersonated `vaultSigner`. `beforeEach` snapshots `vault.totalValue()` as `initialVaultValue`; helper `assertVaultTotalValue(x)` asserts `totalValue() - initialVaultValue == x`. Shared helpers: `mint(amount)` (josh mints OUSD with USDC), `depositToMasterStrategy` (governor `vault.depositToStrategy`), `withdrawFromRemoteStrategy` (governor `vault.withdrawFromStrategy` on master), `withdrawAllFromRemoteStrategy` (governor `vault.withdrawAllFromStrategy`), `directWithdrawFromRemoteStrategy`/`directWithdrawAllFromRemoteStrategy` (governor calls `withdraw`/`withdrawAll` on the remote strategy directly), `sendBalanceUpdateToMaster` (governor `remote.sendBalanceUpdate()`). The composite helper `mintToMasterDepositToRemote(amount)` mints, deposits to master (queue +1), processes the deposit message (asserts remote emits `Deposit(usdc, morphoVault, amount)`, Morpho share balance grows by amount, queue still +1 because a checkBalance message was enqueued), then processes the checkBalance message (asserts master emits `RemoteStrategyBalanceUpdated(prev+amount)`, queue back to baseline, `master.remoteStrategyBalance()` grows by amount, vault totalValue unchanged throughout). The helper `withdrawFromRemoteToVault(amount, expectWithdrawalEvent)` requests a withdraw via master (queue +1), processes it on remote (expects `Withdrawal(usdc, morphoVault, amount)` + `TokensBridged` if flag set, else just `TokensBridged`), asserts master's `remoteStrategyBalance` is still stale, remote `checkBalance` dropped by amount, then processes the follow-up checkBalance (master emits `RemoteStrategyBalanceUpdated(newBalance)` and `remoteStrategyBalance` updates). Timeout 0, retries 3 on CI.

**describe: "ForkTest: CrossChainRemoteStrategy"** (single top-level block)
- `it("Should wire morpho vault and liquidity adapter in fixture")` — assertions: `morphoVault.liquidityAdapter()` equals the adapter address; adapter's `morphoVaultV1()` and `parentVault()` both equal the Morpho vault address (fixture wiring sanity check).
- `it("Should revert withdrawAll when morpho vault liquidity adapter is incompatible")` — setup: governor calls `morphoVault.setLiquidityAdapter(morphoVault.address)` (an address that does not implement `IMorphoV2Adapter`); assertion: governor `remote.withdrawAll()` reverts with custom error `IncompatibleAdapter(address)`.
- `it("Should mint USDC to master strategy, transfer to remote and update balance")` — starts with vault-value delta 0 and `morphoVault.totalAssets() == 0`; runs `mintToMasterDepositToRemote("1000")` (all its embedded assertions: `Deposit` event on remote with args (usdc, morphoVault, 1000e6), `RemoteStrategyBalanceUpdated(1000e6)` on master, queue counts, Morpho share balance, `remoteStrategyBalance`); final asserts vault-value delta == 1000 OUSD-units and `morphoVault.totalAssets() == 1000e6`.
- `it("Should be able to withdraw from the remote strategy")` — after depositing 1000 (delta 1000, totalAssets 1000e6), runs `withdrawFromRemoteToVault("500", true)`: `Withdrawal(usdc, morphoVault, 500e6)` + `TokensBridged` on remote, then `RemoteStrategyBalanceUpdated(500e6)` on master; vault-value delta remains 1000 throughout.
- `it("Should be able to direct withdraw from the remote strategy directly and collect to master")` — after 1000 deposited: governor direct-`withdraw`s 500 from remote (funds leave Morpho but stay on the remote contract, so `remote.checkBalance(usdc)` still 1000e6, vault delta 1000); then `withdrawFromRemoteToVault("450", false)` (no `Withdrawal` event since idle funds cover it, only `TokensBridged`); final: vault delta 1000, `remote.checkBalance == 550e6` (500 in Morpho + 50 idle), `usdc.balanceOf(remote) == 50e6`.
- `it("Should be able to direct withdraw from the remote strategy directly and withdrawing More from Morpho when collecting to the master")` — same setup (1000 deposited, 500 direct-withdrawn, checkBalance still 1000e6); then `withdrawFromRemoteToVault("550", false)` must pull an extra 50 from Morpho on top of the 500 idle; final: vault delta 1000, `remote.checkBalance == 450e6`, `usdc.balanceOf(remote) == 0`.
- `it("Should fail when a withdrawal too large is requested")` — after 1000 deposited, `withdrawFromRemoteStrategy("1001")` reverts with `"Withdraw amount exceeds remote strategy balance"`; vault delta stays 1000.
- `it("Should be able to direct withdraw all from the remote strategy directly and collect to master")` — after 1000 deposited: `directWithdrawAllFromRemoteStrategy()` empties Morpho but funds stay on the remote (`checkBalance` still 1000e6, vault delta 1000); then `withdrawFromRemoteStrategy("1000")`, first `processFront()` must NOT emit `WithdrawUnderlyingFailed` on remote, second `processFront()` emits `RemoteStrategyBalanceUpdated(0)` on master; final `remote.checkBalance == 0`, vault delta 1000; calling `withdrawAll` on the remote a second time does not revert.
- `it("Should fail when a withdrawal too large is requested on the remote strategy")` — setup: impersonate the remote strategy as a signer; deposit 1000; direct-withdraw 10 from Morpho; the impersonated remote transfers 10 USDC to the vault (so remote actually holds only 990 but master still thinks 1000; vault delta becomes 1010); then `withdrawFromRemoteStrategy("1000")`: processing on remote emits `WithdrawalFailed(1000e6, 0)`; processing the checkBalance on master emits `RemoteStrategyBalanceUpdated(990e6)`; queue drains to 0; both `remote.checkBalance(usdc)` and `master.checkBalance(usdc)` equal 990e6.
- `it("Should be able to process withdrawal & checkBalance on Remote strategy and in reverse order on master strategy")` — deposit 1000, withdraw 300, process the withdraw on remote, then governor calls `sendBalanceUpdate()` (queue == 2); processing the newer standalone balanceCheck first via `processBack()` must NOT emit `RemoteStrategyBalanceUpdated` (out-of-order message ignored); processing the withdrawal-linked balanceCheck via `processFront()` emits `RemoteStrategyBalanceUpdated(700e6)`; queue 0; `remote.checkBalance` and `master.checkBalance` both 700e6; vault delta 1000.
- `it("Should emit a BalanceCheckIgnored event if balance update message is too old")` — remote sends a balance update, then the message body is overridden with `encodeBalanceCheckMessageBody(nonce=0, "1000", true, timestamp = now − 86400 − 1)`; processing emits `BalanceCheckIgnored(0, staleTimestamp, true)` on master; queue drains to 0.
- `it("Should emit a RemoteStrategyBalanceUpdated event if balance update message is just in time")` — same but timestamp = now − 86400 + 10; processing emits `RemoteStrategyBalanceUpdated`; queue 0.
- `it("Should fail on deposit if a previous one has not completed")` — mint 100, deposit 50 (unprocessed); a second `depositToMasterStrategy("50")` reverts with `"Unexpected pending amount"`.
- `it("Should fail to withdraw if a previous deposit has not completed")` — after a completed 40 round-trip, mint 50 and deposit 50 (unprocessed); `withdrawFromRemoteStrategy("40")` reverts with `"Pending token transfer"`.
- `it("Should fail on deposit if a previous withdrawal has not completed")` — after 230 deposited, withdraw 50 (unprocessed); mint 30 then `depositToMasterStrategy("30")` reverts with `"Pending token transfer"`.
- `it("Should fail to withdraw if a previous withdrawal has not completed")` — after 230 deposited, withdraw 50 (unprocessed); `withdrawFromRemoteStrategy("40")` reverts with `"Pending token transfer"`.
- `it("Should fail to deposit non usdc asset")` — mint 10 OUSD, transfer 10 OUSD to the vault; `master.deposit(ousd, 10e18)` from the impersonated `vaultSigner` reverts with `"Unsupported asset"`.
- `it("Should not deposit less than 1 USDC using normal depositAll approach")` — mint 1; governor `vault.depositToStrategy(master, [usdc], [0.5e6])` must NOT emit `Deposit` on the master strategy (sub-1-USDC amounts are silently skipped by depositAll path).
- `it("Should revert when depositing less than 1 USDC")` — direct `master.deposit(usdc, 0.5e6)` from `vaultSigner` reverts with `"Deposit amount too small"`.
- `it("Should not calling withdrawAll if one withdraw is pending")` — after 10 deposited and a 5 withdraw pending, `withdrawAllFromRemoteStrategy()` does NOT emit `WithdrawRequested` on master (no-op, no revert).
- `it("Should not calling withdrawAll when to little balance is on the remote strategy")` — deposit 10, withdraw 9.5 fully processed (`remote.checkBalance == 0.5e6`); `withdrawAllFromRemoteStrategy()` does NOT emit `WithdrawRequested` (0.5 USDC remainder below minimum, no-op, no revert).
- `it("Should revert if withdrawal amount is too small")` — after 10 deposited, `withdrawFromRemoteStrategy("0.9")` reverts with `"Withdraw amount too small"`.
- `it("Should revert if withdrawal exceeds remote strategy balance")` — after 10 deposited, `withdrawFromRemoteStrategy("11")` reverts with `"Withdraw amount exceeds remote strategy balance"`.
- `it("Should revert if withdrawal exceeds max transfer amount")` — setup: `setERC20TokenBalance` gives josh 100M USDC, two 9M round-trip deposits (18M total on remote); `withdrawFromRemoteStrategy("10000001")` reverts with `"Withdraw amount exceeds max transfer amount"` (10M cap).
- `it("Should revert if balance update on the remote strategy is not called by operator or governor or strategist")` — josh calling `remote.sendBalanceUpdate()` reverts with `"Caller is not the Operator, Strategist or the Governor"`.
- `it("Should revert if deposit on the remote strategy is not called by the governor or strategist")` — josh calling `remote.deposit(usdc, 10e6)` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should revert if depositAll on the remote strategy is not called by the governor or strategist")` — josh calling `remote.depositAll()` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should revert if withdraw on the remote strategy is not called by the governor or strategist")` — josh calling `remote.withdraw(vault, usdc, 10e6)` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should revert if withdrawAll on the remote strategy is not called by the governor or strategist")` — josh calling `remote.withdrawAll()` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should revert if depositing 0 amount")` — governor `remote.deposit(usdc, 0)` reverts with `"Must deposit something"`.
- `it("Should revert if not depositing USDC")` — governor `remote.deposit(ousd, 10e18)` reverts with `"Unexpected asset address"`.
- `it("Check balance on the remote strategy should revert when not passing USDC address")` (1st of two identically-named tests) — `remote.checkBalance(ousd.address)` reverts with `"Unexpected asset address"`.
- `it("Check balance on the remote strategy should revert when not passing USDC address")` (2nd, duplicate name; actually tests message-version validation) — after deposit 1000 + withdraw 300, `messageTransmitter.processFrontOverrideHeader("0x00000001")` reverts with `"Unsupported message version"`.
- `it("Should revert if setMinFinalityThreshold does not equal 1000 or 2000")` — governor `master.setMinFinalityThreshold(1001)` and `(2001)` both revert with `"Invalid threshold"`.
- `it("Should set min finality threshold to 1000")` — governor sets 1000; `master.minFinalityThreshold()` returns 1000.
- `it("Should set min finality threshold to 2000")` — governor sets 2000; `master.minFinalityThreshold()` returns 2000.
- `it("Should set fee premium to 1000 bps successfully")` — asserts default `master.feePremiumBps() == 0`; governor `setFeePremiumBps(1000)` emits `CCTPFeePremiumBpsSet(1000)`; state reads back 1000.
- `it("Should revert when setting fee premium >3000 bps")` — governor `setFeePremiumBps(3001)` reverts with `"Fee premium too high"`.
- `it("Should revert if sender of the message is not correct")` — deposit 1000, withdraw 300, then `messageTransmitter.overrideSender(josh.address)`; `processFront()` reverts with `"Unknown Sender"`.
- `it("Should revert if unfinalized messages are not supported")` — same setup, `overrideMessageFinality(1000)` while strategy threshold is default 2000; `processFront()` reverts with `"Unfinalized messages are not supported"`.
- `it("Should accept unfinalized messages if min finality threshold is set to 1000")` — same setup but governor first sets `remote.setMinFinalityThreshold(1000)`; with finality overridden to 1000, `processFront()` succeeds (no revert asserted).
- `it("Should revert is message finality is below 1000")` — remote threshold set to 1000, finality overridden to 999; `processFront()` reverts with `"Finality threshold too low"`.
- `it("Should revert if the source domain is not correct")` — `overrideSourceDomain(444)`; `processFront()` reverts with `"Unknown Source Domain"`.
- `it("Should revert if incorrect cctp message version is used")` — `processFrontOverrideVersion(2)` reverts with `"Invalid CCTP message version"`.
- `it("Should revert if incorrect sender is used in the message header")` (1st of two identically-named tests) — `processFrontOverrideSender(josh.address)` reverts with `"Incorrect sender/recipient address"`.
- `it("Should revert if incorrect sender is used in the message header")` (2nd, duplicate name; actually overrides the recipient) — `processFrontOverrideRecipient(josh.address)` reverts with `"Unexpected recipient address"`.

### `test/strategies/crosschain/crosschain-master-strategy.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `crossChainFixture` from `_fixture.js` — attaches to the deployed `CrossChainMasterStrategy` proxy at `addresses.mainnet.CrossChainMasterStrategy`, deploys `CCTPMessageTransmitterMock2` (peer domain 6 = Base) + `CCTPTokenMessengerMock`, impersonates the strategy's on-chain `operator()` as `relayer`, and funds matt with 1M USDC. Every test begins with a live-state guard: if `master.isTransferPending()` it logs and returns early (effectively self-skips when the real deployment has an in-flight transfer). Timeout 0, retries 3 on CI.

**describe: "ForkTest: CrossChainMasterStrategy" > "Message sending"**
- `it("Should initiate bridging of deposited USDC")` — setup: impersonate `master.vaultAddress()`, matt transfers 1000 USDC to the strategy; impersonated vault calls `deposit(usdc, 1000e6)` against the REAL CCTP contracts. Asserts: strategy's USDC balance drops by exactly 1000e6 (burned by CCTP); `checkBalance(usdc)` is unchanged (deposit tracked as pending, not lost); `pendingAmount() == 1000e6`; receipt contains a `DepositForBurn` event (topic `DEPOSIT_FOR_BURN_EVENT_TOPIC`) decoded to: amount 1000e6, mintRecipient == strategy address, destinationDomain == 6 (Base), destinationTokenMessenger == `addresses.CCTPTokenMessengerV2`, destinationCaller == strategy address, maxFee == 0, burnToken == USDC, depositer == strategy address, minFinalityThreshold == 2000; hook data decodes (via `decodeDepositOrWithdrawMessage`, which itself asserts Origin message version 1010) to messageType == 1 (deposit), nonce > 2, amount == 1000e6.
- `it("Should request withdrawal")` — setup: impersonate vault; `setRemoteStrategyBalance(master, 1000e6)` via direct storage write (slot 207); impersonated vault calls `withdraw(vault, usdc, 1000e6)`. Asserts the emitted CCTP `MessageSent` event (topic `MESSAGE_SENT_EVENT_TOPIC`) decodes to: version 1, sourceDomain 0 (Ethereum), destinationDomain 6 (Base), sender/recipient/destinationCaller all == strategy address, minFinalityThreshold 2000; payload decodes to messageType == 2 (withdraw), nonce > 2, amount == 1000e6.

**describe: "ForkTest: CrossChainMasterStrategy" > "Message receiving"**
- `it("Should handle balance check message")` — setup: read `lastTransferNonce()`, replace the real transmitter with `CCTPMessageTransmitterMock2` via `replaceMessageTransmitter()`; build a balanceCheck body (nonce == lastNonce, balance 12345e6, transferConfirmation=false) wrapped in a CCTP message (sourceDomain 6, sender/recipient == strategy). Relayer calls `relay(message, "0x")` (empty attestation accepted by the mock); asserts `remoteStrategyBalance() == 12345e6`.
- `it("Should handle balance check message for a pending deposit")` — setup: matt funds strategy 1000 USDC, impersonated vault deposits 1000e6 (real CCTP burn, creates a pending transfer with new nonce); then replace transmitter and relay a balanceCheck (nonce == new `lastTransferNonce()`, balance 10000e6, transferConfirmation=true). Asserts `remoteStrategyBalance() == 10000e6` (accepts the confirmation) and `pendingAmount() == 0` (pending deposit cleared).
- `it("Should accept tokens for a pending withdrawal")` — setup: storage-set remoteStrategyBalance to 123456e6, impersonated vault withdraws 1000e6 (creates pending withdrawal); replace transmitter; build a BURN message (sender/recipient of the outer CCTP message = `addresses.CCTPTokenMessengerV2`, burnToken = `addresses.base.USDC` i.e. peer USDC, amount 2342e6) whose hook data is a balanceCheck (nonce == lastTransferNonce, balance 12345e6, transferConfirmation=true); matt transfers 2342 USDC to the strategy to simulate the CCTP mint; relayer relays. Asserts `remoteStrategyBalance() == 12345e6`.
- `it("Should ignore balance check message for a pending withdrawal")` — setup: storage-set balance 1000e6, impersonated vault withdraws 1000e6 (pending); replace transmitter; relay a PLAIN balanceCheck (nonce == lastTransferNonce, balance 10000e6, transferConfirmation=false — not a token-bearing confirmation). Asserts `remoteStrategyBalance()` unchanged (a plain balance check during a pending withdrawal is treated as a race and ignored).
- `it("Should ignore balance check message with older nonce")` — setup: capture `lastTransferNonce()` BEFORE a fresh deposit (matt funds 1000, vault deposits 1000e6, bumping the nonce); replace transmitter; relay a balanceCheck with the stale pre-deposit nonce (balance 123244e6, transferConfirmation=false). Asserts `remoteStrategyBalance()` unchanged.
- `it("Should ignore if nonce is higher")` — replace transmitter; relay a balanceCheck with nonce == `lastTransferNonce()+2` (balance 123244e6, false). Asserts `remoteStrategyBalance()` unchanged (future nonces ignored too).
- `it("Should revert if the burn token is not peer USDC")` — setup: storage-set balance 123456e6; replace transmitter; build a burn message with burnToken = `addresses.mainnet.WETH` (hook data a valid transfer-confirmation balanceCheck, nonce == lastTransferNonce, balance 12345e6); relayer `relay()` reverts with `"Invalid burn token"`.

### `test/strategies/crosschain/crosschain-remote-strategy.base.fork-test.js` — fork test (Base)

Fixture: `crossChainFixture` from `_fixture-base.js` — attaches to the deployed `CrossChainRemoteStrategy` proxy at `addresses.base.CrossChainRemoteStrategy`, deploys `CCTPMessageTransmitterMock2` (source domain 6) + `CCTPTokenMessengerMock`, mints 1M Base USDC to rafael by impersonating the Circle master-minter, and impersonates `addresses.base.OZRelayerAddress` as `relayer`. Shared assertion helper `verifyBalanceCheckMessage(event, expectedNonce, expectedBalance, transferAmount=0)` decodes the CCTP `MessageSent` event and asserts: version 1, sourceDomain 6 (Base), destinationDomain 0 (Ethereum), destinationCaller == remote strategy, minFinalityThreshold 2000; if the message is a burn message (outer sender == `CCTPTokenMessengerV2`) it further asserts burnToken == Base USDC, burn recipient/sender == remote strategy, burn amount == `transferAmount`, and takes the hook data as the balanceCheck payload; otherwise asserts outer sender/recipient == remote strategy; finally decodes the balanceCheck body and asserts version 1010, messageType 3, nonce == expectedNonce, balance approxEqual expectedBalance. Timeout 0, retries 3 on CI.

**describe: "ForkTest: CrossChainRemoteStrategy"**
- `it("Should send a balance update message")` — setup: rafael transfers 1234 USDC to the strategy; snapshot `checkBalance(usdc)` and `lastTransferNonce()`; strategist calls `sendBalanceUpdate()` against the REAL transmitter. Asserts the emitted `MessageSent` event passes `verifyBalanceCheckMessage` with nonce == pre-call nonce (unchanged — standalone update reuses the current nonce) and balance == pre-call balance (plain, non-burn message).
- `it("Should handle deposits")` — setup: snapshot balance/nonce; `replaceMessageTransmitter()` (peer domain 6 default); build an inbound burn message from Ethereum (sourceDomain 0, outer sender/recipient = `CCTPTokenMessengerV2`, burnToken = `addresses.mainnet.USDC`, amount 1234.56e6) whose hook data is a deposit body with nonce == lastNonce+1; rafael transfers 1234.56 USDC to the strategy to simulate the CCTP mint; relayer calls `relay(message, "0x")`. Asserts: the tx emits a `MessageSent` balance-check response verified via `verifyBalanceCheckMessage(nextNonce, balanceBefore + 1234.56e6)`; `lastTransferNonce()` == nextNonce; `checkBalance(usdc)` approxEqual balanceBefore + deposit (funds swept into the strategy's yield position).
- `it("Should handle withdrawals")` — setup: rafael transfers 2×1234.56 USDC to the strategy and strategist calls `deposit(usdc, 2469.12e6)` so there is balance to withdraw; snapshot balance/nonce; build a PLAIN withdraw message (sourceDomain 0, sender/recipient == remote strategy address, body = withdraw type with nonce == lastNonce+1, amount 1234.56e6); replace transmitter; relayer relays. Asserts: the response `MessageSent` is a BURN message verified via `verifyBalanceCheckMessage(nextNonce, balanceBefore − 1234.56e6, transferAmount = 1234.56e6)` (i.e. USDC is burned back toward mainnet with the balanceCheck as hook data); `lastTransferNonce()` == nextNonce; `checkBalance(usdc)` approxEqual balanceBefore − withdrawal.
- `it("Should handle single withdrawAll")` — setup: rafael transfers 1234.56 USDC to the strategy; strategist `withdrawAll()` does not revert; asserts the strategy's raw USDC balance afterwards is >= (balance before + 1234.56e6) (everything pulled out of the yield venue onto the contract; nothing bridged).
- `it("Should allow calling withdrawAll twice")` — same funding; first strategist `withdrawAll()` does not revert; second `withdrawAll()` also does not revert and leaves the strategy's raw USDC balance exactly equal to the post-first-call balance (idempotent).
- `it("Should revert if the burn token is not peer USDC")` — build an inbound deposit burn message identical to the deposit test but with burnToken = `addresses.base.WETH`; after replacing the transmitter, relayer `relay()` reverts with `"Invalid burn token"`.

### `test/strategies/crosschain/crosschain-remote-strategy.hyperevm.fork-test.js` — fork test (HyperEVM)

Fixture: `crossChainHyperEVMFixture` from `_fixture-hyperevm.js` — attaches to the deployed `CrossChainRemoteStrategy` at `addresses.hyperevm.CrossChainRemoteStrategy`, mints 1M HyperEVM USDC to rafael via the FiatToken master-minter pattern, deploys `CCTPMessageTransmitterMock2` (source domain 19 = HyperEVM) + `CCTPTokenMessengerMock`, and impersonates the strategy's on-chain `operator()` as `relayer`. This file is a network-ported copy of the Base fork test: the same 6 tests with identical names, setups, and assertions, differing only in that `verifyBalanceCheckMessage` asserts sourceDomain == 19 (HyperEVM CCTP domain, vs 6 on Base), `replaceMessageTransmitter(19)` is called with the HyperEVM peer domain, the invalid burn token in the last test is `addresses.mainnet.WETH` (vs `addresses.base.WETH`), and USDC/strategist/relayer come from the HyperEVM fixture. Timeout 0, retries 3 on CI.

**describe: "ForkTest: CrossChainRemoteStrategy (HyperEVM)"**
- `it("Should send a balance update message")` — same assertions as the Base variant: strategist `sendBalanceUpdate()` after a 1234-USDC top-up emits a `MessageSent` plain balance-check verified with nonce == pre-call `lastTransferNonce()`, balance == pre-call `checkBalance(usdc)`, sourceDomain 19 → destinationDomain 0, minFinalityThreshold 2000, version 1010 / messageType 3 in the body.
- `it("Should handle deposits")` — same as Base variant: inbound burn message from Ethereum (sourceDomain 0, burnToken `addresses.mainnet.USDC`, amount 1234.56e6, deposit hook data with nonce = lastNonce+1) relayed by the operator after `replaceMessageTransmitter(19)` and a simulated 1234.56-USDC mint; asserts the balance-check response message (nextNonce, balanceBefore + amount), `lastTransferNonce()` == nextNonce, and `checkBalance(usdc)` approxEqual balanceBefore + amount.
- `it("Should handle withdrawals")` — same as Base variant: after funding 2×1234.56 USDC and strategist `deposit`, a plain withdraw message (sourceDomain 0, sender/recipient == strategy, nonce = lastNonce+1, amount 1234.56e6) relayed via the mock transmitter; asserts the burn-type balance-check response (nextNonce, balanceBefore − amount, transferAmount = amount), nonce advanced, and `checkBalance` approxEqual balanceBefore − amount.
- `it("Should handle single withdrawAll")` — same as Base variant: after a 1234.56-USDC transfer, strategist `withdrawAll()` does not revert and the strategy's raw USDC balance is >= balanceBefore + fundedAmount.
- `it("Should allow calling withdrawAll twice")` — same as Base variant: two consecutive strategist `withdrawAll()` calls both succeed; the second leaves the raw USDC balance exactly equal to the post-first-call value.
- `it("Should revert if the burn token is not peer USDC")` — same as Base variant but with burnToken = `addresses.mainnet.WETH`; relayer `relay()` reverts with `"Invalid burn token"`.

### `test/strategies/crosschain/decode-origin-nonce.js` — unit test (pure JS, no chain state)

No fixture — tests the JS helper `decodeOriginNonce` from `tasks/crossChain.js` (used by the CCTP relay Defender actions to dedupe/track messages), feeding it messages built with the same encoders from `_crosschain-helpers.js` that the fork tests use, so the decoder sees production-shaped bytes. Constants: sourceDomain 6, dummy sender/recipient/usdc addresses, amount 1e6.

**describe: "Unit: decodeOriginNonce (CCTP relay)"**
- `it("decodes nonce from a deposit (burn message with hook data)")` — builds a deposit body (nonce 7) as hook data inside a burn message body inside a full CCTP message; asserts `decodeOriginNonce(message).toNumber() == 7`.
- `it("decodes nonce from a withdraw (plain message)")` — builds a withdraw body (nonce 42) inside a plain CCTP message; asserts decoded nonce == 42.
- `it("decodes nonce from a balance check (plain message)")` — builds a balanceCheck body (nonce 123, transferConfirmation=true, timestamp 1700000000) inside a plain CCTP message; asserts decoded nonce == 123.
- `it("returns null for a non-Origin message body")` — wraps the body `0xdeadbeef00000000` (version != 1010 and too short to be a burn message with Origin hook data) in a CCTP message; asserts `decodeOriginNonce(message) == null`.
- `it("returns null for empty or missing input")` — asserts `decodeOriginNonce(undefined) == null` and `decodeOriginNonce("0x") == null`.

---

## OUSD Rebalancer (unit + mainnet/base/hyperevm fork)

This area tests the **off-chain OUSD Rebalancer library** in `utils/rebalancer.js` — pure JS allocation/planning logic (no contracts deployed, no fixtures) that decides how idle USDC and strategy balances should be moved between the Ethereum, Base and HyperEVM Morpho (MetaMorpho) strategies. The unit file exercises the full pipeline: `computeAvailableBalance` (withdrawal-queue accounting), `computeIdealAllocation` (greedy sort-and-fill by APY with min/max bps and withdrawal-capacity constraints), `computeImpactAwareAllocation` (step-wise marginal-APY allocator), `buildExecutableActions` (filters + shortfall/surplus fallbacks + withdrawal trimming), `computePortfolioApy`, `_applyPortfolioSpreadGate` and `_markShortfallWithdrawals`, plus `formatAllocationTable` output formatting. Amounts are 6-decimal USDC BigNumbers built with a `usdc(n)` helper; strategies/allocations are plain objects created by local `makeStrategy` / `makeAllocation` / `makeAction` / `makeWithdrawAction` helpers (keys `ETH_VAULT`/`BASE_VAULT`/`HYPER_VAULT` used in the `apys` map). Implicit production constraints exercised: `minMoveAmount` = $5K, `crossChainMinAmount` = $25K, min APY spread 0.005, `maxPerStrategyBps` = 9500 (95%), default-strategy `minAllocationBps` = 500 (5%), spot-APY divergence threshold 200 bps. The three tiny fork files each contain a single test asserting `fetchMorphoApys` (from `utils/morpho-apy`, which queries the Morpho GraphQL API) returns a positive APY for the production MetaMorpho V1 vault on that chain.

Files covered:
- `test/rebalancer/rebalancer.js` (unit, 106 tests)
- `test/rebalancer/rebalancer.mainnet.fork-test.js` (fork, mainnet, 1 test)
- `test/rebalancer/rebalancer.base.fork-test.js` (fork, base, 1 test)
- `test/rebalancer/rebalancer.hyperevm.fork-test.js` (fork, hyperevm, 1 test)

None of these files consume or define shared behaviour suites from `test/behaviour/`. No skipped tests.

### `test/rebalancer/rebalancer.js` — unit test (no network / pure JS)

No fixture — imports pure functions from `utils/rebalancer.js` and market-ID constants (`OETH_USDC_MARKET_ID`, `WSTETH_USDC_MARKET_ID`) from `utils/rebalancer-config.js`. Helpers: `makeStrategy(name, balanceUsdc, opts)` builds strategy objects (defaults `maxAllocationBps=9500`; `minAllocationBps=500` if `isDefault` else 0); `twoStrategies(eth, base)` = default Ethereum Morpho + cross-chain Base Morpho; `threeStrategies(eth, base, hyper)` adds cross-chain HyperEVM Morpho; `makeAllocation(name, balance, target, apy, opts)` builds pre-computed allocation rows (delta = target − balance; action derived from delta sign; `spotApy` defaults to `apy`).

**describe: "Rebalancer: computeIdealAllocation"**
- `it("should give highest APY strategy the max allocation (sort-and-fill)")` — 2 strategies 500K/500K, APYs ETH 3% / Base 6%, no shortfall: asserts sum of `targetBalance`s ≈ 1M USDC (±1 USDC) and Base's share of total ≈ 95% (±0.1) since the higher-APY strategy fills to the 95% `maxPerStrategyBps` cap.
- `it("should give highest APY strategy the max allocation when ETH has higher APY")` — same setup with APYs ETH 8% / Base 3%: asserts ETH's share ≈ 95% (±0.1).
- `it("should enforce minimum for default strategy when it has lower APY")` — APYs ETH 0.1% / Base 20%: asserts default ETH share ≥ 5% (its `minDefaultStrategyBps`=500 floor) and Base share ≤ 95.1% (capped).
- `it("should reserve shortfall from deployable capital")` — balances 400K/400K, vaultBalance 200K, shortfall 100K: asserts total target ≈ 900K (±1 USDC), i.e. total capital 1M minus the 100K shortfall reserve.
- `it("should give first strategy in sorted order the max cap when APYs are equal")` — equal 5% APYs: stable sort makes ETH (index 0) fill first; asserts ETH share ≈ 95% (±0.1).
- `it("should give first strategy the max cap when APYs are zero")` — balances 1M/0, both APYs 0: asserts ETH share ≈ 95% (±0.1).
- `it("should set correct action for over/under allocated strategies")` — all 1M in ETH, Base APY higher: asserts ETH row `action === ACTION_WITHDRAW` (overallocated) and Base row `action === ACTION_DEPOSIT` (underallocated).
- `it("should include APY in results")` — asserts result rows carry through the input APYs exactly (0.042 for ETH, 0.073 for Base).
- `it("should handle zero total capital")` — balances 0/0, vault 0: asserts both `targetBalance`s equal 0.
- `it("should treat vault idle USDC as deployable capital")` — strategies 0/0, vaultBalance 1M: asserts total target ≈ 1M (±1 USDC) and both rows have `action === ACTION_DEPOSIT`.
- `it("should output withdraw-all when shortfall exceeds total capital")` — balances ETH 100K + Base 50K, shortfall 200K > total → deployable 0: asserts both rows `action === ACTION_WITHDRAW` with `delta.abs()` equal to each full balance (100K and 50K).
- `it("3-strategy: highest APY fills first, remainder cascades down")` — 3 strategies (500K/300K/200K), APYs ETH 3% / Base 5% / HyperEVM 8%: asserts HyperEVM share ≈ 90% (±0.5, 95% cap minus min claw-back), Base ≈ 5% (±0.5, greedy-fill remainder), ETH (default) ≈ 5% (±0.5, its min).
- `it("should enforce withdrawal capacity floor in ideal allocation")` — Base has 600K but `withdrawalCapacities[BASE_VAULT].maxWithdraw` = 100K while ETH has the higher APY: asserts Base `targetBalance` ≥ 500K (600K balance − 100K capacity floor).
- `it("withdrawal capacity floor interacts with minAllocationBps")` — default ETH has 100K, `maxWithdraw` 10K → capacity floor 90K vs policy min ~40K: asserts ETH `targetBalance` ≥ 90K (the larger floor wins).
- `it("no withdrawal capacity → no floor (existing behavior unchanged)")` — same balances without `withdrawalCapacities`: asserts ETH share ≈ 5% (±0.5, just the policy min).
- `it("should enforce minimums for multiple strategies simultaneously")` — 3 strategies 10K/10K/980K with HyperEVM APY 10%: asserts default ETH share ≥ 5% (clawed back from HyperEVM).
- `it("should allocate minimum to zero-balance default strategy")` — ETH balance 0, Base 1M, Base APY higher: asserts ETH share ≥ 5% and ETH `action === ACTION_DEPOSIT`.

**describe: "Rebalancer: computeAvailableBalance"** — 5 tests generated by a for-loop over a cases table; each calls `computeAvailableBalance(queue, vaultBalance)` and asserts `availableVaultBalance` and `shortfall` exactly:
- `it("should reserve claimable-but-unclaimed funds from vault balance")` — queue {queued 100K, claimable 80K, claimed 60K}, vault 50K → available 10K, shortfall 0.
- `it("should handle vault balance insufficient for total owed")` — same queue, vault 30K → available 0, shortfall 10K.
- `it("should handle fully claimed queue")` — queue fully claimed (100K/100K/100K), vault 50K → available 50K, shortfall 0.
- `it("should handle no queue activity")` — all-zero queue, vault 50K → available 50K, shortfall 0.
- `it("should handle zero vault balance with outstanding shortfall")` — queue {100K, 80K, 50K}, vault 0 → available 0, shortfall 50K.

**describe: "Rebalancer: buildExecutableActions"** — each test calls `await buildExecutableActions(allocs, shortfall, vaultBalance)` on `makeAllocation` rows and inspects resulting `action`/`delta`/`reason` fields.
- `it("should skip withdrawals below minMoveAmount")` — ETH withdraw delta −100 USDC (< $5K min): asserts ETH `action === ACTION_NONE`, `reason === "below min move"`.
- `it("should skip cross-chain moves below crossChainMinAmount")` — Base (cross-chain) overallocated by 10K (< $25K cross-chain min): asserts Base `ACTION_NONE`, `reason === "below cross-chain min"`.
- `it("should skip withdrawals with insufficient liquidity")` — ETH overallocated 200K but `withdrawableLiquidity` = 1 USDC: asserts ETH `ACTION_NONE`, reason includes `"insufficient liquidity"`.
- `it("should allow withdrawal when APY spread is sufficient")` — ETH 3% vs Base 6% (spread 0.03 > 0.005), delta 200K: asserts ETH `ACTION_WITHDRAW` with `reason` undefined.
- `it("should approve cross-chain withdrawal when amount and APY spread are sufficient")` — Base overallocated 200K ≥ 25K, spread 0.04: asserts Base `ACTION_WITHDRAW`, reason undefined.
- `it("cross-chain withdraw below minMoveAmount hits minMove check first")` — Base overallocated 3K (< 5K minMove < 25K crossChainMin): asserts Base `ACTION_NONE` with `reason === "below min move"` (minMove check fires before crossChainMin).
- `it("should skip cross-chain deposits when transfer is pending")` — Base underallocated with `isTransferPending: true`: asserts Base `ACTION_NONE`, `reason === "transfer pending"`.
- `it("deposit blocked when budget is zero (no approved withdrawals, no vault surplus)")` — ETH at target, vaultBalance 0: asserts Base `ACTION_NONE`, `reason === "insufficient vault funds"`.
- `it("approved withdrawal fully funds the deposit (both sides approved)")` — ETH overallocated / Base underallocated by 200K each: asserts ETH `ACTION_WITHDRAW` with `delta.abs()` = 200K and Base `ACTION_DEPOSIT` with delta = 200K, no reason.
- `it("non-cross-chain deposit trimmed below minMoveAmount is discarded")` — Base withdrawal 200K approved (budget 200K) but ETH deposit delta is only 1K < 5K minMove: asserts ETH `ACTION_NONE`, `reason === "below min move"`.
- `it("higher-APY deposit is funded first when budget is scarce")` — two non-cross-chain deposits (Strategy High 7% wants 200K, Strategy Low 3% wants 100K), vault surplus 60K only: asserts High gets `ACTION_DEPOSIT` trimmed to delta 60K with reason including `"trimmed"`, Low gets `ACTION_NONE` with `reason === "insufficient vault funds"`.
- `it("overallocated default with no shortfall: normal minMoveAmount check applies")` — default delta −2K, no shortfall: asserts `ACTION_NONE`, `reason === "below min move"` (Pass 1 rules apply to the default too).
- `it("fallback: overallocated default filtered by minMove + shortfall → uses max(delta, shortfall)")` — default delta −2K (filtered), shortfall 50K: asserts default `ACTION_WITHDRAW` with `delta.abs()` = 50K (shortfall > delta) and reason includes `"fallback"`.
- `it("fallback: overallocated default with delta > shortfall → uses delta amount")` — default delta −200K filtered in Pass 1 by `withdrawableLiquidity` = 1, shortfall 50K: asserts default `ACTION_WITHDRAW` with `delta.abs()` = 200K (max(200K, 50K)) and reason includes `"fallback"`.
- `it("fallback: overallocated default withdrawal capped at balance")` — single default with balance 30K, target 0, shortfall 100K: asserts `delta.abs()` = 30K (capped at balance).
- `it("fallback: underallocated default + small shortfall → withdraws shortfall amount")` — default underallocated (+10K), Base overallocated 10K filtered by cross-chain min, shortfall 10K (< 25K crossChainMin): asserts default `ACTION_WITHDRAW`, `delta.abs()` = 10K, reason includes `"fallback"`.
- `it("fallback: underallocated default + large shortfall + insufficient balance → skips")` — default at target with only 10K balance, shortfall 100K (≥ 25K and > balance): asserts default `ACTION_NONE` (fallback skips this round).
- `it("fallback: withdraws shortfall from default when all withdrawals filtered in Pass 1")` — both strategies at target, shortfall 80K: asserts default `ACTION_WITHDRAW`, reason includes `"fallback"`, `delta.abs()` = 80K.
- `it("fallback: withdraws from lowest-APY cross-chain when default has no balance")` — default balance 0, cross-chain Base has 500K, shortfall 80K: asserts Base `ACTION_WITHDRAW` with reason including `"fallback"`.
- `it("shortfall fallback does not fire when a rebalancing withdrawal is already approved")` — ETH withdrawal 200K approved in Pass A plus shortfall 50K: asserts ETH `ACTION_WITHDRAW` with reason undefined (pure rebalancing) and `delta.abs()` = 200K (rebalancing delta, not shortfall), and exactly 1 withdrawal action in the result.
- `it("shortfall fallback picks lowest-APY cross-chain when multiple are available")` — default empty; two cross-chain at 6% and 4%, shortfall 80K: asserts the 4% one gets `ACTION_WITHDRAW` (reason includes `"fallback"`) and the 6% one stays `ACTION_NONE`.
- `it("fallback: deposits vault surplus to default when no deposit action qualified")` — both at target, vaultBalance 50K: asserts default `ACTION_DEPOSIT` with delta = 50K and reason including `"surplus fallback"`.
- `it("surplus fallback does not fire when a deposit is already approved in Pass B")` — ETH withdrawal 200K + surplus 50K funds the Base 200K deposit: asserts exactly 1 deposit (Base Morpho) and no action with `isVaultSurplus` set.
- `it("budget uses only net vault surplus after shortfall deduction")` — ETH withdrawal 200K approved, vault 57K with shortfall 50K → net surplus 7K: asserts Base `ACTION_DEPOSIT` with delta = 207K (200K + 7K) and reason including `"trimmed"`.
- `it("deposit trimmed to vault surplus when withdraw is filtered by liquidity")` — ETH withdrawal filtered (`withdrawableLiquidity` = 1), vaultBalance 50K: asserts Base `ACTION_DEPOSIT` trimmed to delta = 50K (reason includes `"trimmed"`), ETH stays `ACTION_NONE`.
- `it("excluded strategy passes through buildExecutableActions unchanged")` — Base pre-frozen (delta 0, action none, reason `"APY exceeds threshold"`): asserts Base emerges with `ACTION_NONE`, that exact reason, and delta 0.
- `it("excluded strategy is not picked for shortfall fallback")` — default empty, Base frozen with reason `"APY exceeds threshold"`, shortfall 80K: asserts Base remains `ACTION_NONE` with the exclusion reason (not selected for shortfall withdrawal).
- `it("excluded default strategy does not receive surplus deposit fallback")` — default frozen, vault surplus 53K: asserts default stays `ACTION_NONE` with reason `"APY exceeds threshold"` (surplus fallback skips it).
- `it("deposit discarded when trimmed amount falls below cross-chain min")` — ETH withdrawal liquidity-filtered, vault surplus only 10K (< 25K cross-chain min): asserts Base `ACTION_NONE` with reason including `"cross-chain min"`.
- `it("remaining surplus deployed to default via fallback (adds to existing deposit)")` — ETH deposit 10K approved, vault surplus 900K: asserts ETH `ACTION_DEPOSIT` with delta = 900K (10K planned + 890K fallback), reason includes `"vault surplus fallback"`.
- `it("all surplus consumed by deposits — no remaining surplus for fallback")` — withdrawal 200K + surplus 50K, Base deposit 200K: asserts exactly 1 deposit (Base) and no `isVaultSurplus` action (remaining surplus = 0).
- `it("remaining surplus below minMoveAmount — fallback skips")` — surplus 14K, ETH deposit 10K approved → remaining 4K < 5K: asserts ETH deposit delta stays 10K and no `isVaultSurplus` action exists.
- `it("surplus nets against default withdraw and converts to deposit")` — ETH withdrawal 100K justified by Base deposit 100K, vault surplus 300K: asserts ETH flips to `ACTION_DEPOSIT` with reason including `"net of cancelled withdrawal"`.
- `it("trim: smallest withdrawal cancelled when excess exists")` — withdrawals Base 30K + HyperEVM 300K vs deposit need ETH 200K → excess 130K: asserts Base cancelled (`ACTION_NONE`, reason includes `"no approved deposits"`) and HyperEVM kept as `ACTION_WITHDRAW` trimmed with `delta.abs()` ≤ 300K.
- `it("trim: withdrawal partially trimmed stays above minMoveAmount")` — ETH withdrawal 200K, Base deposit 50K, vaultBalance 3K → needed = 47K: asserts ETH `ACTION_WITHDRAW` with `delta.abs()` = 47K exactly and reason including `"trimmed to match"`.
- `it("trim: no trimming when deposits consume full budget")` — withdrawal 200K exactly matches deposit 200K: asserts ETH `ACTION_WITHDRAW` with `delta.abs()` = 200K and reason undefined.
- `it("trim: vault surplus fully covers deposit — withdrawal cancelled")` — ETH overallocated 200K, Base deposit 50K, vault surplus 60K: asserts Base `ACTION_DEPOSIT` delta = 50K (surplus-funded) and ETH `ACTION_NONE` with reason including `"no approved deposits"` (withdrawal cancelled).
- Spot APY divergence guard — 3 tests generated by a forEach over {spotApy, expectedAction, checkReason} on a Base deposit whose portfolio avg APY is 5%:
  - `it("deposit blocked when spot APY diverges > maxSpotBelowAvgBps below average")` — spotApy 0.02 (300 bps below avg): asserts Base `ACTION_NONE` with reason including `"spot APY"`.
  - `it("deposit allowed when spot APY is close to average (within threshold)")` — spotApy 0.04: asserts `ACTION_DEPOSIT`.
  - `it("deposit allowed when spot APY is above average")` — spotApy 0.06: asserts `ACTION_DEPOSIT`.
- `it("3-strategy: budget from one withdrawal split across two deposits by APY")` — ETH withdraws 400K; Base (7%) and HyperEVM (5%) each want 200K; vaultBalance 3K: asserts ETH `ACTION_WITHDRAW`, Base `ACTION_DEPOSIT` delta = 200K (funded first), HyperEVM `ACTION_DEPOSIT` delta = 200K (remainder).
- `it("3-strategy: budget partially covers second deposit")` — ETH withdrawal 200K; Base wants 150K, HyperEVM wants 150K: asserts Base delta = 150K full, HyperEVM `ACTION_DEPOSIT` trimmed to delta = 50K with reason including `"trimmed"`.
- `it("3-strategy: shortfall fallback selects lowest-APY cross-chain (production config)")` — default empty, Base 6% / HyperEVM 4%, shortfall 80K: asserts HyperEVM `ACTION_WITHDRAW` with `delta.abs()` = 80K and reason including `"fallback"`; Base `ACTION_NONE`.
- `it("3-strategy trim: two small withdrawals cancelled before trimming the large one")` — withdrawals ETH 10K, Base 30K, HyperEVM 300K vs Strategy X deposit 200K → excess 140K: asserts ETH and Base both cancelled (`ACTION_NONE`, reasons include `"no approved deposits"`), HyperEVM trimmed to `delta.abs()` = 200K exactly with reason including `"trimmed to match"`.
- `it("surplus netting: net deposit below minMoveAmount creates sub-minimum deposit")` — ETH withdrawal 100K, surplus 103K → net deposit 3K (< 5K minMove): asserts ETH `ACTION_DEPOSIT` with delta = 3K and reason including `"net of cancelled withdrawal"` (surplus fallback doesn't enforce minMove).
- `it("surplus netting: surplus exactly equals withdrawal → action becomes none")` — withdrawal 100K, surplus 100K: asserts ETH `ACTION_NONE` with reason including `"surplus offsets withdrawal"`.
- `it("trim: withdrawal capped by liquidity then further trimmed by excess")` — ETH overallocation 200K but `withdrawableLiquidity` 100K, Base deposit 50K: asserts ETH `ACTION_WITHDRAW` with `delta.abs()` = 50K (liquidity cap then trim) and reason including `"trimmed to match"`.
- `it("all strategies excluded: vault surplus has nowhere to go")` — both strategies frozen with reason `"APY exceeds threshold"`, vault surplus 50K: asserts zero deposit actions in the result.
- `it("equal-APY deposits: both funded when budget allows")` — ETH withdrawal 200K funds Base and Strategy Local, both wanting 100K at 6%: asserts both get `ACTION_DEPOSIT`.
- `it("fallback: shortfall exactly at crossChainMinAmount — default covers it")` — shortfall 25K (= crossChainMinAmount, "large shortfall" branch), default balance 30K ≥ shortfall: asserts default `ACTION_WITHDRAW` with `delta.abs()` = 25K and reason including `"fallback"`.
- `it("fallback: shortfall at crossChainMinAmount, default can't cover → cross-chain")` — shortfall 25K, default balance 20K < 25K: asserts default `ACTION_NONE` and cross-chain Base `ACTION_WITHDRAW` with `delta.abs()` = 25K, reason including `"fallback"`.
- `it("deposit allowed when spot APY divergence is exactly at threshold (200bps)")` — avg 5%, spotApy 3% (exactly 200 bps below): asserts Base `ACTION_DEPOSIT` (guard uses strict > not >=).
- `it("marks normal-path default withdrawal as isShortfall when it covers the vault deficit")` — default overallocated withdrawal approved via the normal path, shortfall 100K with vaultBalance 0: asserts default `ACTION_WITHDRAW` and `isShortfall === true` even though `_coverShortfall` never ran (needed so the spread gate preserves it).

**describe: "Rebalancer: formatAllocationTable"**
- `it("should suppress vault delta when surplus is below minMoveAmount")` — one at-target action, vaultBalance 19.5 USDC: asserts output includes `"Vault (idle)"`, does not include `"-19.50"`, and the Vault (idle) line shows `"+0.00"`.
- `it("should show vault delta when surplus exceeds minMoveAmount")` — deposit target 510K vs 500K, vaultBalance 10K: asserts Vault (idle) line includes `"-10,000.00"`.
- `it("should show zero vault delta when shortfall exists but no action approved")` — vaultBalance 0, shortfall 100: asserts Vault (idle) line includes `"+0.00"`.
- `it("should show vault delta when surplus equals minMoveAmount")` — vaultBalance 5K (= minMoveAmount) consumed by a 5K deposit: asserts Vault (idle) line includes `"-5,000.00"`.
- `it("should show vault surplus consumed by active actions")` — withdrawal −10K + deposit +10.1K with vaultBalance 100: asserts Vault (idle) line includes `"-100.00"`.
- `it("should show market details even when no action is active")` — passes `baselineMarkets` for `OETH_USDC_MARKET_ID` (supplyApy 4%, utilization 85%) and `WSTETH_USDC_MARKET_ID` (2%, 70%): asserts output includes `"Ethereum Morpho Market Details"`, `"85.00%"`, and `"4.00%"`.
- `it("should show # indicator for strategies with pending transfer")` — Base has `isTransferPending: true`: asserts output includes `"Base Morpho #"` and the legend `"# = transfer pending"`, and does not include `"Ethereum Morpho *  #"` (default not marked).
- `it("should not show # legend when no transfers are pending")` — asserts output does not include `"# = transfer pending"`.

**describe: "Rebalancer: computeImpactAwareAllocation"** — uses a local `createMockApyFn(apyByVault)` returning `max(0, base − (delta/$50K)*decayPerChunk)` as the `computeApy` callback; all tests pass `constraints: { allocationChunkSize: 50000e6 }`.
- `it("equalizes marginal APYs across two strategies")` — 3 empty strategies, base APYs ETH 3.7% / Base 6% / HyperEVM 10% with per-chunk decays 0.003/0.005/0.01, vaultBalance 400K: asserts HyperEVM target > Base target, Base target > 0, ETH target ≤ Base target, and total targets equal exactly 400K USDC.
- `it("respects maxAllocationBps cap")` — HyperEVM at 10% APY with `maxAllocationBps: 6000`, vaultBalance 1M: asserts HyperEVM `targetBalance` equals exactly 600K (60% cap).
- `it("respects withdrawal capacity floor")` — ETH has 500K balance but `maxWithdraw` 100K vs HyperEVM at 10%: asserts ETH `targetBalance` ≥ 400K (500K − 100K floor pre-allocated).
- `it("deploys all capital when single strategy dominates")` — ETH APY 0, HyperEVM 8%, vaultBalance 300K: asserts HyperEVM `targetBalance` equals exactly 285K (95% of 300K, `maxPerStrategyBps` default).
- `it("handles shortfall by reducing deployable capital")` — balances 200K + 100K, vaultBalance 50K, shortfall 20K: asserts total targets equal exactly 330K (350K − 20K).
- `it("respects minAllocationBps floor")` — ETH default with `minAllocationBps: 500` at 2% APY vs HyperEVM 10%, vaultBalance 1M: asserts ETH `targetBalance` ≥ 50K (5% of 1M).

**describe: "Rebalancer: computePortfolioApy"** — uses local `makeAction` helper (balance/targetBalance/apy/expectedApy rows).
- `it("weights strategy APYs by balance")` — A 600K @ 5% + B 400K @ 3%, totalCapital 1M, `useTarget: false`: asserts APY ≈ 0.042 (±1e-9).
- `it("includes idle vault in the denominator at 0% yield")` — 500K strategy @ 10% with totalCapital 1M (500K idle): asserts APY ≈ 0.05 (±1e-9).
- `it("useTarget=true uses expectedApy and targetBalance")` — A target 700K @ expectedApy 0.04 + B target 300K @ expectedApy 0.035, totalCapital 1M: asserts APY ≈ 0.0385 (±1e-9).
- `it("falls back to apy when expectedApy is missing")` — single 500K row with apy 0.05, no expectedApy, `useTarget: true`: asserts APY ≈ 0.05 (±1e-9).
- `it("returns 0 for zero totalCapital")` — empty actions, totalCapital 0: asserts result equals 0.

**describe: "Rebalancer: _applyPortfolioSpreadGate"** — `constraints = { minApySpread: 0.005 }` (50 bps); the gate mutates the actions array in place and pushes to a `warnings` array.
- `it("drops yield-motivated actions when spread below threshold")` — withdraw 100K (4%→4.2% expected) + deposit 100K (4.5%→4.4% expected), lift < 50 bps: asserts `res.gated === true`, both actions set to `ACTION_NONE`, cancelled row's delta reset to 0 and `targetBalance` reset to `balance`, exactly 1 warning matching /yield-motivated actions dropped/, and `res.after ≈ res.before` (±1e-9, APY recomputed post-drop).
- `it("preserves shortfall withdrawals when the gate fires")` — one yield withdraw + one withdraw flagged `isShortfall: true` (reason "shortfall fallback"): asserts the yield one becomes `ACTION_NONE` while the shortfall one stays `ACTION_WITHDRAW` with its reason intact.
- `it("preserves vault-surplus deposits when the gate fires")` — one yield withdraw + one deposit flagged `isVaultSurplus: true` (reason "vault surplus fallback"): asserts withdraw dropped to `ACTION_NONE`, surplus deposit kept as `ACTION_DEPOSIT` with reason intact.
- `it("preserves the surplus-netted-against-withdrawal branch")` — single `isVaultSurplus` deposit with reason "vault surplus (net of cancelled withdrawal)": asserts it stays `ACTION_DEPOSIT` after the gate.
- `it("no-op when spread meets threshold")` — moving 200K from 2% to 8% strategy (lift +120 bps): asserts `res.gated === false`, both actions unchanged (`ACTION_WITHDRAW`/`ACTION_DEPOSIT`), warnings empty.
- `it("does not fire when minApySpread is not set")` — constraints `{}`: asserts `res.gated === false` and the withdraw action untouched.

**describe: "Rebalancer: _markShortfallWithdrawals"** — uses local `makeWithdrawAction(name, balance, withdrawAmount, apy, flags)` (action pre-set to `ACTION_WITHDRAW`, `isShortfall: false`); default `constraints = { minVaultBalance: 0 }`.
- `it("flags the default-strategy withdrawal when it fully covers the deficit")` — vaultBalance 0, shortfall 50K (deficit 50K); default withdraws 100K, cross-chain withdraws 100K: asserts default `isShortfall === true`, cross-chain `false`.
- `it("walks cross-chain by lowest APY after default")` — deficit 130K; default withdraws 20K, cross-chain at 8% and 3% each withdrawing 120K: asserts default and the 3% cross-chain flagged `true`, the 8% one `false`.
- `it("does nothing when vault balance already covers the target")` — vaultBalance 200K ≥ shortfall 50K (deficit 0): asserts `isShortfall === false`.
- `it("is a no-op when no approved withdrawals exist")` — action overridden to `ACTION_NONE`: asserts `isShortfall === false`.
- `it("respects minVaultBalance when computing the deficit")` — vaultBalance 100K, shortfall 50K, `minVaultBalance` 60K → target 110K, deficit 10K; default withdraws 30K: asserts `isShortfall === true`.

**describe: "Rebalancer: shortfall funding survives the spread gate"** — end-to-end regression mirroring a production failure.
- `it("preserves normal-path withdrawals that cover the vault deficit")` — ETH overallocated at 14% APY / Base underfunded at 4%; runs `buildExecutableActions` with shortfall 100K, then `_applyPortfolioSpreadGate` with `minApySpread: 0.001` (APY lift is negative because capital leaves the highest-APY strategy): asserts `res.gated === true`, ETH withdrawal preserved (`ACTION_WITHDRAW`) with `isShortfall === true`, and the yield-motivated Base deposit dropped to `ACTION_NONE`.

### `test/rebalancer/rebalancer.mainnet.fork-test.js` — fork test (mainnet)

No fixture; hits the live Morpho API for the production mainnet MetaMorpho V1 vault (`addresses.mainnet.MorphoOUSDv1Vault`) via `fetchMorphoApys` from `utils/morpho-apy`.

**describe: "ForkTest: Rebalancer APY — Ethereum"**
- `it("should return non-zero APY for Ethereum MetaMorpho V1 vault")` — calls `fetchMorphoApys([{ metaMorphoVaultAddress: addresses.mainnet.MorphoOUSDv1Vault, morphoChainId: 1 }])` and asserts `apys[vault] > 0` (failure message prints the APY as a percentage).

### `test/rebalancer/rebalancer.base.fork-test.js` — fork test (base)

No fixture; same pattern against the Base vault (`addresses.base.MorphoOusdV1Vault`).

**describe: "ForkTest: Rebalancer APY — Base"**
- `it("should return non-zero APY for Base MetaMorpho V1 vault")` — calls `fetchMorphoApys([{ metaMorphoVaultAddress: addresses.base.MorphoOusdV1Vault, morphoChainId: 8453 }])` and asserts `apys[vault] > 0`.

### `test/rebalancer/rebalancer.hyperevm.fork-test.js` — fork test (hyperevm)

No fixture; same pattern against the HyperEVM vault (`addresses.hyperevm.MorphoOusdV1Vault`).

**describe: "ForkTest: Rebalancer APY — HyperEVM"**
- `it("should return non-zero APY for HyperEVM MetaMorpho V1 vault")` — calls `fetchMorphoApys([{ metaMorphoVaultAddress: addresses.hyperevm.MorphoOusdV1Vault, morphoChainId: 999 }])` and asserts `apys[vault] > 0`.

---

# 16. Beacon proofs and beacon roots (unit + mainnet fork)

## Beacon proofs and beacon roots (unit + mainnet fork)

This area covers the beacon-chain Merkle proof verification code (`contracts/beacon/BeaconProofsLib.sol` via the `BeaconProofs` contract / `EnhancedBeaconProofs` test harness) and the EIP-4788 beacon block root oracle wrapper (`contracts/beacon/BeaconRoots.sol` via `MockBeaconRoots`). The unit suite verifies SSZ generalized-index math, merkleization of pending deposits / BLS signatures, and every proof-verification entrypoint (balances container, validator balance, validator pubkey + withdrawal credentials, withdrawable epoch, pending deposits container, individual pending deposit, first-pending-deposit slot) against hard-coded real proofs captured from Ethereum mainnet and Hoodi, including exhaustive negative cases with exact revert strings. The fork suites re-verify the same entrypoints against freshly generated proofs from a live beacon block (via `utils/proofs.js` + `utils/beacon.js`) and exercise the real EIP-4788 ring buffer on mainnet.

Files covered:
- `test/beacon/beaconProofs.js` — 64 tests (59 static `it()` + 5 loop-generated)
- `test/beacon/beaconProofs.mainnet.fork-test.js` — 8 tests
- `test/beacon/beaconRoots.mainnet.fork-test.js` — 5 tests

Total: 77 `it()` blocks.

---

### `test/beacon/beaconProofs.js` — unit test (mainnet unit suite)

Context: `beforeEach` calls `beaconChainFixture()` from `test/_fixture.js` directly (no `loadFixture` wrapper). On a non-fork run the fixture sets `fixture.beaconProofs` to a freshly resolved `EnhancedBeaconProofs` (`contracts/mocks/beacon/EnhancedBeaconProofs.sol`), which extends the production `BeaconProofs` contract (a thin wrapper over `BeaconProofsLib`) and additionally exposes the internal helpers `concatGenIndices` and `balanceAtIndex`. All proof data are hard-coded hex fixtures captured from real Ethereum mainnet / Hoodi beacon blocks. Helpers used: `hashPubKey` from `utils/beacon.js`, `ZERO_BYTES32` / `MAX_UINT64` from `utils/constants.js`, `hexZeroPad` from ethers.

**describe: "Beacon chain proofs" > "Should calculate generalized index"**
- `it("from height and index")` — assertions: 11 pure calls to `concatGenIndices(index1, height2, index2)` return the expected SSZ generalized indices: (1,0,0)→1, (1,1,0)→2, (1,1,1)→3, (1,2,0)→4, (1,2,3)→7, (1,3,0)→8, (1,3,1)→9, (1,3,2)→10, (1,3,6)→14, (1,3,7)→15, (1,6,12)→76.
- `it("for BeaconBlock.slot")` — assertions: `concatGenIndices(1, 3, 0)` equals 8 (gen index of the slot field in a BeaconBlock).
- `it("for BeaconBlock.parentRoot")` — assertions: `concatGenIndices(1, 3, 2)` equals 10.
- `it("for BeaconBlock.body")` — assertions: `concatGenIndices(1, 3, 4)` equals 12.
- `it("for BeaconBlock.BeaconBlockBody.randaoReveal")` — assertions: two-step composition: body gen index = `concatGenIndices(1,3,4)` (=12), then `concatGenIndices(12, 4, 0)` equals 192.
- `it("for BeaconBlock.BeaconState.balances")` — assertions: state gen index = `concatGenIndices(1,3,3)` (=11), then `concatGenIndices(11, 6, 12)` equals 716.
- `it("for BeaconBlock.body.executionPayload.blockNumber")` — assertions: three-step composition: body = `concatGenIndices(1,3,4)` (=12), executionPayload = `concatGenIndices(12, 4, 9)`, then `concatGenIndices(executionPayload, 5, 6)` equals 6438.

**describe: "Beacon chain proofs" > "Should merkleize"**
- `it("pending deposit")` — assertions: `merkleizePendingDeposit(pubKeyHash, withdrawalCredentials, amountGwei, signature, slot)` with a real pubkey (hashed via `hashPubKey`), 0x01 withdrawal credentials, `amountGwei = 32000000000`, a 96-byte BLS signature and slot 12235962 returns the exact expected SSZ hash-tree-root `0xc27ca5bb...a98d819`.
- `it("BLS signature")` — assertions: `merkleizeSignature(signature)` for a 96-byte BLS signature returns the exact expected root `0x5b449fed...12de501`.

**describe: "Beacon chain proofs" > "Balances container to beacon block root proof"** (shared constants: a real `beaconRoot`, `balancesContainerLeaf`, and a 288-byte (9-node) `proof`)
- `it("Should verify")` — assertions: `verifyBalancesContainer(beaconRoot, balancesContainerLeaf, proof)` succeeds (no revert) with the valid fixture data.
- `it("Fail to verify with zero beacon block root")` — assertions: same call with `beaconRoot = ZERO_BYTES32` reverts with exactly "Invalid block root".
- `it("Fail to verify with invalid beacon block root")` — assertions: beacon root with last byte changed to `aa` reverts with "Invalid balance container proof".
- `it("Fail to verify with zero padded proof")` — assertions: a proof of 288 zero bytes (`hexZeroPad("0x", 288)`) reverts with "Invalid balance container proof".
- `it("Fail to verify with invalid proof")` — assertions: proof with first byte changed to `aa` reverts with "Invalid balance container proof".
- `it("Fail to verify with invalid beacon container root")` — assertions: balances-container leaf with first byte changed to `aa` reverts with "Invalid balance container proof".

**describe: "Beacon chain proofs" > "Validator balance to balances container proof"** (shared constants: real `balancesContainerRoot`, `validatorIndex = 1770193`, `balanceLeaf` packing 4 gwei balances, and a 1248-byte (39-node) `proof`)
- `it("Should verify with balance")` — assertions: `verifyValidatorBalance(balancesContainerRoot, balanceLeaf, proof, validatorIndex)` returns the decoded validator balance exactly equal to `32001800437` (gwei; extracted from the correct 8-byte slice of the leaf for index 1770193).
- `it("Fail to verify with incorrect balance")` — assertions: a balance leaf with one byte altered reverts with "Invalid balance proof".
- `it("Fail to verify with zero container root")` — assertions: `balancesContainerRoot = ZERO_BYTES32` reverts with "Invalid container root".
- `it("Fail to verify with incorrect container root")` — assertions: container root with last byte changed to `aa` reverts with "Invalid balance proof".
- `it("Fail to verify with zero padded proof")` — assertions: 1248 zero bytes as proof reverts with "Invalid balance proof".
- `it("Fail to verify with no balance")` — assertions: using a different real fixture (container root, leaf `0x...25d28c7307000000` where the slice for index 1770193 is zero, and matching proof), the call succeeds and returns balance exactly `0` — i.e. a valid proof of a zero balance verifies rather than reverting.

**describe: "Beacon chain proofs" > "Validator public key to beacon block root proof"** (shared constants from Hoodi: `beaconRoot`, `validatorIndex = 1217565`, `publicKeyLeaf` (hash of pubkey), a 1696-byte proof whose first 32 bytes are the withdrawal-credentials node, and `withdrawalCredentials` of 0x02-type pointing at `0xeE45...6DEc`)
- `it("Should verify a 0x02 validator")` — assertions: `verifyValidator(beaconRoot, publicKeyLeaf, proof, validatorIndex, withdrawalCredentials)` succeeds for the 0x02 (compounding) validator fixture.
- `it("Should verify a 0x01 validator")` — assertions: with a second full fixture set from Hoodi validator 1222119 (different beacon root, leaf, 1696-byte proof, 0x01-type withdrawal credentials `0x0100...192d20`), `verifyValidator` succeeds.
- `it("Fail to verify with zero beacon block root")` — assertions: `beaconRoot = ZERO_BYTES32` reverts with "Invalid block root".
- `it("Fail to verify with invalid beacon block root")` — assertions: an unrelated/incorrect beacon root (`0xd33574...570eaa`, note: not derived from the describe-level root) reverts with "Invalid validator proof".
- `it("Fail to verify with zero padded proof")` — assertions: a proof whose first 32 bytes are the correct withdrawal-credential node but the remaining 1664 bytes are zero reverts with "Invalid validator proof" (withdrawal-cred check passes, Merkle verification fails).
- `it("Fail to verify with invalid withdrawal address")` — assertions: expected withdrawal credentials with last byte changed to `aa` reverts with "Invalid withdrawal cred".
- `it("Fail to verify when the validator type does not match")` — assertions: a proof whose first 32 bytes carry a 0x01-type credential (same address) while the expected credentials are 0x02-type reverts with "Invalid withdrawal cred".
- Loop over 5 credential prefixes (`0x021000000000000000000000`, `0x020100000000000000000000`, `0x020000000001000000000000`, `0x020000000000000000000010`, `0x020000000000000000000001`): `it("Fail to verify with withdrawal credential prefix <prefix>")` — assertions: each variant splices the malformed 12-byte prefix into the proof's first node (replacing the 11 zero bytes after the 0x02 type byte with a non-zero byte in various positions); each reverts with "Invalid withdrawal cred" (the 11 padding bytes of the credential must be zero). 5 generated tests.

**describe: "Beacon chain proofs" > "Validator withdrawable epoch to beacon block root proof" > "when validator is not exiting"** (constants from Ethereum slot 11788492: `beaconRoot`, `validatorIndex = 1930711`, a 1696-byte `withdrawableEpochProof` whose first node encodes `0xffffffffffffffff`, `withdrawableEpoch = MAX_UINT64`)
- `it("Should verify")` — assertions: `verifyValidatorWithdrawable(beaconRoot, validatorIndex, MAX_UINT64, proof)` succeeds for a non-exiting validator (withdrawable epoch = far-future = max uint64).
- `it("Fail to verify with zero beacon block root")` — assertions: `beaconRoot = ZERO_BYTES32` reverts with "Invalid block root".
- `it("Fail to verify with invalid block root")` — assertions: beacon root with first byte changed to `00` reverts with "Invalid withdrawable proof".
- `it("Fail to verify with invalid validator index")` — assertions: `validatorIndex + 1` reverts with "Invalid withdrawable proof" (index changes the gen index used in verification).
- `it("Fail to verify with invalid withdrawable epoch")` — assertions: claiming `withdrawableEpoch = 0` reverts with "Invalid withdrawable proof".
- `it("Fail to verify with zero padded withdrawable epoch proof")` — assertions: 1696 zero bytes as proof reverts with "Invalid withdrawable proof".

**describe: "Beacon chain proofs" > "Validator withdrawable epoch to beacon block root proof" > "when validator is exiting"** (constants from Hoodi slot 1062956: `beaconRoot`, `validatorIndex = 1187281`, proof whose first node encodes epoch 0x74d2, `withdrawableEpoch = 30162`)
- `it("Should verify")` — assertions: `verifyValidatorWithdrawable(beaconRoot, 1187281, 30162, proof)` succeeds for an exiting validator with a finite withdrawable epoch.
- `it("Fail to verify with invalid withdrawable epoch")` — assertions: `withdrawableEpoch + 1` (30163) reverts with "Invalid withdrawable proof".

**describe: "Beacon chain proofs" > "Pending deposit container to beacon block root proof"** (shared constants: real `beaconRoot`, `pendingDepositContainerLeaf`, 288-byte proof)
- `it("Should verify")` — assertions: `verifyPendingDepositsContainer(beaconRoot, pendingDepositContainerLeaf, proof)` succeeds with valid fixture data.
- `it("Fail to verify with zero beacon block root")` — assertions: `beaconRoot = ZERO_BYTES32` reverts with "Invalid block root".
- `it("Fail to verify with invalid beacon block root")` — assertions: beacon root with last byte changed to `bb` reverts with "Invalid deposit container proof".
- `it("Fail to verify with zero padded proof")` — assertions: 288 zero bytes as proof reverts with "Invalid deposit container proof".
- `it("Fail to verify with invalid proof")` — assertions: proof with last byte changed to `aa` reverts with "Invalid deposit container proof".
- `it("Fail to verify with invalid pending deposit container root")` — assertions: container leaf with last byte changed to `aa` reverts with "Invalid deposit container proof".

**describe: "Beacon chain proofs" > "Pending deposit in pending deposit container proof"** (shared constants: `pendingDepositsContainerRoot` (same value as the container leaf in the previous block), `depositIndex = 2`, `pendingDepositRoot`, 1248-byte proof)
- `it("Should verify")` — assertions: `verifyPendingDeposit(pendingDepositsContainerRoot, pendingDepositRoot, proof, 2)` succeeds.
- `it("Fail to verify with incorrect pending deposit root")` — assertions: deposit root with last byte changed to `aa` reverts with "Invalid deposit proof".
- `it("Fail to verify with zero container root")` — assertions: container root = `ZERO_BYTES32` reverts with "Invalid root".
- `it("Fail to verify with incorrect container root")` — assertions: container root with last byte changed to `aa` reverts with "Invalid deposit proof".
- `it("Fail to verify with zero padded proof")` — assertions: 1248 zero bytes as proof reverts with "Invalid deposit proof".
- `it("Fail to verify with invalid deposit index")` — assertions: `depositIndex + 1` (3) reverts with "Invalid deposit proof".
- `it("Fail to verify a pending deposit index that is too big")` — assertions: `depositIndex = 2^27` (BigNumber, one past the max pending-deposit-list index) reverts with "Invalid deposit index" (bounds check fires before Merkle verification).

**describe: "Beacon chain proofs" > "First pending deposit to beacon block root proof" > "for verifyDeposit which only checks the deposit slot" > "with pending deposit"** (constants from Ethereum slot 11787450: `beaconRoot`, first-pending-deposit `slot = 17043450`, 1280-byte proof)
- `it("Should verify")` — assertions: `verifyFirstPendingDeposit(beaconRoot, slot, proof)` succeeds and returns `isEmpty === false` (deposit queue is non-empty and the claimed slot matches the first pending deposit).
- `it("Fail to verify with zero beacon block root")` — assertions: `beaconRoot = ZERO_BYTES32` reverts with "Invalid block root".
- `it("Fail to verify with invalid beacon block root")` — assertions: an incorrect beacon root (unrelated hex ending in `aa`) reverts with "Invalid deposit slot proof".
- `it("Fail to verify with zero padded proof")` — assertions: 1280 zero bytes as proof reverts with "Invalid deposit slot proof".
- `it("Fail to verify with incorrect slot")` — assertions: `slot + 1` reverts with "Invalid deposit slot proof".

**describe: "Beacon chain proofs" > "First pending deposit to beacon block root proof" > "for verifyDeposit which only checks the deposit slot" > "with no pending deposit"** (constants from Hoodi slot 1015023 where the pending-deposit queue is empty: `beaconRoot`, `slot = 0`, 1184-byte proof of the empty deposits list)
- `it("Should verify with zero slot")` — assertions: `verifyFirstPendingDeposit(beaconRoot, 0, proof)` succeeds and returns `isEmpty === true`.
- `it("Should verify with non-zero slot")` — assertions: with an arbitrary non-zero slot (12345678) and the same empty-queue proof, the call still succeeds and returns `isEmpty === true` (the claimed slot is ignored when the queue is proven empty).
- `it("Fail to verify with zero beacon root")` — assertions: `beaconRoot = ZERO_BYTES32` reverts with "Invalid block root".
- `it("Fail to verify with invalid beacon root")` — assertions: beacon root with first byte changed to `aa` reverts with "Invalid empty deposits proof".
- `it("Fail to verify with zero padded proof")` — assertions: 1184 zero bytes as proof reverts with "Invalid empty deposits proof".

---

### `test/beacon/beaconProofs.mainnet.fork-test.js` — fork test (mainnet)

Context: `loadFixture = createFixtureLoader(beaconChainFixture)`; on fork the fixture resolves the **deployed production `BeaconProofs` contract** (from `deployments/mainnet`) as `fixture.beaconProofs` and replaces the code at `addresses.mainnet.beaconRoots` with `MockBeaconRoots`. A `before` hook fetches a real beacon block: `pastSlot = floor((currentSlot - 1000)/1000)*1000` (old enough to pre-date the local fork, recent enough to still be in the EIP-4788 ring buffer), loads `{blockView, blockTree, stateView}` via `getBeaconBlock(pastSlot)` (`utils/beacon.js`), and computes `beaconBlockRoot = blockView.hashTreeRoot()`. All proofs are generated live from that block via the generators in `utils/proofs.js`. Hard-coded subjects: `activeValidatorIndex = 1938267` (0x02 withdrawal credential `0x0200...84750fc0837b32afdde943051b2634d05ced8e15`), `exitedValidatorIndex = 1998612` (withdrawable epoch 384221). `this.timeout(0)`.

**describe: "ForkTest: Beacon Proofs"**
- `it("Should verify validator public key")` — assertions: generates `{proof, leaf, pubKey}` via `generateValidatorPubKeyProof` for validator 1938267; asserts `hashPubKey(pubKey)` equals the generated leaf; then `verifyValidator(beaconBlockRoot, pubKeyHash, proof, 1938267, activeValidatorWithdrawalCredential)` succeeds (no revert) against the deployed BeaconProofs contract.
- `it("Should verify validator withdrawable epoch that is not exiting")` — assertions: via shared helper `assertValidatorWithdrawableEpoch(1938267)`: generates `{proof, withdrawableEpoch}` with `generateValidatorWithdrawableEpochProof`, calls `verifyValidatorWithdrawable(beaconBlockRoot, 1938267, withdrawableEpoch, proof)` (must not revert), and asserts the returned/generated `withdrawableEpoch` equals `MAX_UINT64` (active validator, far-future epoch).
- `it("Should verify validator withdrawable epoch that has exited")` — assertions: same helper for validator 1998612; on-chain verification succeeds and the generated `withdrawableEpoch` equals exactly 384221 (the known exit epoch of that validator).
- `it("Should verify balances container")` — assertions: `generateBalancesContainerProof({blockView, blockTree, stateView})` produces `{proof, leaf}`; `verifyBalancesContainer(beaconBlockRoot, leaf, proof)` succeeds.
- `it("Should verify validator balance in balances container")` — assertions: `generateBalanceProof(... validatorIndex: 1938267)` produces `{proof, leaf, root}` (root = balances container root); `verifyValidatorBalance(root, leaf, proof, 1938267)` succeeds (no assertion on the returned balance value).
- `it("Should verify pending deposits container")` — assertions: `generatePendingDepositsContainerProof` produces `{proof, leaf}`; `verifyPendingDepositsContainer(beaconBlockRoot, leaf, proof)` succeeds.
- `it("Should verify a pending deposit in pending deposits container")` — assertions: for `depositIndex = 2` (comment notes it fails if the live deposit queue has fewer than 3 entries), `generatePendingDepositProof` produces `{proof, leaf, root}`; `verifyPendingDeposit(root, leaf, proof, 2)` succeeds.
- `it("Should verify the slot of the first pending deposit in the beacon block")` — assertions: `generateFirstPendingDepositSlotProof` produces `{proof, slot, root}`; `verifyFirstPendingDeposit(root, slot, proof)` succeeds (return value not asserted).

---

### `test/beacon/beaconRoots.mainnet.fork-test.js` — fork test (mainnet)

Context: no fixture. `beforeEach` builds an `ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)` pointed at **real mainnet, not the local fork**, and connects to the hardhat-deploy `MockBeaconRoots` deployment (deployed on mainnet at `0x4A50Bb6153965B94eB59882D80BCC7Db146212E6`), which wraps the `BeaconRoots` library reading the EIP-4788 beacon-roots precompile. All calls are read-only `eth_call`s against live mainnet, so the ~8191-slot (~27h) EIP-4788 ring buffer reflects real history. `bytes32` regex from `utils/regex.js` is used to validate returned roots. `this.timeout(0)`.

**describe: "ForkTest: Beacon Roots"**
- `it("Should get the latest beacon root")` — assertions: `latestBlockRoot()` returns a result whose `parentRoot` matches the `bytes32` regex (a well-formed non-trivial 32-byte hex root).
- `it("Should to get beacon root from the current block")` — assertions: fetches the current mainnet block via the provider and asserts `parentBlockRoot(currentBlock.timestamp)` matches the `bytes32` regex.
- `it("Should to get beacon root from the previous block")` — assertions: fetches block `currentBlockNumber - 1` and asserts `parentBlockRoot(previousBlock.timestamp)` matches the `bytes32` regex.
- `it("Should get beacon root from old block")` — assertions: fetches block `currentBlockNumber - 1000` (~3.3h old, still inside the ring buffer) and asserts `parentBlockRoot(olderTimestamp)` matches the `bytes32` regex.
- `it("Fail to get beacon root from block older than the buffer")` — assertions: fetches block `currentBlockNumber - 10000` (~33h old, outside the ~27h EIP-4788 ring buffer) and asserts `parentBlockRoot(previousTimestamp)` reverts (generic `.to.be.reverted`, no reason string asserted).

---

## Pool boosters: Curve, SwapX, Merkl, Metropolis, Shadow (mainnet/sonic fork)

Fork tests for the pool-booster subsystem: factory contracts that CREATE2/beacon-deploy per-AMM-pool "booster" contracts, the `PoolBoostCentralRegistry` that tracks approved factories and emits creation/removal events, and the booster contracts themselves whose `bribe()` forwards accumulated OToken (OETH on mainnet, OS on Sonic, OUSD for the Curve booster) to external incentive systems (Merkl campaign creator, SwapX/Ichi bribe contracts, Metropolis rewarder, Shadow gauge, StakeDAO Votemarket via cross-chain CampaignRemoteManager). Mainnet suites use `defaultFixture` / `poolBoosterCodeUpdatedFixture` from `test/_fixture.js`; Sonic suites use `defaultSonicFixture` from `test/_fixture-sonic.js`. No shared behaviour suites from `test/behaviour/` are consumed; no tests are skipped (one describe carries a TODO comment about un-skipping, but it is active).

Files covered:
- `test/poolBooster/poolBooster.mainnet.fork-test.js` (55 tests)
- `test/poolBooster/poolBooster.sonic.fork-test.js` (24 tests)
- `test/poolBooster/curve/curvePoolBooster.mainnet.fork-test.js` (31 tests)
- `test/poolBooster/metropolis-pool-booster.sonic.fork-test.js` (3 tests)
- `test/poolBooster/shadow-pool-booster.sonic.fork-test.js` (1 test)

Total: 114 `it()` blocks.

### `test/poolBooster/poolBooster.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `createFixtureLoader(defaultFixture)` from `test/_fixture.js`. Contracts under test: `PoolBoosterFactoryMerkl` (`fixture.poolBoosterMerklFactory`), `PoolBoosterMerklV2` beacon-proxy instances, the factory's `UpgradeableBeacon`, `PoolBoostCentralRegistry` (`fixture.poolBoosterCentralRegistry`), plus Merkl `DistributionCreator` (`fixture.merklDistributor`), OETH, WETH and the OETH Vault.

Top-level `beforeEach`: impersonates+funds `addresses.multichainStrategist` as `governor`; if the central registry's governor is not yet the strategist it calls `claimGovernance()` (completing the transfer started in deploy script 176); approves `poolBoosterMerklFactory` in the registry if not already approved; fetches the beacon from the factory and transfers beacon ownership to the multichainStrategist (impersonating the current owner) if needed. Constants: `DEFAULT_DURATION = 604800` (7 days), `DEFAULT_CAMPAIGN_TYPE = 45`, `DEFAULT_CAMPAIGN_DATA = "0xc0c0c0"`, `MERKL_BOOSTER_TYPE = 3` (registry enum `MerklBooster`). Helpers: `mintOeth(recipient, amount)` funds ETH, wraps to WETH, mints OETH via the vault; `encodeInitData(overrides)` encodes `initialize(uint32 duration, uint32 campaignType, address rewardToken=OETH, address merklDistributor=mainnet.CampaignCreator, address governor=mainnet.Guardian, address strategist=multichainStrategist, bytes campaignData)`; `createPoolBooster(salt, ammPool?, initOverrides?)` calls `createPoolBoosterMerkl(pool, initData, salt)` as governor (pool defaults to the salt zero-padded to an address) and returns the `PoolBoosterMerklV2` instance from `poolBoosterFromPool`; `getExistingPoolBoosterAddresses()` enumerates the factory's `poolBoosters` array (used to exclude pre-existing mainnet boosters from `bribeAll`).

**describe: "ForkTest: Merkl Pool Booster" > "Factory: Deployment & initial state"**
- `it("Should have correct beacon (non-zero)")` — asserts `factory.beacon()` != zero address.
- `it("Should have correct governor")` — asserts `factory.governor()` equals `addresses.multichainStrategist`.
- `it("Should have OETH token supported by Merkl Distributor")` — asserts `merklDistributor.rewardTokenMinAmounts(oeth)` > 0 (OETH is whitelisted as a Merkl reward token on the fork).

**describe: "ForkTest: Merkl Pool Booster" > "Factory: createPoolBoosterMerkl"**
- `it("Should create a proxy with correct params")` — governor creates a booster for pool `0x…0100` with salt 100; asserts `poolBoosterFromPool(pool)` returns non-zero `boosterAddress`, `ammPoolAddress == pool`, `boosterType == 3` (MerklBooster); asserts the tx emits `PoolBoosterCreated` on the central registry.
- `it("Should initialize proxy with correct parameters")` — creates a booster (salt 200) and asserts all initialize params round-trip: `duration() == 604800`, `campaignType() == 45`, `rewardToken() == OETH`, `merklDistributor() == mainnet.CampaignCreator`, `governor() == mainnet.Guardian`, `strategistAddr() == multichainStrategist`, `factory() == poolBoosterMerklFactory`.
- `it("Should match computePoolBoosterAddress")` — calls `computePoolBoosterAddress(salt=300, initData)` before creation; after creating with the same salt/initData asserts the registered `boosterAddress` equals the precomputed address.
- `it("Should revert when creating duplicate for same AMM pool")` — creates a booster for a pool, then a second create for the same pool (different salt) reverts with `"Pool booster already exists"`.
- `it("Should revert with zero ammPoolAddress")` — `createPoolBoosterMerkl(address(0), …)` reverts with `"Invalid ammPoolAddress address"`.
- `it("Should revert with zero salt")` — salt 0 reverts with `"Invalid salt"`.
- `it("Should revert when called by non-governor")` — `anna` calling create reverts with `"Caller is not the Governor"`.

**describe: "ForkTest: Merkl Pool Booster" > "Beacon: upgradeTo"**
- `it("Should upgrade beacon and affect existing proxies")` — creates a booster (asserts `VERSION() == "1.0.0"`), deploys a fresh `PoolBoosterMerklV2` implementation via `deployWithConfirmation`, calls `beacon.upgradeTo(newImpl)` as governor; asserts `Upgraded` event with the new impl address; asserts the existing proxy still works through the new implementation (`VERSION()` still "1.0.0", `duration()` still 604800 — proxy state preserved).
- `it("Should revert upgradeTo with non-contract address")` — `upgradeTo(anna.address)` reverts with `"UpgradeableBeacon: implementation is not a contract"`.
- `it("Should revert upgradeTo when called by non-governor")` — `anna` calling `upgradeTo` on a valid new impl reverts with `"Ownable: caller is not the owner"`.

**describe: "ForkTest: Merkl Pool Booster" > "PoolBoosterMerklV2: Initialization"**
- `it("Should not allow double initialization")` — calling `initialize(…)` again on a created booster (as its governor, the mainnet Guardian) reverts with `"Initializable: contract is already initialized"`.
- `it("Should revert with invalid duration (≤ 1 hour)")` — creating with `duration: 3600` reverts (generic `.to.be.reverted`, no reason string checked — revert bubbles through the factory create).
- `it("Should revert with zero rewardToken")` — creating with `rewardToken: address(0)` reverts (generic).
- `it("Should revert with zero merklDistributor")` — creating with `merklDistributor: address(0)` reverts (generic).
- `it("Should revert with zero campaignType")` — creating with `campaignType: 0` reverts (generic).
- `it("Should revert with empty campaignData")` — creating with `campaignData: "0x"` reverts (generic).
- `it("Should not allow initialize on implementation contract")` — reads `beacon.implementation()` and calls `initialize` directly on the raw implementation; reverts with `"Initializable: contract is already initialized"` (implementation is locked).

**describe: "ForkTest: Merkl Pool Booster" > "PoolBoosterMerklV2: Setters"**
(beforeEach: creates booster with salt 500; `pbGovernor` = impersonated mainnet Guardian, `pbStrategist` = impersonated multichainStrategist.)
- `it("Should setDuration and emit event")` — governor sets duration to 14 days (86400*14); asserts `DurationUpdated` event with the new value and `duration()` state update.
- `it("Should revert setDuration if ≤ 1 hour")` — `setDuration(3600)` reverts with `"Invalid duration"`.
- `it("Should revert setDuration if non-governor/strategist")` — `anna` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should setCampaignType and emit event")` — strategist sets campaignType to 99; asserts `CampaignTypeUpdated(99)` event and state.
- `it("Should revert setCampaignType with zero value")` — `setCampaignType(0)` reverts with `"Invalid campaignType"`.
- `it("Should revert setCampaignType if non-governor/strategist")` — `anna` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should setRewardToken and emit event")` — governor sets reward token to mainnet WETH; asserts `RewardTokenUpdated(WETH)` event and state.
- `it("Should revert setRewardToken with zero address")` — reverts with `"Invalid rewardToken address"`.
- `it("Should revert setRewardToken if non-governor/strategist")` — `anna` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should setMerklDistributor and emit event")` — governor sets distributor to mainnet.CampaignCreator; asserts `MerklDistributorUpdated` event with the address and state.
- `it("Should revert setMerklDistributor with zero address")` — reverts with `"Invalid merklDistributor addr"`.
- `it("Should revert setMerklDistributor if non-governor/strategist")` — `anna` reverts with `"Caller is not the Strategist or Governor"`.
- `it("Should setCampaignData and emit event")` — strategist sets campaignData to `0xdeadbeef`; asserts `CampaignDataUpdated(0xdeadbeef)` event and state.
- `it("Should revert setCampaignData with empty data")` — `setCampaignData("0x")` reverts with `"Invalid campaign data"`.
- `it("Should revert setCampaignData if non-governor/strategist")` — `anna` reverts with `"Caller is not the Strategist or Governor"`.

**describe: "ForkTest: Merkl Pool Booster" > "PoolBoosterMerklV2: bribe()"**
(beforeEach: creates booster with salt 600; same pbGovernor/pbStrategist impersonations.)
- `it("Should skip when balance < MIN_BRIBE_AMOUNT")` — with 0 OETH balance, `bribe()` (as governor) succeeds silently; asserts no `BribeExecuted` event emitted.
- `it("Should skip when balance insufficient for duration")` — funds the booster with 1e11 wei OETH (above the 1e10 MIN_BRIBE_AMOUNT but failing the `balance * 1 hours < minAmount * duration` threshold); `bribe()` as strategist emits no `BribeExecuted` and booster balance remains >= 1e11.
- `it("Should execute campaign creation when funded")` — mints 100 OETH to anna, transfers 10 OETH to the booster; `bribe()` as governor emits `BribeExecuted(balance)` (full pre-bribe balance) and booster OETH balance is exactly 0 afterwards (Merkl campaign created).
- `it("Should revert when called by random address")` — `anna` calling `bribe()` reverts with `"Not governor, strategist, fctry"`.

**describe: "ForkTest: Merkl Pool Booster" > "PoolBoosterMerklV2: rescueToken()"**
(beforeEach: creates booster with salt 700; pbGovernor = impersonated Guardian.)
- `it("Should rescue tokens to receiver")` — funds the booster with 5 OETH; governor calls `rescueToken(oeth, matt)`; asserts `TokensRescued(oeth, fullBoosterBalance, matt)` event, matt's OETH balance increased, and booster balance == 0.
- `it("Should revert with zero receiver")` — `rescueToken(oeth, address(0))` reverts with `"Invalid receiver"`.
- `it("Should revert when called by non-governor")` — `anna` calling `rescueToken` reverts with `"Caller is not the Governor"`.

**describe: "ForkTest: Merkl Pool Booster" > "Factory: removePoolBooster & bribeAll"**
- `it("Should remove a pool booster")` — creates two boosters (pools `0x…01`, `0x…02`); governor calls `removePoolBooster(booster1)`; asserts `PoolBoosterRemoved` emitted on the central registry, `poolBoosterLength()` decremented by 1, and `poolBoosterFromPool(pool1).boosterAddress` zeroed out.
- `it("Should revert removePoolBooster when called by non-governor")` — `anna` reverts with `"Caller is not the Governor"`.
- `it("Should revert removePoolBooster when address not found")` — governor removing `anna.address` reverts with `"Pool booster not found"`.
- `it("Should remove a pool booster by index")` — creates two boosters, finds pool1's index by scanning the `poolBoosters` array, governor calls `removePoolBoosterByIndex(index)`; asserts `PoolBoosterRemoved` on the registry, length decremented by 1, and pool1's mapping entry zeroed.
- `it("Should revert removePoolBoosterByIndex with out of bounds index")` — index == current `poolBoosterLength()` reverts with `"Index out of bounds"`.
- `it("Should revert removePoolBoosterByIndex when called by non-governor")` — after creating a booster, `anna` calling `removePoolBoosterByIndex(0)` reverts with `"Caller is not the Governor"`.
- `it("Should bribeAll and skip exclusion list")` — creates and funds a booster with 10 OETH, then calls `bribeAll([existingBoosters..., newBooster])` (new booster on the exclusion list along with all pre-existing mainnet boosters); asserts the booster's OETH balance is unchanged (bribe skipped).
- `it("Should bribeAll and execute bribes on funded pool boosters")` — creates and funds a booster with 10 OETH; calls `bribeAll(existingBoosters)` (excluding only pre-existing boosters whose reward tokens may not be Merkl-approved in fork state); asserts `BribeExecuted(balance)` emitted by the new booster and its balance drops to 0.
- `it("Should revert bribeAll when called by non-governor")` — `anna` calling `bribeAll([])` reverts with `"Caller is not the Governor"`.

**describe: "ForkTest: Merkl Pool Booster" > "Beacon: state"**
- `it("Should return the current implementation address")` — `beacon.implementation()` is non-zero and has deployed code (`getCode` length > 2).
- `it("Should have correct owner")` — `beacon.owner()` equals `addresses.multichainStrategist` (set in the top-level beforeEach).

**describe: "ForkTest: Merkl Pool Booster" > "Factory: pool booster tracking"**
- `it("Should track multiple pool boosters correctly")` — creates 3 boosters for pools `0x…11/12/13`; asserts `poolBoosterLength()` grew by exactly 3 and each `poolBoosterFromPool(poolN).ammPoolAddress` maps back to its pool.
- `it("Should access poolBoosters array by index")` — creates one booster; asserts the last array entry (`poolBoosters(length-1)`) has the expected `ammPoolAddress` and `boosterType == 3`.

**describe: "ForkTest: Merkl Pool Booster" > "PoolBoosterMerklV2: bribe() via factory"**
- `it("Should allow factory to call bribe()")` — creates and funds a booster with 10 OETH; `bribeAll(existingBoosters)` (factory is the caller of the booster's `bribe()`, exercising the "fctry" auth branch); asserts `BribeExecuted(balance)` emitted by the booster.

### `test/poolBooster/poolBooster.sonic.fork-test.js` — fork test (sonic)

Fixture: `createFixtureLoader(defaultSonicFixture)` from `test/_fixture-sonic.js`, plus its helpers `filterAndParseRewardAddedEvents` and `getPoolBoosterContractFromPoolAddress`. Contracts under test: `PoolBoosterFactorySwapxDouble` (`fixture.poolBoosterDoubleFactoryV1`), `PoolBoosterFactorySwapxSingle` (`fixture.poolBoosterSingleFactoryV1`), the deployed SwapX Double booster for the SwapX OS/USDC.e Ichi pool, and `PoolBoostCentralRegistry`. Top-level `beforeEach`: nick mints 1000 OS via the OSonic vault; `strategist` = impersonated+funded `addresses.multichainStrategist`.

**describe: "ForkTest: Pool Booster"**
- `it("Should have the correct initial state")` — asserts `poolBoosterDoubleFactoryV1.oSonic()` equals the OS token address and `governor()` equals `addresses.multichainStrategist`.

**describe: "ForkTest: Pool Booster" > "ForkTest: Specific pool boosters deployed"** — loop over a `factoryConfigs` array (currently one entry: name "First Ichi Factory", factory `poolBoosterDoubleFactoryV1`, ammPool `addresses.sonic.SwapXOsUSDCe.pool`, bribe contracts `extBribeOS`/`extBribeUSDC`, split 0.7); each config generates 3 tests with the name interpolated:
- `it("Should have the First Ichi Factory's pool booster correctly configured")` — asserts `poolBoosterFromPool(ammPool)` has `boosterType == 0` (SwapXDoubleBooster enum) and `ammPoolAddress == ammPool`; on the booster contract asserts `osToken() == OS`, `bribeContractOS() == extBribeOS`, `bribeContractOther() == extBribeUSDC`, and `split() == oethUnits("0.7")` (70%).
- `it("Should call bribe on the First Ichi Factory's pool booster to send incentives to the 2 Ichi bribe contracts ")` — nick transfers 10 OS to the booster; `bribe()` emits exactly 2 `RewardAdded` events (parsed via fixture helper), both with `rewardToken == OS`, amounts `approxEqual` to balance×0.7 and balance×0.3, and booster balance == 0 after. Then transfers 1e9 wei OS (below the 1e10 min-bribe amount) and calls `bribe()` again: 0 `RewardAdded` events, and booster balance stays between 1e9 and 1e9+1 (nothing bribed; bound tolerance for rebasing rounding).
- `it("Should call bribeAll on First Ichi Factory's to send incentives to the 2 Ichi bribe contracts")` — same funding of 10 OS, but via `factory.bribeAll([])`; asserts the 2 `RewardAdded` events (OS token, ~70%/~30% split via `approxEqual`) and booster balance == 0.
- `it("Should skip pool booster bribe call when pool booster on exclusion list")` — funds the OS/USDC.e booster with 10 OS, calls `bribeAll([boosterAddress])`; asserts booster OS balance is unchanged (excluded, no bribe).
- `it("Should be able to remove a pool booster")` — strategist creates an extra Double booster (SwapXOsGEMSx pool, both bribe addresses = `SwapXOsUSDCeMultisigBooster`, split 0.5, salt 1) so it sits last in the factory array; strategist then calls `removePoolBooster(osUsdcePoolBooster)`; asserts `PoolBoosterRemoved(boosterAddress)` emitted by the central registry with exact args, `poolBoosterLength()` decremented by 1, `poolBoosterFromPool(SwapXOsUSDCe.pool).boosterAddress == 0`; then verifies the swap-and-pop copied the last entry correctly: the OsGEMSx entry has non-zero `boosterAddress`, correct `ammPoolAddress`, and `boosterType == 0`.
- `it("Should be able to create an Ichi pool booster")` — strategist calls `createPoolBoosterSwapxDouble(extBribeOS, extBribeUSDC, SwapXOsGEMSx.pool, split=0.5e18, salt=1e18)`; asserts `PoolBoosterCreated(boosterAddress, SwapXOsGEMSx.pool, 0 /* SwapXDoubleBooster */, factoryAddress)` emitted by the central registry with exact args; on the new booster asserts `osToken() == OS`, `bribeContractOS()`, `bribeContractOther()`, and `split() == oethUnits("0.5")`.
- `it("When creating Double pool booster the computed and actual deployed address should match")` — creates a Double booster (salt 1337e18) and asserts the deployed booster address equals `computePoolBoosterAddress(...)` with the same creation params.
- `it("When creating Single pool booster the computed and actual deployed address should match")` — governor creates a Single booster via `poolBoosterSingleFactoryV1.createPoolBoosterSwapxSingle(extBribeOS, SwapXOsGEMSx.pool, salt=12345e18)`; asserts deployed address equals `computePoolBoosterAddress(...)`.
- `it("Should be able to create a pair pool booster")` — governor creates a Single booster (salt 1e18); asserts `PoolBoosterCreated(boosterAddress, SwapXOsGEMSx.pool, 1 /* SwapXSingleBooster */, singleFactoryAddress)` with exact args; asserts `osToken() == OS` and `bribeContract() == extBribeOS`.

**describe: "ForkTest: Pool Booster" > "Should test require checks"**
- `it("Should throw an error when invalid params are passed to swapx pair booster creation function")` — nine sequential revert assertions: Single factory (as `timelock`): zero `bribeAddress` → `"Failed creating a pool booster"` (constructor revert bubbled), zero `ammPoolAddress` → `"Invalid ammPoolAddress address"`, zero salt → `"Invalid salt"`; Double factory (as strategist): zero `ammPoolAddress` → `"Invalid ammPoolAddress address"`, zero `bribeAddressOS` → `"Failed creating a pool booster"`, zero `bribeAddressOther` → `"Failed creating a pool booster"`, split = 1e18 → `"Failed creating a pool booster"` (split must be < 1), split = 0.009e18 → `"Failed creating a pool booster"` (split must be ≥ 1%), zero salt → `"Invalid salt"`.
- `it("Should throw an error when non governor is trying to create a pool booster")` — nick calling `createPoolBoosterSwapxSingle` and `createPoolBoosterSwapxDouble` both revert with `"Caller is not the Governor"`.

**describe: "ForkTest: Pool Booster" > "Should test the central registry"**
- `it("Governor should be able to add a new factory address")` — governor calls `approveFactory(someAddress)` (uses `extBribeOS` as a stand-in address); asserts `FactoryApproved(address)` event with exact arg and `isApprovedFactory == true`.
- `it("Governor should be able to remove a factory address")` — approves then `removeFactory`; asserts `isApprovedFactory` flips true → false and `FactoryRemoved(address)` event with exact arg.
- `it("Non governor shouldn't be allowed to add or remove pool boosters")` — nick calling `approveFactory` and `removeFactory` both revert with `"Caller is not the Governor"`.
- `it("Governor should be able to remove a factory address")` — (duplicate test name; actually tests double-approval) approves a factory, then approving the same address again reverts with `"Factory already approved"`.
- `it("Can not approve a zero address factory")` — `approveFactory(address(0))` reverts with `"Invalid address"`.
- `it("Can not remove a zero address factory")` — `removeFactory(address(0))` reverts with `"Invalid address"`.
- `it("Can not remove a factory that hasn't been approved")` — `removeFactory(unapproved)` reverts with `"Not an approved factory"`.
- `it("Can not call emit pool booster created if not a factory")` — nick calling `emitPoolBoosterCreated(0,0,0)` reverts with `"Not an approved factory"`.
- `it("Can not call emit pool booster removed if not a factory")` — nick calling `emitPoolBoosterRemoved(0)` reverts with `"Not an approved factory"`.

**describe: "ForkTest: Pool Booster" > "Deploying the new pool boosters"** — constructor guards of `PoolBoosterFactorySwapxSingle`, deployed fresh via `deployWithConfirmation`:
- `it("Can not deploy a factory with zero sonic address")` — constructor args `(address(0), timelock, centralRegistry)` revert with `"Invalid oToken address"`.
- `it("Can not deploy a factory with zero governor address")` — `(OSonicProxy, address(0), centralRegistry)` reverts with `"Invalid governor address"`.
- `it("Can not deploy a factory with zero central registry address")` — `(OSonicProxy, timelock, address(0))` reverts with `"Invalid central registry address"`.

### `test/poolBooster/curve/curvePoolBooster.mainnet.fork-test.js` — fork test (mainnet)

Fixture: `createFixtureLoader(poolBoosterCodeUpdatedFixture)` from `test/_fixture.js` (fixture that hot-swaps the deployed booster's code to the latest compiled version). Contracts under test: `CurvePoolBooster` (`fixture.curvePoolBooster`, the OUSD/USDT Curve gauge booster that bridges rewards to StakeDAO Votemarket on Arbitrum via `CampaignRemoteManager`) and `CurvePoolBoosterFactory` (`fixture.curvePoolBoosterFactory`, CreateX-based). Suite sets `this.timeout(0)` and `this.retries(3)` on CI. `beforeEach`: strategist signer = `multichainStrategistAddr` named account; `sGov` = signer for `curvePoolBooster.governor()` (the mainnet Timelock); `woethSigner` = impersonated `wousd` contract address (used as an OUSD whale — variable/comment names say "OETH" but the token is OUSD); `curvePoolBoosterImpersonated` = impersonated booster address; then `setCampaignId(0)` as strategist. Helper `dealOETHAndCreateCampaign()`: empties any existing booster OUSD balance to the strategist, transfers 10 OUSD from `woethSigner` to the booster (asserts balance == 10), then strategist calls `createCampaign(numberOfPeriods=4, maxRewardPerVote=10, blacklist=[mainnet.ConvexVoter], additionalGasLimit=0)` with 0.1 ETH `value` (cross-chain bridge fee).

**describe: "ForkTest: CurvePoolBooster"**
- `it("Should have correct params")` — asserts deployed config: `gauge() == mainnet.CurveOUSDUSDTGauge`, `campaignRemoteManager() == 0x000000009dF57105d76B059178989E01356e4b45`, `rewardToken() == mainnet.OUSDProxy`, `targetChainId() == 42161` (Arbitrum), `strategistAddr() == multichainStrategist`, `governor() == mainnet.Timelock`, `votemarket() == 0x5e5C922a5Eeab508486eB906ebE7bDFFB05D81e5`.
- `it("Should Create a campaign")` — runs `dealOETHAndCreateCampaign()`; asserts booster OUSD balance == 0 after (all 10 OUSD bridged into the campaign).
- `it("Should Create a campaign with fee")` — governor sets `setFee(1000)` (10%) and `setFeeCollector(josh)` (josh starts with 0 OUSD); after `dealOETHAndCreateCampaign()`, asserts josh's OUSD balance >= 1 (10% of 10 OUSD collected as fee).
- `it("Should manage total rewards")` — after campaign creation, transfers 13 more OUSD to the booster (asserts balance == 13), sets campaignId to 12, then `manageCampaign(type(uint256).max, 0, 0, 0)` with 0.1 ETH (max = "send all tokens"); asserts booster OUSD balance == 0.
- `it("Should manage number of periods")` — after campaign creation and `setCampaignId(12)`, calls `manageCampaign(0, 2, 0, 0)` with 0.1 ETH; asserts only that the call succeeds (period-count update path).
- `it("Should manage reward per voter")` — after campaign creation and `setCampaignId(12)`, calls `manageCampaign(0, 0, 100, 0)` with 0.1 ETH; asserts only success (maxRewardPerVote update path).
- `it("Should close a campaign")` — after campaign creation, strategist calls `closeCampaign(12, 0)` with 0.1 ETH; asserts only success.
- `it("Should revert if not called by operator")` — unauthed default signer calling `createCampaign`, `manageCampaign`, and `setCampaignId` all revert with `"Caller is not the Strategist or Governor"`.
- `it("Should revert if campaign is already created")` — after `setCampaignId(12)`, strategist's `createCampaign(4, 10, [ConvexVoter], 0)` reverts with `"Campaign already created"`.
- `it("Should create another campaign if campaign is closed")` — sets campaignId to 12, calls `closeCampaign(12, 0)` (0.1 ETH); asserts `campaignId()` reset to 0; then `createCampaign(4, 10, [ConvexVoter], 0)` (0.1 ETH) succeeds.
- `it("Should revert if campaign is not created")` — `manageCampaign(max, 0, 0, 0)` with campaignId still 0 reverts with `"Campaign not created"`.
- `it("Should revert if Invalid number of periods")` — `createCampaign` with `numberOfPeriods` 0 and 1 both revert with `"Invalid number of periods"` (requires > 1; note comment: `manageCampaign` with 0 periods means "no update" so does not revert).
- `it("Should revert if Invalid reward per vote")` — `createCampaign(4, 0, …)` reverts with `"Invalid reward per vote"` (note: `manageCampaign` with 0 means "no update").
- `it("Should rescue ETH")` — force-sets booster ETH balance to 1 ETH via `hardhat_setBalance` (contract has no `receive()`); strategist calls `rescueETH(strategist)`; asserts pre-balance >= 1 ETH and post-balance == 0.
- `it("Should rescue ERC20")` — transfers 10 OUSD to the booster (asserts >= 10); governor calls `rescueToken(ousd, strategist)`; asserts booster OUSD balance == 0.
- `it("Should revert if receiver is invalid")` — `rescueToken(ousd, address(0))` and `rescueETH(address(0))` (as governor) both revert with `"Invalid receiver"`.
- `it("Should set campaign id")` — asserts `campaignId()` starts at 0; strategist `setCampaignId(12)`; asserts `campaignId() == 12`.
- `it("Should set fee and fee collector")` — asserts `fee()` starts 0; governor `setFee(100)` → `fee() == 100`; asserts `feeCollector()` != josh, governor `setFeeCollector(josh)` → `feeCollector() == josh`.
- `it("Should revert if fee too high")` — `setFee(10000)` (100%) reverts with `"Fee too high"`.
- `it("Should set Campaign Remote Manager")` — asserts initial `campaignRemoteManager()` is the hardcoded `0x…9dF57…4b45`; governor `setCampaignRemoteManager(josh)` → updated.
- `it("Should revert if campaign remote manager is invalid")` — `setCampaignRemoteManager(address(0))` reverts with `"Invalid campaignRemoteManager"`.
- `it("Should set Votemarket address")` — asserts initial `votemarket()` is `0x5e5C…81e5`; governor `setVotemarket(josh)` → updated.
- `it("Should revert if votemarket is invalid")` — `setVotemarket(address(0))` reverts with `"Invalid votemarket"`.

**describe: "ForkTest: CurvePoolBooster" > "Curve pool booster factory"** — active (not skipped), but carries a TODO comment: un-skip/re-point once the factory is deployed on mainnet via CreateX and update the address in `_fixture.js:poolBoosterCodeUpdatedFixture`. Local helpers: `computePoolBoosterAddress(saltNumber, gauge)` uses `factory.encodeSaltForCreateX` + `factory.computePoolBoosterAddress(OETHProxy, gauge, encodedSalt)`; `callCreatePoolBooster(...)` calls `createCurvePoolBoosterPlain(rewardToken=OETHProxy, gauge, feeCollector=multichainStrategist, fee=0, mainnet.CampaignRemoteManager, addresses.votemarket, encodedSalt, expectedAddress)` as strategist; `createPoolBoosterInstance(...)` executes it and extracts the implementation address from the CreateX `ContractCreation` log topic.
- `it("Shouldn't be allowed to call initialize on the factory again")` — governor calling `factory.initialize(Timelock, multichainStrategist)` reverts with `"Initializable: contract is already initialized"`.
- `it("Should produce matching encoded salt")` — asserts `factory.encodeSaltForCreateX(12345)` equals both the JS helper `encodeSaltForCreateX(factoryAddress, false, 12345)` from `utils/deploy` and the hardcoded literal `0x9f4308cdfa4d02c045bc8bd82864013b62d516bb000000000000000000003039` (deployer-address-prefixed CreateX salt).
- `it("Should not produce matching encoded salt")` — JS-encoded salt for 12346 does NOT equal the contract's encoding of 12345.
- `it("Should throw an exception if salt value too big")` — `encodeSaltForCreateX("309485009821345068724781056")` (> 88 bits) reverts with `"Invalid salt"`.
- `it("Should create a new pool booster instance")` — `createCurvePoolBoosterPlain` for salt 12345 / CurveOUSDUSDTGauge with `expectedAddress = address(0)` (no address check) succeeds; asserts only successful creation (implementation address parsed from CreateX event).
- `it("Should create a new pool booster instance with expected address")` — precomputes the address via `computePoolBoosterAddress(12345, gauge)` and passes it as `expectedAddress`; creation succeeds (on-chain expected-address check passes).
- `it("Should fail pool booster creation with an incorrect expected address")` — passing `addresses.dead` as expected address reverts with `"Pool booster deployed at unexpected address"`.
- `it("Should not create a new pool booster that doesn't have salt guarded with deployer address")` — passes a salt encoded with josh's address (not the factory) as the CreateX deployer guard; reverts with `"Front-run protection failed"`.

### `test/poolBooster/metropolis-pool-booster.sonic.fork-test.js` — fork test (sonic)

Fixture: `createFixtureLoader(defaultSonicFixture)`. Contracts under test: `PoolBoosterFactoryMetropolis` (`fixture.poolBoosterFactoryMetropolis`) and `PoolBoosterMetropolis` instances (bribe OS into a Metropolis rewarder). `beforeEach`: nick mints 1,000,000 OS via the OSonic vault; strategist = impersonated multichainStrategist. Helper `createPB(poolAddress, salt)`: strategist calls `createPoolBoosterMetropolis(pool, salt)` and returns the last entry of the factory's `poolBoosters` array as a `PoolBoosterMetropolis` contract. (File footer contains reference links to example Sonic txs for Rewarder creation and funding/bribe.)

**describe: "ForkTest: Metropolis Pool Booster"**
- `it("Should deploy a Pool Booster for a Metropolis pool")` — creates a booster for `addresses.sonic.Metropolis.Pools.OsMoon` (salt "1"); asserts `poolBoosterLength() == 2` (one pre-existing booster on the fork + the new one).
- `it("Should bribe 2 times in a row")` — creates the OsMoon booster; nick transfers 100,000 OS to it; `bribe()` asserted with custom matcher `emittedEvent("BribeExecuted", [oethUnits("100000")])` and booster OS balance == 0; then transfers 500,000 OS and bribes again, asserting `BribeExecuted` with 500,000e18 and balance == 0 (repeat bribes into the Metropolis rewarder work).
- `it("Should not bribe if amount is too small")` — two thresholds tested: (1) transfers 100 wei OS (below the immutable `MIN_BRIBE_AMOUNT`), `bribe()` is a no-op and balance stays exactly 100 wei; (2) transfers 1e12 wei OS (above MIN_BRIBE_AMOUNT but below the `minBribeAmount` required by the Metropolis reward factory), `bribe()` again no-ops and balance stays exactly 1,000,000,000,100 wei (cumulative).

### `test/poolBooster/shadow-pool-booster.sonic.fork-test.js` — fork test (sonic)

Fixture: `createFixtureLoader(defaultSonicFixture)`, plus `_fixture-sonic.js` helpers `filterAndParseNotifyRewardEvents` and `getPoolBoosterContractFromPoolAddress`. Contract under test: `PoolBoosterSwapxSingle` created via `poolBoosterSingleFactoryV1`, repurposed to bribe a Shadow gauge V2 (hardcoded S/WETH pool `0xb6d9…85d3` and gauge `0xF5C7…a837`). `beforeEach`: nick mints 1000 OS via the OSonic vault.

**describe: "ForkTest: Shadow Pool Booster (for S/WETH pool)"**
- `it("Should create a pool booster for Shadow and bribe")` — governor calls `createPoolBoosterSwapxSingle(gauge, pool, salt=12345e18)`; asserts the deployed booster address equals `computePoolBoosterAddress(...)` with the same params; nick transfers 10 OS to the booster; `bribe()` — parses `NotifyReward` events from the gauge address and asserts exactly 1 event with `briber == boosterAddress`, `rewardToken == OS`, `amount == bribeBalance` (full pre-bribe balance, exact equality), and booster OS balance == 0 afterwards.

---

## Safe automation modules (unit + mainnet/base fork)

Tests for the Gnosis-Safe automation modules under `contracts/strategies/` / `contracts/utils` (Safe modules that let an operator execute vault actions through the Multichain Strategist Safe). Unit tests run against local mocks (`MockAutoWithdrawalVault`, `MockSafeContract`, `MockStrategy`, `MockCurvePoolBooster`, `MockPoolBoosterFactory`) where the mock Safe's address is impersonated as both Safe and operator (`safeSigner`). Fork tests run against the deployed `EthereumBridgeHelperModule`, `BaseBridgeHelperModule`, and `ClaimStrategyRewardsSafeModule`, with the fixture enabling the module on the real Multichain Strategist Safe (`addresses.multichainStrategist`) if not already enabled. Files covered:

- `test/safe-modules/ousd-rebalancer-module.js` (unit, 46 tests)
- `test/safe-modules/ousd-auto-withdrawal.js` (unit, 15 tests)
- `test/safe-modules/curve-pool-booster-bribes.js` (unit, 7 tests)
- `test/safe-modules/merkl-pool-booster-bribes.js` (unit, 8 tests)
- `test/safe-modules/bridge-helper.mainnet.fork-test.js` (fork, mainnet, 3 tests)
- `test/safe-modules/bridge-helper.base.fork-test.js` (fork, Base, 4 tests — 2 skipped)
- `test/safe-modules/claim-rewards.mainnet.fork-test.js` (fork, mainnet, 2 tests)

### `test/safe-modules/ousd-rebalancer-module.js` — unit test (mainnet mocks)

Uses `rebalancerModuleFixture` from `test/_fixture.js` (via `createFixtureLoader`): loads `defaultFixture` plus deployed `RebalancerModule`, `MockAutoWithdrawalVault` (mockVault), `MockSafeContract` (mockSafe), `MockStrategy`. Fixture setup: `safeSigner` = impersonated+funded mockSafe address (acts as both Safe and operator); `mockStrategy` is pre-whitelisted via `allowStrategy`; mockVault `totalValue` is set to $10M so the daily movement limit doesn't block operations; `stranger` = impersonated address `0x...02` with no roles. Contract under test: `RebalancerModule` (OUSD Rebalancer Safe Module). Amounts use `ousdUnits` (18-dec).

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "Deployment / Immutables"**
- `it("Should set vault to MockVault")` — assertions: `rebalancerModule.vault()` equals mockVault address.
- `it("Should set asset to MockVault's asset")` — assertions: `rebalancerModule.asset()` equals `mockVault.asset()`.
- `it("Should set safeContract to MockSafeContract")` — assertions: `rebalancerModule.safeContract()` equals mockSafe address.
- `it("Should not be paused initially")` — assertions: `paused()` returns false.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "pendingShortfall()"**
- `it("Should return queued minus claimable")` — setup: `mockVault.setWithdrawalQueueMetadata(1000, 400)` (OUSD units). Assertions: `pendingShortfall()` == 600 OUSD.
- `it("Should return 0 when queue is fully funded")` — setup: queue metadata (1000, 1000). Assertions: `pendingShortfall()` == 0.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - access control"**
- `it("Should revert if called by a non-operator")` — assertions: `processWithdrawalsAndDeposits([mockStrategy], [100], [], [])` from `stranger` reverts with exact string "Caller is not an operator".
- `it("Should revert when paused")` — setup: safeSigner calls `setPaused(true)`. Assertions: same call from safeSigner reverts with "Module is paused".
- `it("Should revert on withdraw array length mismatch")` — assertions: 1 withdraw strategy vs 2 withdraw amounts reverts with "Withdraw array length mismatch".
- `it("Should revert on deposit array length mismatch")` — assertions: 1 deposit strategy vs 2 deposit amounts reverts with "Deposit array length mismatch".

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - single withdrawal"**
- `it("Should withdraw from a single strategy")` — setup: queue metadata (1000, 400). Call withdraws 600 from mockStrategy. Assertions: emits `MockedWithdrawal(mockStrategy, asset(), 600)` on mockVault and `WithdrawalsProcessed` on the module.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - multiple withdrawals"**
- `it("Should withdraw from two strategies in one call")` — setup: deploys a second `MockStrategy`, safeSigner whitelists it via `allowStrategy`; queue metadata (1000, 0). Call withdraws 400 from strategy1 and 300 from strategy2. Assertions: mockVault emits `MockedWithdrawal(strategy1, asset, 400)` and `MockedWithdrawal(strategy2, asset, 300)`.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - skips zero withdrawal amounts"**
- `it("Should skip strategies with amount 0")` — setup: queue metadata (1000, 400). Call with withdraw amount 0 for mockStrategy. Assertions: does NOT emit `MockedWithdrawal`; still emits `WithdrawalsProcessed`.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - withdrawal Safe exec failure"**
- `it("Should emit WithdrawalFailed and continue when vault reverts")` — setup: queue metadata (1000, 400); `mockVault.revertNextWithdraw()` arms a one-shot revert. Call withdraws 600. Assertions: emits `WithdrawalFailed(mockStrategy, 600)` and `WithdrawalsProcessed` on module; does NOT emit `MockedWithdrawal` (call itself does not revert — failure is swallowed).

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - single deposit"**
- `it("Should deposit to a single strategy")` — call deposits 500 to mockStrategy. Assertions: emits `MockedDeposit(mockStrategy, asset(), 500)` on mockVault and `DepositsProcessed` on module.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - multiple deposits"**
- `it("Should deposit to two strategies in one call")` — setup: second `MockStrategy` deployed and whitelisted. Deposits 300 to strategy1 and 200 to strategy2. Assertions: mockVault emits `MockedDeposit(strategy1, asset, 300)` and `MockedDeposit(strategy2, asset, 200)`.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - skips zero deposit amounts"**
- `it("Should skip strategies with amount 0")` — deposit amount 0. Assertions: no `MockedDeposit` emitted; `DepositsProcessed` emitted.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - deposit Safe exec failure"**
- `it("Should emit DepositFailed and continue when vault reverts")` — setup: `mockVault.revertNextDeposit()`. Deposit 500. Assertions: emits `DepositFailed(mockStrategy, 500)` and `DepositsProcessed`; does NOT emit `MockedDeposit`.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "processWithdrawalsAndDeposits() - empty arrays"**
- `it("Should handle all-empty arrays gracefully")` — setup: queue metadata (1000, 400). Call with all four arrays empty. Assertions: emits both `WithdrawalsProcessed` and `DepositsProcessed`; emits neither `MockedWithdrawal` nor `MockedDeposit`.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "setPaused()"**
- `it("Should revert if called by a non-safe address")` — assertions: `setPaused(true)` from stranger reverts with "Caller is not the safe contract".
- `it("Should pause the module")` — assertions: safeSigner `setPaused(true)` emits `PausedStateChanged(true)`; `paused()` == true.
- `it("Should unpause the module")` — setup: pause first. Assertions: `setPaused(false)` emits `PausedStateChanged(false)`; `paused()` == false.
- `it("Should block processWithdrawalsAndDeposits when paused")` — setup: paused. Assertions: withdraw call reverts with "Module is paused".
- `it("Should allow operations after unpause")` — setup: pause then unpause; queue metadata (1000, 400). Assertions: withdraw of 600 emits `MockedWithdrawal`.

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "Strategy whitelist"**
- `it("Should start with mockStrategy allowed (set in fixture)")` — assertions: `isAllowedStrategy(mockStrategy)` is true.
- `it("Should let the Safe allow a new strategy")` — assertions: `allowStrategy(0x...99)` from safeSigner emits `StrategyAllowed(0x...99)`; `isAllowedStrategy(0x...99)` becomes true.
- `it("Should let the Safe revoke a strategy")` — assertions: `revokeStrategy(mockStrategy)` emits `StrategyRevoked(mockStrategy)`; `isAllowedStrategy(mockStrategy)` becomes false.
- `it("Should revert allowStrategy when called by non-Safe")` — assertions: reverts with "Caller is not the safe contract".
- `it("Should revert revokeStrategy when called by non-Safe")` — assertions: reverts with "Caller is not the safe contract".
- `it("Should revert processWithdrawalsAndDeposits for a non-whitelisted withdrawal strategy")` — assertions: withdrawal targeting address `0x...99` reverts with "Strategy not allowed".
- `it("Should revert processWithdrawalsAndDeposits for a non-whitelisted deposit strategy")` — assertions: deposit targeting `0x...99` reverts with "Strategy not allowed".
- `it("Should revert processWithdrawalsAndDeposits after strategy is revoked")` — setup: queue metadata (1000, 400); safeSigner revokes mockStrategy. Assertions: withdrawal of 600 from the revoked strategy reverts with "Strategy not allowed".

**describe: "Unit Test: OUSD Rebalancer Safe Module" > "Daily movement limit"** (fixture context: mockVault totalValue = $10M)
- `it("Should set maxDailyMovementBps to 20000 (200%) by default")` — assertions: `maxDailyMovementBps()` == 20000.
- `it("Should revert setMaxDailyMovementBps when called by non-Safe")` — assertions: `setMaxDailyMovementBps(10000)` from stranger reverts with "Caller is not the safe contract".
- `it("Should update maxDailyMovementBps and emit event")` — assertions: `setMaxDailyMovementBps(5000)` emits `MaxDailyMovementBpsSet(5000)`; getter returns 5000.
- `it("Should revert withdrawal when daily limit is exceeded")` — setup: limit set to 100 bps (1% of $10M TVL = $100K); queue metadata (1,000,000, 0). Assertions: withdrawal of $200K reverts with "Daily movement limit exceeded".
- `it("Should revert deposit when daily limit is exceeded")` — setup: limit 100 bps. Assertions: deposit of $200K reverts with "Daily movement limit exceeded".
- `it("Should accumulate movements across multiple calls")` — setup: limit 100 bps ($100K); queue metadata (1,000,000, 0). First withdrawal of $60K succeeds; second $60K (total $120K > $100K) reverts with "Daily movement limit exceeded".
- `it("Should return correct dailyLimit based on TVL and bps")` — assertions: with default 200% and $10M TVL, `dailyLimit()` == $20M; after `mockVault.setTotalValue($5M)`, `dailyLimit()` == $10M.
- `it("Should return unlimited dailyLimit when maxDailyMovementBps is 0")` — setup: bps set to 0. Assertions: `dailyLimit()` == `MaxUint256`.
- `it("Should return correct remainingDailyLimit after movements")` — setup: limit 100 bps ($100K); queue metadata (1,000,000, 0). Assertions: `remainingDailyLimit()` == $100K before any movement; after withdrawing $60K, == $40K.
- `it("Should return 0 remainingDailyLimit when fully used")` — setup: limit 100 bps; withdraw exactly $100K. Assertions: `remainingDailyLimit()` == 0.
- `it("Should not consume quota for failed withdrawal")` — setup: limit 100 bps; queue metadata set; `mockVault.revertNextWithdraw()`. Withdraw $60K (fails silently). Assertions: `remainingDailyLimit()` still == $100K (failed withdrawal doesn't consume quota).
- `it("Should not consume quota for failed deposit")` — setup: limit 100 bps; `mockVault.revertNextDeposit()`. Deposit $60K (fails silently). Assertions: `remainingDailyLimit()` still == $100K.
- `it("Should keep remainingDailyLimit effectively unlimited when maxDailyMovementBps is 0")` — setup: bps 0; withdraw $60K. Assertions: `remainingDailyLimit()` == `MaxUint256 - 60000e18` (movement still tracked but limit unbounded).
- `it("Should allow movement above finite cap after switching maxDailyMovementBps to 0")` — setup: limit 100 bps; withdraw of $200K reverts with "Daily movement limit exceeded"; then bps set to 0. Assertions: same $200K withdrawal now succeeds and emits `MockedWithdrawal`.

### `test/safe-modules/ousd-auto-withdrawal.js` — unit test (mainnet mocks)

Uses `autoWithdrawalModuleFixture` from `test/_fixture.js`: loads `defaultFixture` plus deployed `AutoWithdrawalModule`, `MockAutoWithdrawalVault`, `MockSafeContract`, `MockStrategy`; `safeSigner` = impersonated mockSafe (Safe + operator); `stranger` = impersonated `0x...02`. The module's initial `strategy` is `addresses.dead`. Contract under test: `AutoWithdrawalModule` (funds the OUSD withdrawal-queue shortfall from a single configured strategy).

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "Deployment / Immutables"**
- `it("Should set vault to MockVault")` — assertions: `vault()` equals mockVault address.
- `it("Should set asset to MockVault's asset")` — assertions: `asset()` equals `mockVault.asset()`.
- `it("Should set strategy to addresses.dead")` — assertions: `strategy()` equals `addresses.dead` (deployment default).
- `it("Should set safeContract to MockSafeContract")` — assertions: `safeContract()` equals mockSafe address.

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "pendingShortfall()"**
- `it("Should return queued minus claimable")` — setup: `setWithdrawalQueueMetadata(1000, 400)`. Assertions: `pendingShortfall()` == 600 OUSD.
- `it("Should return 0 when queue is fully funded")` — setup: (1000, 1000). Assertions: `pendingShortfall()` == 0.

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "fundWithdrawals() - access control"**
- `it("Should revert if called by a non-operator")` — assertions: `fundWithdrawals()` from stranger reverts with "Caller is not an operator".

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "fundWithdrawals() - queue already satisfied"**
- `it("Should do nothing when shortfall is 0")` — setup: queue metadata (1000, 1000). Assertions: `fundWithdrawals()` succeeds but emits none of `LiquidityWithdrawn`, `InsufficientStrategyLiquidity`, `WithdrawalFailed` (module) nor `MockedWithdrawal` (vault).

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "fundWithdrawals() - strategy has zero balance"**
- `it("Should emit InsufficientStrategyLiquidity when strategy balance is 0")` — setup: safeSigner `setStrategy(mockStrategy)` (real contract; addresses.dead has no code); strategy `checkBalance` left at default 0; queue metadata (1000, 400). Assertions: emits `InsufficientStrategyLiquidity(mockStrategy, 600, 0)` (shortfall 600, strategy balance 0).

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "fundWithdrawals() - shortfall fully covered"**
- `it("Should withdraw exact shortfall when strategy has enough")` — setup: strategy set; `mockStrategy.setNextBalance(1000)`; queue metadata (1000, 400). Assertions: emits `LiquidityWithdrawn(mockStrategy, 600, 0)` (withdrew 600, remaining shortfall 0) and mockVault emits `MockedWithdrawal(mockStrategy, asset(), 600)`.

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "fundWithdrawals() - shortfall partially covered"**
- `it("Should withdraw only what strategy has when balance < shortfall")` — setup: strategy set; `setNextBalance(200)`; queue metadata (1000, 400) → shortfall 600. Assertions: emits `LiquidityWithdrawn(mockStrategy, 200, 400)` (withdrew 200, 400 shortfall left) and `MockedWithdrawal(mockStrategy, asset(), 200)`.

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "fundWithdrawals() - Safe exec fails"**
- `it("Should emit WithdrawalFailed when vault reverts")` — setup: strategy set; `setNextBalance(1000)`; queue metadata (1000, 400); `mockVault.revertNextWithdraw()`. Assertions: emits `WithdrawalFailed(mockStrategy, 600)`; does NOT emit `LiquidityWithdrawn`; tx itself succeeds.

**describe: "Unit Test: OUSD Auto-Withdrawal Safe Module" > "setStrategy()"**
- `it("Should revert if called by a non-safe address")` — assertions: `setStrategy(mockStrategy)` from stranger reverts with "Caller is not the safe contract".
- `it("Should update strategy and emit StrategyUpdated")` — assertions: safeSigner `setStrategy(mockStrategy)` emits `StrategyUpdated(oldStrategy, mockStrategy)` where oldStrategy is the previous `strategy()` value; `strategy()` getter updates.
- `it("Should revert on zero address")` — assertions: `setStrategy(addresses.zero)` reverts with "Invalid strategy".

### `test/safe-modules/curve-pool-booster-bribes.js` — unit test (mainnet mocks)

Uses an inline fixture via `createFixtureLoader`: deploys `MockSafeContract` (impersonated+funded as `safeSigner`; also operator), three `MockCurvePoolBooster` instances (A, B, C), and `CurvePoolBoosterBribesModule` constructed with (safe=mockSafe, operator=mockSafe, boosters=[A,B,C], feePerBooster=0.001 ETH, additionalGasLimit=123456); mockSafe balance is set to 1 ETH via `hardhat_setBalance`; `stranger` = impersonated `0x...02`. Contract under test: `CurvePoolBoosterBribesModule` (top-level `it()`s, no nested describes; two `manageBribes` overloads).

**describe: "Unit Test: Curve Pool Booster Bribes Module"**
- `it("Should manage selected pool boosters with default parameters")` — safeSigner calls `manageBribes(address[])` with all three boosters. Assertions per booster: `callCount()` == 1, `lastTotalRewardAmount()` == `MaxUint256`, `lastNumberOfPeriods()` == 1, `lastMaxRewardPerVote()` == 0, `lastAdditionalGasLimit()` == 123456, `lastValue()` == 0.001 ETH (the constructor fee/gas defaults are forwarded).
- `it("Should manage only the selected registered pool boosters")` — safeSigner calls the 4-arg overload `manageBribes(address[],uint256[],uint8[],uint256[])` with ([B, C], amounts [11, 22], periods [2, 3], maxRewardPerVote [101, 202]). Assertions: booster A `callCount()` == 0 (untouched); B: callCount 1, lastTotalRewardAmount 11, lastNumberOfPeriods 2, lastMaxRewardPerVote 101; C: callCount 1, lastTotalRewardAmount 22, lastNumberOfPeriods 3, lastMaxRewardPerVote 202.
- `it("Should revert for an unregistered pool booster")` — setup: deploys a fresh `MockCurvePoolBooster` not in the constructor list. Assertions: `manageBribes(address[])` with it reverts with "Invalid pool booster".
- `it("Should revert for duplicate pool boosters")` — assertions: `manageBribes([A, A])` reverts with "Duplicate pool booster".
- `it("Should revert when selected arrays have a length mismatch")` — assertions: 4-arg overload with 2 boosters but only 1 reward amount (periods/maxReward arrays of length 2) reverts with "Length mismatch".
- `it("Should require ETH based on the selected pool booster count only")` — setup: mockSafe balance lowered to 0.0015 ETH (fee is 0.001 ETH per booster). Assertions: `manageBribes([A, B])` (needs 0.002 ETH) reverts with "Not enough ETH for bridge fees"; `manageBribes([A])` (needs 0.001 ETH) does not revert.
- `it("Should revert when called by a non-operator")` — assertions: `manageBribes([A])` from stranger reverts with "Caller is not an operator".

### `test/safe-modules/merkl-pool-booster-bribes.js` — unit test (mainnet mocks)

Uses an inline fixture via `createFixtureLoader`: deploys `MockSafeContract` (impersonated as `safeSigner`), `MockPoolBoosterFactory` (mockFactory), and `MerklPoolBoosterBribesModule` constructed with (safe=mockSafe, operator=mockSafe, factory=mockFactory); `stranger` = impersonated `0x...02`. Contract under test: `MerklPoolBoosterBribesModule` (top-level `it()`s).

**describe: "Unit Test: Merkl Pool Booster Bribes Module"**
- `it("Should call bribeAll with empty exclusion list")` — safeSigner calls `bribeAll([])`. Assertions: `mockFactory.callCount()` == 1; `mockFactory.getLastExclusionList()` deep-equals `[]`.
- `it("Should call bribeAll and pass through the exclusion list")` — safeSigner calls `bribeAll([0x...10, 0x...20])`. Assertions: factory `callCount()` == 1; `getLastExclusionList()` deep-equals the passed 2-address list.
- `it("Should revert when called by a non-operator")` — assertions: `bribeAll([])` from stranger reverts with "Caller is not an operator".
- `it("Should revert on construction with zero factory address")` — setup: fresh `MockSafeContract` deployed in-test. Assertions: deploying `MerklPoolBoosterBribesModule(mockSafe, mockSafe, AddressZero)` reverts with "Zero address".
- `it("Should store the correct factory address")` — assertions: `factory()` equals mockFactory address.
- `it("Should allow the Safe to update the factory address")` — safeSigner calls `setFactory(0x...42)`. Assertions: `factory()` returns the new address.
- `it("Should revert when non-Safe tries to update the factory address")` — assertions: `setFactory(0x...42)` from stranger reverts with "Caller is not the safe contract".
- `it("Should revert when setting factory to zero address")` — assertions: safeSigner `setFactory(AddressZero)` reverts with "Zero address".

### `test/safe-modules/bridge-helper.mainnet.fork-test.js` — fork test (mainnet)

Uses `bridgeHelperModuleFixture` from `test/_fixture.js`: `defaultFixture` plus the deployed `EthereumBridgeHelperModule`; `safeSigner` = impersonated Multichain Strategist Safe (`addresses.multichainStrategist`); the fixture enables the module on the real Safe if not already enabled. File-local helpers: `_mintOETH(amount, user)` (approve WETH + `oethVault.mint`) and `_mintWOETH(amount, user, receiver)` (mints 2x amount of OETH, approves wOETH, `woeth.mint(amount, receiver)`). Contracts under test: `EthereumBridgeHelperModule`, OETH Vault, OETH, wOETH, WETH.

**describe: "ForkTest: Bridge Helper Safe Module (Ethereum)"**
- `it("Should bridge wOETH to Base")` — setup: `_mintWOETH` mints 1 wOETH to safeSigner (funded via josh). safeSigner calls `bridgeHelperModule.bridgeWOETHToBase(1e18)`. Assertions: safeSigner's wOETH balance decreases by exactly 1 wOETH (balanceAfter == balanceBefore − 1).
- `it("Should bridge WETH to Base")` — setup: josh transfers 1.1 WETH to safeSigner. safeSigner calls `bridgeWETHToBase(1e18)`. Assertions: safeSigner's WETH balance decreases by exactly 1 WETH.
- `it("Should mint OETH wrap it to WOETH")` — setup: strategist calls `oethVault.rebase()`; josh transfers 1.1 WETH to safeSigner; expected wOETH computed via `woeth.convertToShares(1 WETH)`. safeSigner calls `mintAndWrap(1e18, false)`. Assertions: OETH totalSupply increases by ≥ 1 WETH-equivalent (gte check); safeSigner's WETH balance decreases by ~1 WETH (`approxEqualTolerance`); wOETH totalSupply increases by ~convertToShares(1 WETH) (`approxEqualTolerance`).

### `test/safe-modules/bridge-helper.base.fork-test.js` — fork test (Base)

Uses `bridgeHelperModuleFixture` from `test/_fixture-base.js`: `defaultBaseFixture` plus the deployed `BaseBridgeHelperModule`; `safeSigner` = impersonated Multichain Strategist Safe (module enabled on the Safe if needed); helper `_mintWETH(user, amount)` funds the user with native ETH and wraps via `weth.deposit`. Contracts under test: `BaseBridgeHelperModule`, OETHb Vault, OETHb, wOETH (bridged, with `minter` role signer), WETH, `BridgedWOETHStrategy` (woethStrategy).

**describe: "ForkTest: Bridge Helper Safe Module (Base)"**
- `it("Should bridge wOETH to Ethereum")` — setup: `minter` mints 1 bridged wOETH to safeSigner. safeSigner calls `bridgeWOETHToEthereum(1e18)`. Assertions: safeSigner's wOETH balance decreases by exactly 1 wOETH.
- `it.skip("Should bridge WETH to Ethereum")` (skipped) — would mint 1 WETH via `_mintWETH` and call `bridgeWETHToEthereum(1e18)` with no explicit assertions (success-only). Skipped per TODO: at the current Base tip the CCIP router rejects the message ("Failed to send CCIP message"); needs pinning to a block that both accepts CCIP and postdates the BaseBridgeHelperModule deployment.
- `it.skip("Should deposit wOETH for OETHb and async withdraw for WETH")` (skipped) — would: seed the vault with 10,000 WETH minted as OETHb by nick; ensure `withdrawalClaimDelay` (governor sets 10 min if 0); update wOETH oracle price and rebase; minter mints 1 wOETH to safeSigner; compute expected WETH via `woethStrategy.getBridgedWOETHValue(1e18)`; read `nextWithdrawalIndex` from `withdrawalQueueMetadata()`; call `depositWOETH(1e18, true)`. Would assert: safeSigner wOETH −1, woethStrategy wOETH balance +1, `woethStrategy.checkBalance(weth)` +expectedWETH (approxEqualTolerance), safeSigner WETH unchanged while pending; then `advanceTime(delay+1)`, call `claimWithdrawal(nextWithdrawalIndex)`, and assert safeSigner WETH increased by ~expectedWETH (approxEqualTolerance). Skipped per TODO: PR #2889 made `rebase()` operator-gated but `_depositWOETH` still calls `vault.rebase()` directly, so the module reverts with "Caller not authorized".
- `it("Should mint OETHb with WETH and redeem it for wOETH")` — setup: `_mintWETH(safeSigner, "1")`; `woethStrategy.updateWOETHOraclePrice()` and governor `rebase()`; expected wOETH = 1 WETH scaled by `getBridgedWOETHValue(1e18)`. safeSigner calls `depositWETHAndRedeemWOETH(1e18)`. Assertions: OETHb totalSupply decreases by ~1 (approxEqualTolerance — OETHb minted then burned for wOETH redemption); safeSigner WETH decreases by exactly 1; safeSigner wOETH increases by exactly expectedWOETHAmount; woethStrategy's wOETH balance and its `checkBalance(weth)` both decrease by ~expectedWOETHAmount (approxEqualTolerance).

### `test/safe-modules/claim-rewards.mainnet.fork-test.js` — fork test (mainnet)

Uses `claimRewardsModuleFixture` from `test/_fixture.js`: `defaultFixture` plus deployed `ClaimStrategyRewardsSafeModule`; `safeSigner` = impersonated Multichain Strategist Safe (module enabled if needed); fixture also exposes `morphoToken` (`addresses.mainnet.MorphoToken`). `beforeEach` additionally builds a CRV ERC-20 handle at `addresses.mainnet.CRV`. Contracts under test: `ClaimStrategyRewardsSafeModule` plus the deployed Curve AMO and Morpho strategy proxies.

**describe: "ForkTest: Claim Strategy Rewards Safe Module"**
- `it("Should claim CRV rewards")` — setup: sums current CRV balances held by `OUSDCurveAMOProxy` and `OETHCurveAMOProxy`. safeSigner calls `claimRewards(true)`. Assertions: safeSigner's CRV balance increases by ≥ the summed pre-claim strategy balances (gte — strategies may also harvest newly accrued CRV); each of the two strategies ends with a CRV balance of exactly 0.
- `it("Should claim Morpho rewards")` — setup: sums MORPHO token balances of `MorphoGauntletPrimeUSDCStrategyProxy`, `MorphoGauntletPrimeUSDTStrategyProxy`, and `MetaMorphoStrategyProxy`. safeSigner calls `claimRewards(true)`. Assertions: safeSigner's MORPHO balance increases by ≥ the summed pre-claim strategy balances (gte); each of the three strategies ends with MORPHO balance exactly 0.

---

# Zappers, timelock governance forks, reborn hack

## Zappers, timelock governance forks, reborn hack

This section covers the fork tests for all four Zapper contracts (native-asset entry points that mint OTokens and optionally wrap them into ERC-4626 wrappers across Mainnet, Base, and Sonic, plus the mainnet WOETH CCIP bridge zapper), the two multisig-driven TimelockController fork tests (Base and HyperEVM), and the unit test suite protecting OUSD's rebase-state accounting against the "reborn" CREATE2 self-destruct/redeploy attack. Files covered:

- `test/zapper/osonic-zapper.sonic.fork-test.js`
- `test/zapper/woethccipzapper.mainnet.fork-test.js`
- `test/zapper/oethb-zapper.base.fork-test.js`
- `test/zapper/zapper.mainnet.fork-test.js`
- `test/governance/timelock.hyperevm.fork-test.js`
- `test/governance/oethb-timelock.base.fork-test.js`
- `test/hacks/reborn.js`

---

### `test/zapper/osonic-zapper.sonic.fork-test.js` — fork test (Sonic)

Uses `createFixtureLoader(defaultSonicFixture)` from `_fixture-sonic.js` (loaded in a `beforeEach`); contracts under test: `OSonicZapper` (fixture key `zapper`), with `oSonic` (OS token), `wOSonic` (wrapped OS, ERC-4626) and `wS` (Wrapped Sonic). All balance/supply checks use `approxEqualTolerance(..., 2)` (2% tolerance).

**describe: "ForkTest: Origin Sonic Zapper"**
- `it("Should mint Origin Sonic with S transfer")` — signer `clement` sends a plain 1 S native transfer to the zapper address (triggering `receive()`); asserts the tx emits the zapper's `Zap` event (no arg checks), `oSonic.totalSupply()` increases by ~1e18 (tolerance 2%), and clement's native S balance decreases by ~1e18 (tolerance 2%).
- `it("Should mint Origin Sonic with S using deposit")` — same as above but via explicit `zapper.deposit({value: 1e18})`; asserts `Zap` emitted, OS total supply +~1e18 and clement's native balance −~1e18 (both tolerance 2%).
- `it("Should mint Wrapped Sonic with S")` — computes `expected = wOSonic.previewDeposit(1e18)` first, then calls `zapper.depositSForWrappedTokens("0", {value: 1e18})` (minimum-out arg 0); asserts `Zap` emitted, OS total supply +~1e18, clement's native S balance −~1e18, and clement's `wOSonic` balance +~`expected` (all tolerance 2%).
- `it("Should mint Wrapped Origin Sonic with Wrapped S")` — setup: clement wraps 1 S into `wS` via `wS.deposit({value: 1e18})` and approves the zapper for 1e18; computes `expected = wOSonic.previewDeposit(1e18)`, calls `zapper.depositWSForWrappedTokens(1e18, "0")`; asserts `Zap` emitted, OS total supply +~1e18, clement's `wS` balance −~1e18, and clement's `wOSonic` balance +~`expected` (all tolerance 2%).

---

### `test/zapper/woethccipzapper.mainnet.fork-test.js` — fork test (Mainnet)

Uses `createFixtureLoader(woethCcipZapperFixture)` from `_fixture.js` (extends `defaultFixture` with `oethZapper` = `OETHZapper`, `woethOnSourceChain` = WOETH at `WOETHProxy`, `woethZapper` = `WOETHCCIPZapper`); `this.timeout(0)`; an `after` hook reloads `loadDefaultFixture()` to restore state for subsequent files. Contract under test: `WOETHCCIPZapper` (zaps ETH → OETH → WOETH → sends WOETH cross-chain via Chainlink CCIP, paying a CCIP fee in ETH).

**describe: "ForkTest: WOETH CCIP Zapper"**
- `it("zap(): Should zap ETH  and send WOETH to CCIP TokenPool")` — with deposit 5 ETH, reads `feeAmount = woethZapper.getFee(5e18, josh.address)` and computes `expected = woeth.convertToShares(5e18 − fee)`; josh calls `zap(josh.address, {value: 5e18})`; asserts the WOETH balance of `addresses.mainnet.ccipWoethTokenPool` increases by ~`expected` (`approxEqualTolerance` 1%).
- `it("zap(): Should emit Zap event with args")` — deposit 5 ETH; josh calls `zap(anna.address, {value: 5e18})`; asserts `Zap` event emitted with named args `sender: josh.address`, `recipient: anna.address`, `amount: 5e18 − getFee(5e18, josh)`.
- `it("zap(): Should be reverted with 'AmountLessThanFee'")` — josh calls `zap(josh.address, {value: "1"})` (1 wei, below CCIP fee); asserts the tx reverts (generic `to.be.reverted` only — a comment notes the Hardhat version can't match the custom error `AmountLessThanFee`).
- `it("zap(): Should zap ETH (< 1) and emit Zap event with args")` — same as the event test but with deposit 0.5 ETH; asserts `Zap` emitted with `sender: josh`, `recipient: anna`, `amount: 0.5e18 − fee`.
- `it("receive(): Should zap ETH and send WOETH to CCIP TokenPool")` — josh sends a plain 5 ETH transfer to the zapper address (triggering `receive()`); asserts the CCIP WOETH token pool's balance increases by ~`woeth.convertToShares(5e18 − fee)` (tolerance 1%).
- `it("receive(): Should emit Zap event with args")` — plain 5 ETH transfer from josh to the zapper; asserts `Zap` emitted with `sender: josh.address`, `recipient: josh.address` (recipient defaults to sender via `receive()`), `amount: 5e18 − fee`.

---

### `test/zapper/oethb-zapper.base.fork-test.js` — fork test (Base)

Uses `createFixtureLoader(defaultBaseFixture)` from `_fixture-base.js`; contracts under test: `OETHBaseZapper` (fixture key `zapper`), with `oethb` (superOETHb token), `wOETHb` (wrapped superOETHb, ERC-4626) and `weth`. All balance/supply checks use `approxEqualTolerance(..., 2)` (2% tolerance).

**describe: "ForkTest: OETHb Zapper"**
- `it("Should mint OETHb with ETH")` — clement calls `zapper.deposit({value: 1e18})`; asserts `Zap` emitted, `oethb.totalSupply()` +~1e18 and clement's native ETH balance −~1e18 (tolerance 2%).
- `it("Should mint wsuperOETHb with ETH")` — computes `expected = wOETHb.previewDeposit(1e18)`, then calls `zapper.depositETHForWrappedTokens("0", {value: 1e18})` (min-out 0); asserts `Zap` emitted, oethb total supply +~1e18, clement's ETH balance −~1e18, and clement's `wOETHb` balance +~`expected` (all tolerance 2%).
- `it("Should mint wsuperOETHb with WETH")` — setup: clement wraps 1 ETH into WETH and approves the zapper for 1e18; computes `expected = wOETHb.previewDeposit(1e18)`, calls `zapper.depositWETHForWrappedTokens(1e18, "0")`; asserts `Zap` emitted, oethb total supply +~1e18, clement's WETH balance −~1e18, and clement's `wOETHb` balance +~`expected` (all tolerance 2%).

---

### `test/zapper/zapper.mainnet.fork-test.js` — fork test (Mainnet)

Uses `loadDefaultFixture()` from `_fixture.js` (the main mainnet fork fixture); contracts under test: `OETHZapper` (fixture key `oethZapper`), with `oeth`, `woeth` (WOETH ERC-4626) and `weth`. All balance/supply checks use `approxEqualTolerance(..., 2)` (2% tolerance). Signer is `domen`.

**describe: "ForkTest: OETH Zapper"**
- `it("Should mint OETH with ETH")` — domen calls `oethZapper.deposit({value: 1e18})`; asserts `Zap` emitted, `oeth.totalSupply()` +~1e18 and domen's native ETH balance −~1e18 (tolerance 2%).
- `it("Should mint wOETH with ETH")` — computes `expected = woeth.previewDeposit(1e18)`, calls `oethZapper.depositETHForWrappedTokens("0", {value: 1e18})` (min-out 0); asserts `Zap` emitted, OETH total supply +~1e18, domen's ETH balance −~1e18, and domen's WOETH balance +~`expected` (all tolerance 2%).
- `it("Should mint wOETH with WETH")` — setup: domen wraps 1 ETH into WETH and approves the zapper for 1e18; computes `expected = woeth.previewDeposit(1e18)`, calls `oethZapper.depositWETHForWrappedTokens(1e18, "0")`; asserts `Zap` emitted, OETH total supply +~1e18, domen's WETH balance −~1e18, and domen's WOETH balance +~`expected` (all tolerance 2%).

---

### `test/governance/timelock.hyperevm.fork-test.js` — fork test (HyperEVM)

Uses `createFixtureLoader(defaultHyperEVMFixture)` from `_fixture-hyperevm.js`; contracts under test: the HyperEVM `TimelockController` (fixture key `timelock`, impersonated multisig `admin` as proposer/executor) acting on `crossChainRemoteStrategy` (the cross-chain remote strategy deployed on HyperEVM).

**describe: "ForkTest: HyperEVM Timelock"**
- `it("Multisig can propose and execute on Timelock")` — encodes calldata for `crossChainRemoteStrategy.setHarvesterAddress(admin.address)`; the impersonated `admin` calls `timelock.scheduleBatch([strategy], [0], [calldata], predecessor=bytes32(0), salt=bytes32(1), minDelay)` where `minDelay = timelock.getMinDelay()`; then advances time by `minDelay + 10` seconds and 2 blocks, and `admin` calls `timelock.executeBatch(...)` with the same args; asserts `crossChainRemoteStrategy.harvesterAddress()` equals `admin.address` (exact `eq`). No revert or event checks — this is a full schedule→delay→execute lifecycle assertion.

---

### `test/governance/oethb-timelock.base.fork-test.js` — fork test (Base)

Uses `createFixtureLoader(defaultBaseFixture)` from `_fixture-base.js`; contracts under test: the Base `TimelockController` (fixture key `timelock`, impersonated `guardian` multisig as proposer/executor) acting on `oethbVault` (superOETHb Vault).

**describe: "ForkTest: OETHb Timelock"**
- `it("Multisig can propose and execute on Timelock")` — encodes calldata for `oethbVault.setVaultBuffer(0.1e18)` (`parseUnits("0.1", 18)`); the impersonated `guardian` calls `timelock.scheduleBatch([oethbVault], [0], [calldata], predecessor=bytes32(0), salt=bytes32(1), minDelay)` with `minDelay = timelock.getMinDelay()`; advances time by `minDelay + 10` seconds and 2 blocks; `guardian` calls `timelock.executeBatch(...)` with the same args; asserts `oethbVault.vaultBuffer()` equals `0.1e18` exactly.

---

### `test/hacks/reborn.js` — unit test (local mocks; sets `this.timeout(0)` when run under fork)

Uses `createFixtureLoader(rebornFixture)` from `_fixture.js`. `rebornFixture` extends `defaultFixture` and deploys a `Sanctum` contract (CREATE2 factory pointed at USDC + the OUSD Vault) that deploys/redeploys a `Reborner` contract at a deterministic address (salt `12345`). The fixture's `deployAndCall({shouldAttack, shouldDestruct, targetMethod})` helper configures Sanctum (`setShouldAttack`, `setShouldDesctruct`, optional `setTargetMethod`, `setOUSDAddress`) and CREATE2-deploys `Reborner`; when attacking, the Reborner's constructor calls into the Vault/OUSD (mint by default) and can then self-destruct — from OUSD's perspective a contract calling within its own constructor has `code.length == 0`, i.e. is treated as an EOA. The suite verifies OUSD's rebasing/non-rebasing accounting stays correct when the same address flips between "EOA-like" and contract. Contracts under test: `OUSD` (rebase state migration logic), `Vault`, helper contracts `Sanctum`/`Reborner`.

**describe: "Reborn Attack Protection" > "Vault"**
- `it("Should correctly do accounting when reborn calls mint as different types of addresses")` — setup: matt transfers 4 USDC to the precomputed `rebornAddress`; step 1: `deployAndCall({shouldAttack: true, shouldDestruct: true})` — constructor mints OUSD (treated as an EOA, so no non-rebasing migration) then self-destructs; step 2: `deployAndCall({shouldAttack: false})` re-deploys the contract at the same address without attacking; step 3: `reborner.mint()` is called from the now-live contract; asserts `ousd.balanceOf(rebornAddress)` equals exactly 2 OUSD (1 from constructor mint + 1 from post-deploy mint) and `ousd.nonRebasingSupply()` equals exactly 2 OUSD (the whole balance migrated to non-rebasing once the address is recognized as a contract).
- `it.skip("Should correctly do accounting when reborn calls burn as different types of addresses")` — (skipped; comment: instant redeem no longer supported for OUSD). Would have: transferred 4 USDC to the reborner, run two attack+self-destruct deploys (two constructor mints as "EOA"), redeployed without attack, then called `reborner.redeem()`; asserting `ousd.balanceOf(rebornAddress)` equals exactly 1 OUSD and `nonRebasingSupply()` equals exactly 1 OUSD after the redeem-triggered migration.
- `it("Should correctly do accounting when reborn calls transfer as different types of addresses")` — setup: matt transfers 4 USDC to the reborner; `deployAndCall({shouldAttack: true, shouldDestruct: true})` mints as "EOA" then self-destructs; asserts `nonRebasingSupply()` equals exactly 0 (asserted twice, duplicated line); redeploys with `shouldAttack: false`, then calls `reborner.transfer()` (transfers the whole OUSD balance out, triggering migration); asserts `ousd.balanceOf(rebornAddress)` equals exactly 0 and `nonRebasingSupply()` equals exactly 0; finally calls `reborner.mint()` and asserts `ousd.balanceOf(rebornAddress)` equals exactly 1 OUSD and `nonRebasingSupply()` equals exactly 1 OUSD.
- `it("Should have correct balance even after recreating")` — setup: matt transfers 4 USDC to the reborner; `deployAndCall({shouldAttack: true, shouldDestruct: true})` mints 1 OUSD in the constructor then self-destructs; asserts the reborner has an OUSD `balanceOf` of exactly "1" (custom `balanceOf` chai matcher); redeploys with `shouldAttack: false` and asserts the balance is still exactly "1" (recreation must not change the balance outside the constructor); calls `reborner.mint()` and asserts the balance is exactly "2".

---

