# Talos scheduled actions

Standalone actions the Talos runner (`contracts/runner.ts` → `@oplabs/talos-client`) runs
on a cron schedule, or on demand via the "Run now" button in the Talos admin UI.
Each action is defined in [`tasks/actions/<name>.ts`](../tasks/actions); the
canonical schedule — cron, enabled state, and per-row operational notes — lives
in [`migrations/seed_schedules.sql`](../migrations/seed_schedules.sql). See
[Automated Actions (Talos)](../README.md#automated-actions-talos) for how the
runner works.

> **Keep in sync** (see [`CLAUDE.md`](../../CLAUDE.md)): update this file whenever
> a scheduled action is added, removed, or its behaviour changes.

Cron times are UTC. Enable state and operational caveats (e.g. "do not enable",
`permissioned`) are managed in `seed_schedules.sql`, not here.

## OToken rebases

| Action                 | Network | Cron             | Description                                                                                                                               |
| ---------------------- | ------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `otokenOusdRebase`     | mainnet | `45 11,23 * * *` | Allocate idle assets and rebase OUSD on mainnet                                                                                           |
| `otokenOethRebase`     | mainnet | `45 11,23 * * *` | Allocate idle assets and rebase OETH on mainnet                                                                                           |
| `otokenOusdOethRebase` | mainnet | `45 11,23 * * *` | Collect OETH and rebase OUSD on mainnet                                                                                                   |
| `otokenOethbRebase`    | base    | `25 9,21 * * *`  | Rebase the OETHb vault on Base                                                                                                            |

## OToken operations

| Action                              | Network | Cron             | Description                                                                                         |
| ----------------------------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `otokenOusdAutoWithdrawal`          | mainnet | `35 11,23 * * *` | Auto-process OUSD withdrawals via the AutoWithdrawalModule                                          |
| `otokenAddWithdrawalQueueLiquidity` | mainnet | `*/10 * * * *`   | Call `addWithdrawalQueueLiquidity` on each OToken vault, only when it would add claimable liquidity |
| `otokenAddWithdrawalQueueLiquidity` | base    | `*/10 * * * *`   | As above, on Base                                                                                   |
| `otokenAddWithdrawalQueueLiquidity` | sonic   | `*/10 * * * *`   | As above, on Sonic                                                                                  |
| `otokenAddWithdrawalQueueLiquidity` | plume   | `*/10 * * * *`   | As above, on Plume                                                                                  |
| `otokenOethbUpdateWoethPrice`       | base    | `30 21 * * *`    | Update the wOETH oracle price on the Base BridgedWOETHStrategy                                      |
| `otokenOethbHarvest`                | base    | `55 11 * * *`    | Harvest strategies on Base OETHb                                                                    |
| `ousdV4Rebalance`                   | mainnet | `7,37 * * * *`   | Keep the OUSD/USDe Uniswap v4 positions one-sided via UniswapV4RebalanceModule (see below)          |
| `ousdSusdeV4Rebalance`              | mainnet | `22,52 * * * *`  | Keep the OUSD/sUSDe v4 position just above the sUSDe NAV (UniswapV4ERC4626RebalanceModule, below)   |

## Native staking (Ethereum validators)

| Action                     | Network | Cron             | Description                                                                                         |
| -------------------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `snapBalances`             | mainnet | `2 0 * * *`      | Take a snapshot of the staking strategy's balance                                                   |
| `verifyBalances`           | mainnet | `6 0 * * *`      | Verify validator balances on the Beacon chain                                                       |
| `verifyDeposits`           | mainnet | `11 */4 * * *`   | Verify any processed deposit on the Beacon chain                                                    |
| `autoValidatorDeposits`    | mainnet | `14 1 * * *`     | Deposit WETH to under-funded validators (withdrawing from the strategy first if the Vault needs it) |
| `autoValidatorWithdrawals` | mainnet | `24 1 * * *`     | Withdraw ETH from validators when the Vault needs WETH for user withdrawals                         |

## Cross-chain

| Action                            | Network  | Cron                    | Description                                                                                          |
| --------------------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `crossChainBalanceUpdateBase`     | base     | `40 7,15,23 * * *`      | Send a cross-chain balance update from Base                                                          |
| `crossChainBalanceUpdateHyperevm` | hyperevm | `50 7,15,23 * * *`      | Send a cross-chain balance update from HyperEVM                                                      |
| `relayCCTPMessage`                | base     | `27 2,8,14,20 * * *`    | Fetch CCTP-attested messages via the Circle Gateway API and relay to the integrator (Base → mainnet) |
| `relayCCTPMessage`                | mainnet  | `43 4,10,16,22 * * *`   | As above (mainnet → Base)                                                                            |
| `crossChainRelayHyperEVM`         | hyperevm | `17 1,6,11,16,21 * * *` | Relay CCTP bridge transactions between mainnet and HyperEVM (HyperEVM → mainnet)                     |
| `crossChainRelayHyperEVM`         | mainnet  | `7 3,8,13,18,23 * * *`  | As above (mainnet → HyperEVM)                                                                        |

## Rewards & bribes

| Action                      | Network     | Cron             | Description                                                                                     |
| --------------------------- | ----------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `manageMerklBribes`         | mainnet     | `30 13 * * 3`    | Call `bribeAll` on the MerklPoolBoosterBribesModule via the Gnosis Safe                         |
| `manageMerklBribes`         | base        | `35 13 * * 3`    | As above, on Base                                                                               |
| `manageBribes`              | mainnet     | `30 09 * * 5`    | `manageBribes` on the CurvePoolBoosterBribesModule; sizes rewards-per-vote by target efficiency |
| `claimBribes`               | base        | `30 10 * * 4`    | Claim bribes from Aerodrome veNFT lockers on Base                                               |
| `updateVotemarketEpochs`    | arbitrumOne | `0 6 * * 5`      | Update Votemarket epochs for all Curve Pool Booster campaigns on Arbitrum                       |
| `ognClaimAndForwardRewards` | mainnet     | `50 0 * * 2`     | Claim and forward OGN rewards from all modules                                                  |
| `managePassThrough`         | mainnet     | `30 12 * * 0`    | Transfer tokens via the pass-through mechanism                                                  |
| `harvest`                   | mainnet     | `25 11,23 * * *` | Claim strategy rewards through the ClaimStrategyRewards Safe module                             |
| `feeSplitterDistribute`     | mainnet     | `10 12 * * *`    | Split protocol fees on the FeeSplitter: operations share out, remainder to the OGN buyback       |
| `cowHarvest`                | mainnet     | `0 */4 * * *`    | Sell the OUSD CoW harvester's CRV/MORPHO for USDC to the OUSD Vault (`--harvester ousd`)        |
| `cowHarvest`                | mainnet     | `0 */4 * * *`    | As above for OETH: CRV/SSV for WETH to the OETH Vault (`--harvester oeth`)                      |
| `cowHarvest`                | mainnet     | `0 */4 * * *`    | As above for the OGN buyback: OETH/WETH/OUSD/USDe for OGN to OGNRewardsSource (`--harvester ogn`) |
| `setXOGNRewardRate`         | mainnet     | `20 1 * * 2`     | Set the xOGN reward rate from measured OGN buybacks, via SetXOGNRewardRateModule                 |
| `bridgeBaseFees`            | base        | `45 10 * * *`    | Swap the Base fee Safe's OETHb fees to WETH on Curve and bridge them to the Ethereum FeeSplitter |

## System

| Action         | Network | Cron          | Description                                                                                                      |
| -------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `healthcheck`  | mainnet | `*/5 * * * *` | Verify the action execution pipeline (signer, network, logging)                                                  |
| `restartSquid` | mainnet | `15 3 * * *`  | Restart `origin-squid:prod` on SQD Cloud and fail the run unless the restart reaches `OK`. Needs `SQD_API_TOKEN` |

## Manual / on-demand — mainnet

Dispatched via "Run now"; params are edited into the schedule's command before
each run (see notes in `seed_schedules.sql`).

| Action                       | Description                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `stakeValidator`             | Convert WETH to ETH and deposit to a validator from the Compounding Staking Strategy |
| `withdrawValidator`          | Request a partial withdrawal or full exit from a Compounding Staking validator       |
| `removeValidator`            | Remove registered or exited validators from Native Staking Strategy 2                |
| `ousdRebalancer`             | Plan and execute OUSD strategy rebalancing via the RebalancerModule                  |
| `proposeVaultStrategyMoves`  | Simulate and propose ordered OUSD/OETH strategy movements to the Strategist 2/8 Safe |
| `queueGovernorSixProposal`   | Queue a GovernorSix proposal (`--propid`)                                            |
| `executeGovernorSixProposal` | Execute a GovernorSix proposal (`--propid`)                                          |

## Manual / on-demand — Base

| Action                      | Description                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `proposeVaultStrategyMoves` | Simulate and propose ordered SuperOETH strategy movements to the Strategist 2/8 Safe |

### CoW harvester parameters

`cowHarvest` is the off-chain side of the `HarvestingEIP1271` CoW harvesters,
moved from Railway. It sends no transaction. For each enabled sell token whose
balance is at least the harvester's `minSellAmount`, it quotes the whole
balance on the CoW API, takes `--slippage-bps` (default 50) off the quote, and
posts a sell order valid for one hour with `feeAmount = 0`. The order is signed
for EIP-1271: the signer signs `keccak256("\x19COWSWAP order digest:\n32" ‖
hashOrder(order))`, with no EIP-191 prefix, through `getDigestSigner` (KMS
`SignCommand` on the raw digest).

- The Talos signer must be the harvester's `bot()`. Otherwise the run fails;
  the owner (Strategist Safe) moves it with `setBot`.
- An order is posted only when `isValidSignature` returns `0x1626ba7e`.
- `--dryrun` quotes and signs without posting, checks that
  `getMessageSigner` recovers the Talos signer, and only warns when the
  signer is not yet `bot()`, so it can be run before `setBot`.
- One failing token is logged and does not fail the run; all of them do.
- The harvester checks no price beyond `buyAmount > 0`: the slippage on the
  quote is the only price protection.

### Base fee bridge parameters

Base OETHb fees are minted to the fee Safe (`multichainBuybackOperator`, the
Base vault's `trusteeAddress`). `bridgeBaseFees` calls `swapAndBridge` on
`BaseFeeBridgeModule`. That sells the Safe's whole OETHb balance for WETH on the
Curve AMO pool and sends the WETH over CCIP to the Ethereum FeeSplitter. From
there `feeSplitterDistribute` and `cowHarvest --harvester ogn` treat it like any
other fee.

- The CCIP fee is roughly flat per message (~0.019 ETH when this was written),
  so the action batches. It skips until `bridgeFee` is at most `--max-fee-bps`
  (default 100) of the WETH, which today means about 2 OETHb.
- `minWethOut` is the Curve `get_dy` quote less `--slippage-bps` (default 10).
  The module also enforces a par floor (`maxSlippageBps`, 50 at deploy). The
  run fails, rather than skips, when the quote is below that floor.
- The Safe pays the CCIP fee in native ETH. The run fails if the Safe cannot
  cover it, and warns when it covers fewer than three fees.
- The run is simulated before broadcast. `--dryrun` stops after the simulation.
- Scheduled at 10:45, after the 09:25 Base rebase mints fees and ahead of the
  12:10 mainnet `feeSplitterDistribute`, which leaves time for CCIP delivery.
- Needs, before enabling: the module deployed (`base/007`) and enabled on the
  fee Safe, and `FeeSplitter.addAsset(WETH, …)` on Ethereum. Until that last
  step, bridged WETH is not distributed.
- OGN bought with this WETH reaches OGNRewardsSource through CoW settlement, so
  `setXOGNRewardRate` counts it as buyback inflow, not as a donation.

### Vault strategy proposal parameters

Talos locks the `--network` option, so there are two disabled manual schedules:
`propose_vault_strategy_moves_mainnet` for Ethereum and
`propose_vault_strategy_moves_base` for Base. Before selecting "Run now", edit
`--vault` and `--moves` on the Ethereum schedule, or `--moves` on the Base
schedule. The underlying action remains shared across both chains.

`proposeVaultStrategyMoves` accepts ordered, semicolon-separated movements. A
strategy can be a deployment name or address:

```sh
pnpm exec tsx tasks/run.ts proposeVaultStrategyMoves \
  --network mainnet \
  --vault OUSD \
  --moves "withdraw:OUSDMorphoV2StrategyProxy:500000;deposit:OUSDCurveAMOProxy:250000"
```

Supported operations are `deposit:<strategy>:<amount>`,
`withdraw:<strategy>:<amount>`, and `withdrawAll:<strategy>`. Amounts are human
units of the Vault's backing asset. Operations execute in the supplied order.

By default the action simulates the proposal against the network's own RPC with
`eth_simulateV1`, pinned to a single block. A first pass runs
`rebase -> snapshot -> movements` and derives `expectedProfit` and
`expectedVaultChange`; a second pass replays the assembled batch to confirm it
passes `checkDelta`. It then estimates the completed Safe MultiSend before
proposing it. The atomic proposal is always
`rebase -> snapshot -> movements -> checkDelta`.

The RPC must implement `eth_simulateV1`. If it does not, the action fails with
instructions rather than proposing an unsimulated batch — use `--skip-fork` with
explicit expected values as the deliberate fallback.

For AMO strategies (for example `OUSDCurveAMOProxy`) a movement burns or mints
OTokens, so `expectedVaultChange` tracks pool state at execution time rather
than at proposal time. The default variances are tight enough that a proposal
waiting on its second confirmation can revert on `checkDelta` if the pool moves.
That fails safe, but it consumes a Safe nonce and gas — pass an explicit
`--vault-change-variance` for AMO movements.

- `--skip-fork` skips simulation entirely and requires both `--expected-profit`
  and `--expected-vault-change`.
- `--skip-estimation` skips only the final Safe estimation.
- `--dryrun` runs all enabled checks without signing or proposing.
- `--nonce <n>` targets an unexecuted Safe nonce so a pending proposal can be
  replaced. Without it, the next available Safe nonce is used.
- `--profit-variance` and `--vault-change-variance` override the defaults:
  OUSD `100/100`, OETH `1/1`, and SuperOETH `1/10`.

The runner requires `SAFE_API_KEY`. Its active KMS signer must also
be registered, by a Safe owner, as a Safe Transaction Service delegate scoped
to `0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971` on both Ethereum and Base.
Delegation only permits proposal submission; it does not count toward the
Safe's 2/8 owner confirmations. A Safe module is not used.

### ousdV4Rebalance parameters

The OUSD v4 liquidity Safe (`0x13eb…eB26`) owns OUSD-only positions just above
the price on the hookless, fee-0 OUSD/USDe pool, so they only ever buy USDe.
The ranges are the bid prices and the Safe sets them, e.g. a small range near
par and larger ones deeper, so a big seller walks into better prices.

`UniswapV4RebalanceModule` only enforces guardrails (Safe positions in that one
pool, tokens only to the Safe, OUSD-only adds and resets capped by `maxAmount0`,
reset never below par); this action makes every decision. Every run, for each
of `--token-ids` (deepest range first):

1. **Pricing indicator.** Quote KyberSwap for selling `--quote-size` USDe for
   USDC and the same size of OUSD for USDC, with our pool excluded. The bid
   that wins a seller routed through us (who then exits OUSD to USDC) is
   `usdcPerUsde * (1 + offset) / usdcPerOusd`, capped at `1 - redeemCost`
   because the pricing assumes USDe always redeems 1:1 for USDC at Ethena. Its
   lower tick (1 tick = 1 bp) is logged, with a warning when it is at least
   `--alert-tick-move` ticks from the range, for the Safe to move it. The
   OUSD -> USDC leg falls back to `get_dy` on the Curve OUSD/USDC pool, which
   is where KyberSwap routes it, if the KyberSwap quote fails. Any other quote
   failure or an out-of-band rate only skips the indicator. A range starting
   above the redeem-cost floor (tick 1 at the default 1 bp) is always warned
   about: it buys USDe for more than redeeming it returns.
2. **Pull and re-add.** When the position holds at least `--min-token1` USDe,
   call `rebalance(tokenId, target, reset, sqrtPrice(tickLower))`: pull it to
   the Safe, swap the price back to the range bottom, re-add `--target-ousd`
   liquidity. Below the range, top a short position back up. Once the
   Safe would hold `--max-token1-in-safe` USDe, pull without re-adding. Every
   call is simulated first; if the re-add would revert (the capped reset
   cannot bring the price back, or the Safe is short of OUSD) the action
   sends a pull only and warns.

- `--token-ids <ids>` (default `457273`): Safe positions to manage.
- `--target-ousd <n>` (default `20000`): OUSD to keep in each position, one
  value or one per position. Capped at what the Safe can fund once the
  position is pulled (its OUSD plus the OUSD the position returns, less the
  reset and a 0.5% margin), so an under-funded Safe re-adds what it has and
  the position grows back to the target once the Safe is topped up. No top-up
  within 1% of the target.
- `--reset-amount <n>` (default `100`): max OUSD the reset swap sells.
- `--max-token1-in-safe <n>` (default `1000000`): operational backstop, not
  pricing.
- `--min-token1 <n>` (default `10`): smallest amount of USDe worth a pull.
- `--quote-size <n>` (default `100000`): size of the reference quote in USDe;
  the market discount grows with size. One value or one per position.
- `--offset-bps <n>` (default `0.2`), `--redeem-cost-bps <n>` (default `1`, to
  confirm with Ethena), `--alert-tick-move <n>` (default `3`),
  `--skip-pricing`: the indicator.
- `--max-gas <n>` (default `25000000`): skip a rebalance estimated above this.
  A seller that pushes the price far above an otherwise empty range leaves it
  near the maximum tick, and the reset swap then walks every tick-bitmap word
  back down (~19M gas). A normal rebalance is ~350k gas.
- `--dryrun` simulates and logs without sending. A non-operator signer
  simulates as the Safe.

Operating it is manual for now: redeem the Safe's USDe for USDC at Ethena, mint
OUSD at the Vault, leave it in the Safe for the next re-adds, and move a range
(burn and mint from the Safe, then pass the new token id) when the indicator
says the market has moved.

### ousdSusdeV4Rebalance parameters

The OUSD v4 liquidity Safe (`0x13eb…eB26`) also owns an OUSD-only position on
the hookless, fee-0, tick-spacing-1 OUSD/sUSDe pool. It should sell OUSD just
above the sUSDe NAV (`convertToShares`), which grows, so the NAV tick drifts
down ~1.3 tick/day and a fixed range stops filling.
`UniswapV4ERC4626RebalanceModule` burns the position to the Safe, swaps the
price back down and mints a fresh position (a new token id each time), and
never lets the swap or the new range sell OUSD more than `navToleranceBps`
(1 bp) below the NAV. Every run:

1. The current position is the `mintedTokenId` of the module's latest
   `Rebalanced` event (none: `--token-id`; a burn-only call: no position).
2. The target range is `[ceil(floorTick), ceil(floorTick) + --width]` from
   `navFloorX192()` (the NAV less the tolerance, so the range starts on the
   tick nearest the NAV); the reset limit is the smallest sqrtPrice at or above
   that floor.
3. It moves when there is no position, the position holds at least
   `--min-token1` sUSDe, its bottom is below the target's, or its bottom is at
   least `--max-drift` ticks above the target's. The call is
   `rebalance(tokenId, lower, upper, liquidity, reset, limit)`, with a reset
   only while the pool price is above the limit (v4 reverts a zeroForOne swap
   whose limit is at or above the price) and the liquidity of `--target-ousd`
   on the new range. Simulated first; a revert is logged and nothing is sent.

- `--token-id <id>` (default `457274`): position used before the first
  `Rebalanced` event.
- `--width <n>` (default `5`), `--max-drift <n>` (default `2`): ticks.
- `--min-token1 <n>` (default `10`): sUSDe held that is worth a move.
- `--target-ousd <n>` (default `20000`): OUSD in the new position, capped at
  the Safe's OUSD plus the burned position's, less the reset and 0.5%.
- `--reset-amount <n>` (default `100`): max OUSD the reset swap sells,
  capped by the module's `maxAmount0`.
- `--lookback-blocks <n>` (default `500000`), `--log-chunk <n>` (default
  `50000`): the event search.
- `--max-gas <n>` (default `5000000`): skip a rebalance estimated above this.
- `--module <address>`: override the deployment descriptor (forks).
- `--dryrun` simulates and logs without sending. A non-operator signer
  simulates as the Safe.

The Safe must enable the module and approve OUSD to Permit2 and Permit2 to the
PositionManager (see `009_UniswapV4ERC4626RebalanceModule.s.sol`). The
schedule stays disabled until then.
