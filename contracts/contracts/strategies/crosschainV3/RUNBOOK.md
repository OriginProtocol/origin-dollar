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
| Old BridgedWOETHStrategy (Base) | [`0x80c864704DD06C3693ed5179190786EE38ACf835`](https://basescan.org/address/0x80c864704DD06C3693ed5179190786EE38ACf835)                                                            |

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

| What                       | Who                                    | When                                  |
| -------------------------- | -------------------------------------- | ------------------------------------- |
| Balance report             | Talos `oethbV3BalanceReport` (mainnet) | `15 */2 * * *`                        |
| Stored message / leg 2     | Talos `oethbV3SettleWithdrawal` (base) | `5,35 * * * *`                        |
| Old strategy oracle price  | Talos `otokenOethbUpdateWoethPrice`    | daily, **until base/008 has executed** |

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

| Alert | Meaning | First step |
| --- | --- | --- |
| `cross-chain-balance-reports` | No `BalanceReported` on Master for too long | Check the `oethb_v3_balance_report` runs and Remote's pool |
| `oethb-v3-channel` | Operation in flight too long, stored message, NACK or failed CCIP execution | Find the row in the failure table |
| `oethb-v3-config` | Operator, adapter, lane or cap changed | Confirm it was an intended governance or strategist action |
| `oethb-v3-migration` | Migration batch sent but not landed, or old strategy balance off | See the migration section below |

## Migration (old strategy → Remote)

Batches are Strategist Safe transactions on Base:
`bridgeToRemote(min(1000e18, remaining))` on the old strategy, at most one per
hour (the Ethereum-side wOETH bucket refills 1,000 per hour). Each needs ETH
for its CCIP fee: send it as `msg.value` (the surplus is refunded) or pre-fund
the strategy. Each batch emits `WOETHBridgedToRemote` on Base and lands as a
wOETH transfer into Remote ~30 minutes later.

Until base/008 executes, the old strategy prices both its local and bridged
wOETH with `lastOraclePrice`, so the daily price update must keep running.

### base/008 checklist (remove the old strategy)

Run [`008_OETHbV3RemoveOldStrategy.s.sol`](../../../scripts/deploy/base/008_OETHbV3RemoveOldStrategy.s.sol)
only when all of these hold:

1. The old strategy holds no wOETH (`bridgedWOETH.balanceOf(old)` under dust).
2. Every `WOETHBridgedToRemote` has a matching wOETH transfer into Remote on
   Ethereum.
3. A balance report was accepted on Master (`BalanceReported`) after the last
   batch landed.
4. `old.checkBalance(WETH)` is under `1e13` (the vault's `removeStrategy` dust
   check).

Then flip `skip` to `false`, `make simulate NETWORK=base`, and deploy. It is a
Base timelock proposal with a 48 h delay: keep reports flowing during the
delay. The PR must do the CLAUDE.md "MANDATORY CHECK"; afterwards disable the
`otoken_oethb_updateWoethPrice` schedule and retire the action.

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
