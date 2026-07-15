# Talos scheduled actions

Hardhat tasks the Talos runner (`contracts/runner.ts` → `@talos/client`) runs on
a cron schedule, or on demand via the "Run now" button in the Talos admin UI.
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
| `otokenOusdRebase`     | mainnet | `45 11,23 * * *` | Rebase OUSD on mainnet                                                                                                                    |
| `otokenOethRebase`     | mainnet | `45 11,23 * * *` | Collect the OETH dripper and rebase OETH on mainnet                                                                                       |
| `otokenOusdOethRebase` | mainnet | `45 11,23 * * *` | Collect OETH and rebase OUSD on mainnet                                                                                                   |
| `otokenOsRebase`       | sonic   | `45 11,23 * * *` | Collect the OS dripper and rebase OS on Sonic                                                                                             |
| `otokenOethbRebase`    | base    | `25 9,21 * * *`  | Rebase the OETHb vault on Base                                                                                                            |
| `permissionedRebase`   | mainnet | `15 10,22 * * *` | Collect fixed-rate drippers, then `permissionedRebase()` every managed vault via the Safe module (unpause → rebase → re-pause atomically) |
| `permissionedRebase`   | base    | `15 10,22 * * *` | As above, on Base                                                                                                                         |
| `permissionedRebase`   | sonic   | `15 10,22 * * *` | As above, on Sonic                                                                                                                        |

## OToken operations

| Action                              | Network | Cron             | Description                                                             |
| ----------------------------------- | ------- | ---------------- | ----------------------------------------------------------------------- |
| `otokenOsCollectAndRelease`         | sonic   | `55 23 * * *`    | Rebase the OS vault and harvest on Sonic                                |
| `otokenOusdAutoWithdrawal`          | mainnet | `35 11,23 * * *` | Auto-process OUSD withdrawals via the AutoWithdrawalModule              |
| `otokenAddWithdrawalQueueLiquidity` | mainnet | `20 0 * * *`     | Call `addWithdrawalQueueLiquidity` on every OToken vault on the network |
| `otokenAddWithdrawalQueueLiquidity` | base    | `30 0 * * *`     | As above, on Base                                                       |
| `otokenAddWithdrawalQueueLiquidity` | sonic   | `35 0 * * *`     | As above, on Sonic                                                      |
| `otokenAddWithdrawalQueueLiquidity` | plume   | `25 0 * * *`     | As above, on Plume                                                      |
| `otokenOethbUpdateWoethPrice`       | base    | `30 21 * * *`    | Update the wOETH oracle price on the Base BridgedWOETHStrategy          |
| `otokenOethbHarvest`                | base    | `55 11 * * *`    | Harvest strategies on Base OETHb                                        |
| `otokenOsSonicRestakeRewards`       | sonic   | `52 22 * * *`    | Restake rewards for Sonic validators                                    |

## Native staking (Ethereum validators)

| Action                     | Network | Cron             | Description                                                                                         |
| -------------------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `harvest`                  | mainnet | `25 11,23 * * *` | Harvest and swap rewards from native staking strategies                                             |
| `doAccounting`             | mainnet | `30 23 * * *`    | Account for consensus rewards and validator exits in the Native Staking Strategy                    |
| `snapBalances`             | mainnet | `2 0 * * *`      | Take a snapshot of the staking strategy's balance                                                   |
| `verifyBalances`           | mainnet | `6 0 * * *`      | Verify validator balances on the Beacon chain                                                       |
| `verifyDeposits`           | mainnet | `11 */4 * * *`   | Verify any processed deposit on the Beacon chain                                                    |
| `autoValidatorDeposits`    | mainnet | `14 1 * * *`     | Deposit WETH to under-funded validators (withdrawing from the strategy first if the Vault needs it) |
| `autoValidatorWithdrawals` | mainnet | `24 1 * * *`     | Withdraw ETH from validators when the Vault needs WETH for user withdrawals                         |

## Sonic staking

| Action                  | Network | Cron                 | Description                                                |
| ----------------------- | ------- | -------------------- | ---------------------------------------------------------- |
| `sonicUndelegate`       | sonic   | `35 3,9,15,21 * * *` | Remove liquidity from a Sonic validator (request withdraw) |
| `sonicClaimWithdrawals` | sonic   | `58 */2 * * *`       | Withdraw native S from a previously undelegated validator  |

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

| Action                      | Network     | Cron          | Description                                                                                     |
| --------------------------- | ----------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `manageMerklBribes`         | mainnet     | `30 13 * * 3` | Call `bribeAll` on the MerklPoolBoosterBribesModule via the Gnosis Safe                         |
| `manageMerklBribes`         | base        | `35 13 * * 3` | As above, on Base                                                                               |
| `manageBribes`              | mainnet     | `30 09 * * 5` | `manageBribes` on the CurvePoolBoosterBribesModule; sizes rewards-per-vote by target efficiency |
| `claimBribes`               | base        | `30 10 * * 4` | Claim bribes from Aerodrome veNFT lockers on Base                                               |
| `updateVotemarketEpochs`    | arbitrumOne | `0 6 * * 5`   | Update Votemarket epochs for all Curve Pool Booster campaigns on Arbitrum                       |
| `ognClaimAndForwardRewards` | mainnet     | `50 0 * * 2`  | Claim and forward OGN rewards from all modules                                                  |
| `claimSSVRewards`           | mainnet     | `45 0 1 * *`  | Claim SSV rewards and forward the claimed SSV                                                   |
| `managePassThrough`         | mainnet     | `30 12 * * 0` | Transfer tokens via the pass-through mechanism                                                  |

## System

| Action        | Network | Cron          | Description                                                     |
| ------------- | ------- | ------------- | --------------------------------------------------------------- |
| `healthcheck` | mainnet | `*/5 * * * *` | Verify the action execution pipeline (signer, network, logging) |

## Manual / on-demand — mainnet

Dispatched via "Run now"; params are edited into the schedule's command before
each run (see notes in `seed_schedules.sql`).

| Action                       | Description                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `stakeValidator`             | Convert WETH to ETH and deposit to a validator from the Compounding Staking Strategy |
| `removeValidator`            | Remove a registered or exited compounding validator from the SSV cluster             |
| `ousdRebalancer`             | Plan and execute OUSD strategy rebalancing via the RebalancerModule                  |
| `queueGovernorSixProposal`   | Queue a GovernorSix proposal (`--propid`)                                            |
| `executeGovernorSixProposal` | Execute a GovernorSix proposal (`--propid`)                                          |
