# OETHb V3 cross-chain wOETH strategy — operator runbook

How to run the Master (Base) / Remote (Ethereum) pair day to day. Design and
flows: [`DESIGN.md`](./DESIGN.md), [`FLOWS.md`](./FLOWS.md). Talos actions:
[`docs/ACTIONS.md`](../../../docs/ACTIONS.md#superoethb-v3-cross-chain-woeth).

Every contract has the same address on both chains:

| Contract                     | Address                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master (Base) / Remote (Eth) | [`0xa03360b3f6d902F1b3334c0adBd5C6995d3513fe`](https://basescan.org/address/0xa03360b3f6d902F1b3334c0adBd5C6995d3513fe) / [Etherscan](https://etherscan.io/address/0xa03360b3f6d902F1b3334c0adBd5C6995d3513fe) |
| CCIPAdapter (Base → Eth)     | [`0x03578bC4b5fB0cC0cA7A6AD05b06407ae6324a82`](https://basescan.org/address/0x03578bC4b5fB0cC0cA7A6AD05b06407ae6324a82)                                                               |
| SuperbridgeAdapter (Eth → Base) | [`0x0F12256E27E658790C404C087C38ab4f34D53360`](https://etherscan.io/address/0x0F12256E27E658790C404C087C38ab4f34D53360)                                                            |
| Old BridgedWOETHStrategy (Base), removed from the vault 2026-11-02 | [`0x80c864704DD06C3693ed5179190786EE38ACf835`](https://basescan.org/address/0x80c864704DD06C3693ed5179190786EE38ACf835) |

## Rules

1. **Never make Master the OETHb vault's default strategy.** `allocate()` would
   call `Master.depositAll`, which reverts while an operation is in flight,
   when the fee pool can't pay the ~0.02 ETH deposit fee, or above the 90.75
   WETH CCIP bucket. That breaks `allocate()` and the `otokenOethbRebase` run.
2. **One operation at a time.** `deposit`/`withdraw` revert while one is in
   flight; `withdrawAll` quietly does nothing.
3. **Fee pools must hold ETH.** Each strategy's ETH balance pays its CCIP sends.
   Remote pays for every ack, so an empty Remote pool stalls the channel.
   Overpaid ETH stays in the pool; only the governor can take it out
   (`transferNative`).

## Cadences

| What                   | Who                                    | When                          |
| ---------------------- | -------------------------------------- | ----------------------------- |
| Balance report         | Talos `oethbV3BalanceReport` (mainnet) | `15 0 * * *` (daily, 00:15 UTC) |
| Stored message / leg 2 | Talos `oethbV3SettleWithdrawal` (base) | `5,35 * * * *`                |

Enable order: fund Remote's pool (or let the first report top it up), enable
`oethb_v3_balance_report`, wait for `BalanceReported` on Master, then enable
`oethb_v3_settle_withdrawal`.

## Fee pools

| Pool           | Target                                   | Kept topped up by                      |
| -------------- | ---------------------------------------- | -------------------------------------- |
| Remote (Eth)   | ≥ 40 messages (~0.009 ETH)               | `oethbV3BalanceReport`, automatically   |
| Master (Base)  | ≥ one deposit + a few messages (~0.025 ETH) | by hand: send ETH to Master (`receive()`) |

Vault-driven `deposit`/`withdraw` can't attach ETH, so Master's pool must be
funded **before** any strategist move.

## Deposit

1. Check Master's pool holds ≥ ~0.021 ETH and Master is idle
   (`isYieldOpInFlight() == false`).
2. Propose `deposit:OETHbV3MasterStrategyProxy:<amount>` with
   `proposeVaultStrategyMoves --network base --vault SuperOETH`. At most 90.75
   WETH per move, and at most that per hour.
3. Expect `DepositRequested` on Master, `DepositProcessed` on Remote ~30 min
   later, then `DepositAcked` on Master ~20–30 min after that.

## Withdraw

1. **Leg 1 (strategist):** `withdraw:OETHbV3MasterStrategyProxy:<amount>`.
   Master emits `WithdrawRequested`; Remote unwraps and queues an OETH vault
   withdrawal (600 s claim delay) and acks (`WithdrawRequestAcked`).
2. **Leg 2 (Talos):** once the queue request is claimable,
   `oethbV3SettleWithdrawal` calls `triggerClaim()`. Remote claims and ships
   WETH back over Superbridge; Master forwards it to the vault (`Withdrawal`).
3. End to end: 1 to 2 hours.

## Failure table

| Symptom | Cause | Fix |
| --- | --- | --- |
| A send or simulation reverts with `V3: pool unfunded` (Base) | Master's pool can't pay the CCIP fee | Send ETH to Master, then retry the move |
| CCIP message shows *failed* on Ethereum with `V3: pool unfunded` | Remote couldn't pay its ack | Send ETH to Remote, then **manually execute** the failed message in the [CCIP explorer](https://ccip.chain.link) |
| `MessageStored` on the Base Superbridge adapter not cleared | The CCIP message arrived before the canonical ETH | Wait for the ETH; then `processStoredMessage(Master)` (anyone; the settle job does it) |
| `WithdrawRequestAcked` on Master + `WithdrawRequestUnderlyingFailed` on Remote (leg-1 NACK) | Unwrap or queue reverted on Ethereum | Request is cleared; investigate the reason, run `oethbV3RetryDeposit` if OETH was left idle, re-request |
| `WithdrawClaimAcked(success = false)` / `WithdrawClaimNack` (leg-2 NACK) | Queue not claimable yet | Nothing; the withdrawal stays pending and the settle job retries |
| `DepositUnderlyingFailed` on Remote | OETH mint or wOETH wrap reverted (e.g. OETH vault paused) | Fix the cause, then run `oethbV3RetryDeposit` |
| `isYieldOpInFlight()` stuck true for hours, CCIP shows no pending message | An ack was lost for good | Governor swaps the adapter pair (`setOutboundAdapter` / `setInboundAdapter`), see [DESIGN §4.3](./DESIGN.md#43-lost-claim-ack-stalls-pendingwithdrawalamount) |
| `LanePaused` on an adapter | Strategist or governor paused it | Multichain strategist Safe or governor calls `unpauseLane(strategy)` once safe |
| `oethbV3BalanceReport` fails with a nonce mismatch | Remote and Master disagree while Master is idle; should be impossible | Stop and investigate before sending anything |

## Alerts

These are planned in infra-dashboard and **not live yet**; until they ship,
don't look for them in Discord.

| Alert (planned) | Meaning | First step |
| --- | --- | --- |
| `cross-chain-balance-reports` (V3) | No `BalanceReported` on Master for too long | Check the `oethb_v3_balance_report` runs and Remote's pool |
| `oethb-v3-channel` | Operation in flight too long, stored message, NACK or failed CCIP execution | Find the row in the failure table |
| `oethb-v3-config` | Operator, adapter, lane or cap changed | Confirm it was an intended governance or strategist action |

## Migration record (old strategy → Remote)

Done. Kept as a record and for the lesson at the end.

- 6,384.451188618532578167 wOETH moved in nine `bridgeToRemote` batches: a
  0.1 test on 2026-10-26, then eight on 2026-10-28 between 08:32 and 19:00 UTC.
- The balance report that carried the last batch landed at Base block
  53213374 (2026-10-28 19:34:55 UTC). The old strategy's `checkBalance` hit 0
  there.
- base/008 removed the old strategy from the vault at Base block 53402332
  (2026-11-02 04:33:31 UTC), tx
  [`0x0bdc0d16341ca48376cf154aa5d786ff1b77709c183750f796347122d7a0b658`](https://basescan.org/tx/0x0bdc0d16341ca48376cf154aa5d786ff1b77709c183750f796347122d7a0b658).

**Lesson: the phantom window.** The old strategy valued in-flight wOETH as
`max(0, totalBridged * lastOraclePrice - Master.checkBalance(WETH))`. That term
was meant to be non-zero only while a batch was travelling, but it also woke up
whenever Master's balance fell below `totalBridged * lastOraclePrice`. A 47 WETH
withdrawal from Master on 2026-10-30, before 008 executed, made the vault count
about 46 WETH twice for 46 hours (until a deposit raised Master's balance on
2026-11-01). A future migration of this kind should remove the old strategy
before any withdrawal from the new one, or cap the in-flight term at what is
actually in transit.

## Quick state check

```bash
M=0xa03360b3f6d902F1b3334c0adBd5C6995d3513fe
# Base (Master)
cast call $M "isYieldOpInFlight()(bool)" --rpc-url $BASE_PROVIDER_URL
cast call $M "remoteStrategyBalance()(uint256)" --rpc-url $BASE_PROVIDER_URL
cast call $M "pendingWithdrawalAmount()(uint256)" --rpc-url $BASE_PROVIDER_URL
cast call $M "lastBalanceCheckTimestamp()(uint256)" --rpc-url $BASE_PROVIDER_URL
cast balance $M --rpc-url $BASE_PROVIDER_URL   # Master fee pool
cast call 0x0F12256E27E658790C404C087C38ab4f34D53360 "hasPendingMessage(address)(bool)" $M --rpc-url $BASE_PROVIDER_URL
# Ethereum (Remote)
cast call $M "checkBalance(address)(uint256)" 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 --rpc-url $MAINNET_PROVIDER_URL
cast call $M "outstandingRequestId()(uint256)" --rpc-url $MAINNET_PROVIDER_URL
cast balance $M --rpc-url $MAINNET_PROVIDER_URL   # Remote fee pool
```
