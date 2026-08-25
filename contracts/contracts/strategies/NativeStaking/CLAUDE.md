# Beacon-chain proofs in `CompoundingStakingStrategy`

How `CompoundingValidatorStorage` / `CompoundingStakingStrategy` proves, on L1, how much ETH
it controls on the beacon chain — the **deposit proof** (`verifyDeposit`) and the
**balance proof** (`snapBalances` → `verifyBalances`).

Everything below is derived from the source in this directory, `contracts/beacon/*`, and the
Ethereum consensus specs. Spec quotes are verbatim from `ethereum/consensus-specs@master`
(fetched 2026-08-06). **The live mainnet fork is Fulu/Fusaka** (epoch 411392, 2025-12-03);
the containers and processing functions the proofs depend on were introduced in Electra and are
unchanged by Fulu — see [§10](#10-forward-compatibility--read-this-before-a-hard-fork) for what
would break them. Generalized indices and proof lengths below were re-derived from the spec
containers and match the constants in `BeaconProofsLib.sol` exactly.

**Files**

| File | Role |
|---|---|
| `CompoundingStakingStrategy.sol` | storage model, deposit/balance state machine, both proof entrypoints |
| `CompoundingStakingView.sol` | off-chain read helper: `getVerifiedValidators()`, `getPendingDeposits()` |
| `../../beacon/BeaconProofsLib.sol` | all gindices, proof lengths, SSZ merkleization |
| `../../beacon/BeaconProofs.sol` | thin external wrapper (the deployed `BEACON_PROOFS` contract) |
| `../../beacon/Merkle.sol` | sha256 inclusion-proof walk + `merkleizeSha256` |
| `../../beacon/Endian.sol` | uint64 ↔ SSZ little-endian leaf |
| `../../beacon/BeaconRoots.sol` | EIP-4788 oracle wrapper |
| `../../beacon/PartialWithdrawal.sol` | EIP-7002 withdrawal request |
| `utils/proofs.js`, `utils/beacon.js`, `tasks/beacon.js` | off-chain proof generation |

---

## 1. The problem

The EVM cannot read beacon-chain state. A validator's balance lives in
`BeaconState.balances[validatorIndex]`; ETH that has been sent to the deposit contract but not
yet credited lives in `BeaconState.pending_deposits`. Neither is visible to a contract.

The only bridge is **EIP-4788**: every execution block's header carries
`parent_beacon_block_root`, and a system contract at
`0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02` stores it keyed by the execution block's timestamp
(`BeaconRoots.sol:11`). Given that root, any field of the beacon state can be proven with an SSZ
Merkle branch, because `BeaconBlock.state_root` is the hash-tree-root of the whole `BeaconState`.

So the strategy's job is: **snapshot a beacon block root, then prove every ETH-bearing position
against that one root**, and make the sum exactly equal to what it controls — no double count, no
gap.

### EIP-4788 mechanics that matter here

- The oracle returns the **parent** beacon block root for a given execution-block timestamp. To
  get the root of beacon slot `S` you must query the timestamp of slot `S+1`. That is exactly
  `_calcNextBlockTimestamp()` (`CompoundingStakingStrategy.sol:834-841`):
  `SLOT_DURATION * slot + BEACON_GENESIS_TIMESTAMP + SLOT_DURATION`.
- Two ring buffers, `timestamp_idx = timestamp % 8191` and `root_idx = timestamp_idx + 8191`. A
  read **reverts** if the stored timestamp does not equal the queried one — that is what
  `require(success && result.length > 0, "Invalid beacon timestamp")` catches
  (`BeaconRoots.sol:31`).
- Window: an index is reused every `8191 × 12 s = 98,292 s ≈ 27.3 hours`. (`8191` is prime and
  coprime with 12, so the slot-timestamp sequence walks all 8191 indices before repeating.) The
  natspec's "8,191 blocks old" is really 8,191 slot positions.
- **Missed slots.** No execution block ⇒ no timestamp key ⇒ revert. So to prove anything about
  slot `S`, slot `S+1` must have produced a block. `verifyDeposit`'s natspec calls this out
  (`:672-675`) — historically 1–3 % of slots are missed, so the off-chain script simply picks
  another slot.

---

## 2. Beacon-chain ground truth

Nothing here is guessed; each item is quoted or derived from the consensus specs. This section
exists because the proof constants are only correct *because* of these exact layouts.

### 2.1 `BeaconState` field order fixes every generalized index

Electra `BeaconState` has **37 fields**; `ceil(log2(37)) = 6`, so the container tree height is 6.

```
 0 genesis_time            11 validators                    28 deposit_requests_start_index
 1 genesis_validators_root 12 balances                      29 deposit_balance_to_consume
 2 slot                    13 randao_mixes                  30 exit_balance_to_consume
 3 fork                    14 slashings                     31 earliest_exit_epoch
 4 latest_block_header     15 previous_epoch_participation  32 consolidation_balance_to_consume
 5 block_roots             16 current_epoch_participation   33 earliest_consolidation_epoch
 6 state_roots             17 justification_bits            34 pending_deposits
 7 historical_roots        18 previous_justified_checkpoint 35 pending_partial_withdrawals
 8 eth1_data               19 current_justified_checkpoint  36 pending_consolidations
 9 eth1_data_votes         20 finalized_checkpoint
10 eth1_deposit_index      21 inactivity_scores  22 current_sync_committee  23 next_sync_committee
                           24 latest_execution_payload_header  25 next_withdrawal_index
                           26 next_withdrawal_validator_index  27 historical_summaries
```

`BeaconBlock` has 5 fields (`slot`, `proposer_index`, `parent_root`, `state_root`, `body`) ⇒
height 3, `state_root` at index 3 ⇒ `gindex(state) = (1 << 3) | 3 = 11`.

Composing with `gindex(child) = (gindex(parent) << height) | index`:

| Path | Arithmetic | Constant |
|---|---|---|
| `BeaconBlock.state.validators` | `(11 << 6) \| 11` | **715** (`BeaconProofsLib.sol:29`) |
| `BeaconBlock.state.balances` | `(11 << 6) \| 12` | **716** (`:34`) |
| `BeaconBlock.state.pending_deposits` | `(11 << 6) \| 34` | **738** (`:41`) |
| `…pending_deposits[0]` | `738 << 28` | **198,105,366,528** (`:19`) |
| `…pending_deposits[0].slot` | `(738 << 28 << 3) \| 4` | **1,584,842,932,228** (`:24`) |

### 2.2 SSZ merkleization: packing and `mix_in_length`

- `balances: List[Gwei, VALIDATOR_REGISTRY_LIMIT]` with `VALIDATOR_REGISTRY_LIMIT = 2^40`.
  `Gwei` is `uint64`, a *basic* type, so **four balances are packed per 32-byte chunk**,
  little-endian, at byte offsets 0-7 / 8-15 / 16-23 / 24-31. Chunk limit `2^40 / 4 = 2^38`
  ⇒ data-tree depth 38. A list also mixes in its length (`sha256(data_root ‖ length)`), adding
  one level ⇒ **height 39** = `BALANCES_HEIGHT` (`:56`).
  Element gindex inside the container root: `(1 << 39) | (validatorIndex / 4)` — the `1 << 39`
  already accounts for the mix-in level (the data root sits at gindex 2, so chunk `i` is at
  `2 · 2^38 + i = 2^39 + i`).
- `validators: List[Validator, 2^40]` — composite, one per chunk ⇒ depth 40, +1 mix-in ⇒
  **height 41** = `VALIDATORS_LIST_HEIGHT` (`:59`).
- `pending_deposits: List[PendingDeposit, PENDING_DEPOSITS_LIMIT]` with
  `PENDING_DEPOSITS_LIMIT = 2^27` ⇒ depth 27, +1 mix-in ⇒ **height 28** =
  `PENDING_DEPOSITS_LIST_HEIGHT` (`:62`). Hence the guard
  `require(pendingDepositIndex < 2**(28-1))` (`:283-286`) — indices must stay in the data half.
- `Validator` has 8 fields ⇒ height 3. `pubkey` at index 0, `withdrawable_epoch` at index 7
  (`:69`, `:72`). `pubkey` is `Bytes48`, i.e. 2 chunks, so its hash-tree-root is
  `sha256(pubkey ‖ 16 zero bytes)` — exactly `_hashPubKey` (`CompoundingStakingStrategy.sol:1207-1210`).
- `PendingDeposit` has 5 fields (`pubkey`, `withdrawal_credentials`, `amount`, `signature`,
  `slot`) ⇒ height 3, `slot` at index 4. `merkleizePendingDeposit` pads to 8 leaves with three
  `bytes32(0)` (`BeaconProofsLib.sol:370-381`) and merkleizes the 96-byte BLS signature as 4
  leaves (3 × 32 bytes + one zero) (`:386-400`).

Resulting proof depths — each equals the number of 32-byte witnesses:

| Proof | Depth | Bytes | Enforced at |
|---|---|---|---|
| balances container → block root | 3 + 6 = 9 | 288 | `:184` |
| pending-deposits container → block root | 3 + 6 = 9 | 288 | `:255` |
| balance leaf → balances container root | 39 | 1248 | `:228` |
| pending deposit → pending-deposits container root | 28 | 896 | `:297` |
| `validators[i].pubkey` → block root | 3 + 6 + 41 + 3 = 53 | 1696 | `:115` |
| `validators[i].withdrawable_epoch` → block root | 53 | 1696 | `:157` |
| `pending_deposits[0]` → block root | 3 + 6 + 28 = 37 | 1184 | `:47` |
| `pending_deposits[0].slot` → block root | 37 + 3 = 40 | 1280 | `:52` |

Proof length is checked exactly, never `>=`. Combined with the type bounds
(`validatorIndex` is `uint40`, `balanceIndex = validatorIndex/4 < 2^38`,
`pendingDepositIndex < 2^27`), the gindex bit-length always equals the witness count, so
`Merkle.processInclusionProofSha256` consumes exactly the right number of levels and lands on
gindex 1. `Merkle.sol:61` walks bit-by-bit: `index % 2 == 0` ⇒ computed hash is the **left**
child, then `index /= 2`.

### 2.3 How the beacon chain queues and processes deposits

This is the part the deposit proof reasons about, so it is quoted in full (Electra
`process_pending_deposits`; Fulu's only change is dropping the eth1-bridge guard):

```python
def process_pending_deposits(state: BeaconState) -> None:
    next_epoch = Epoch(get_current_epoch(state) + 1)
    available_for_processing = state.deposit_balance_to_consume + get_activation_exit_churn_limit(state)
    processed_amount = 0
    next_deposit_index = 0
    deposits_to_postpone = []
    is_churn_limit_reached = False
    finalized_slot = compute_start_slot_at_epoch(state.finalized_checkpoint.epoch)

    for deposit in state.pending_deposits:
        # Do not process deposit requests if Eth1 bridge deposits are not yet applied.
        if (deposit.slot > GENESIS_SLOT
                and state.eth1_deposit_index < state.deposit_requests_start_index):
            break
        # Check if deposit has been finalized, otherwise, stop processing.
        if deposit.slot > finalized_slot:
            break
        # Check if number of processed deposits has not reached the limit, otherwise, stop processing.
        if next_deposit_index >= MAX_PENDING_DEPOSITS_PER_EPOCH:
            break

        is_validator_exited = False
        is_validator_withdrawn = False
        validator_pubkeys = [v.pubkey for v in state.validators]
        if deposit.pubkey in validator_pubkeys:
            validator = state.validators[ValidatorIndex(validator_pubkeys.index(deposit.pubkey))]
            is_validator_exited = validator.exit_epoch < FAR_FUTURE_EPOCH
            is_validator_withdrawn = validator.withdrawable_epoch < next_epoch

        if is_validator_withdrawn:
            # Deposited balance will never become active. Increase balance but do not consume churn
            apply_pending_deposit(state, deposit)
        elif is_validator_exited:
            # Validator is exiting, postpone the deposit until after withdrawable epoch
            deposits_to_postpone.append(deposit)
        else:
            is_churn_limit_reached = processed_amount + deposit.amount > available_for_processing
            if is_churn_limit_reached:
                break
            processed_amount += deposit.amount
            apply_pending_deposit(state, deposit)

        # Regardless of how the deposit was handled, we move on in the queue.
        next_deposit_index += 1

    state.pending_deposits = state.pending_deposits[next_deposit_index:] + deposits_to_postpone
    ...
```

Five consequences the contract depends on:

1. **The queue is append-ordered, and new deposits carry the slot they were made in.** So
   `pending_deposits` is non-decreasing in `slot` — *except* for postponed entries.
2. **Postponed deposits go to the back** (`+ deposits_to_postpone`). This is the one thing that
   breaks slot-monotonicity, and it is the reason the deposit proof needs a second check.
3. **Postponement happens iff the validator is exiting but not yet withdrawable**
   (`exit_epoch < FAR_FUTURE_EPOCH` and `withdrawable_epoch >= next_epoch`). Once the chain
   reaches `withdrawable_epoch` the deposit is *applied* (balance credited, no churn consumed).
4. **Deposits are finality-gated** (`deposit.slot > finalized_slot: break`) and capped at
   `MAX_PENDING_DEPOSITS_PER_EPOCH = 16` per epoch. Minimum latency ≈ 2 epochs; throughput
   ceiling 16 deposits / 6.4 min.
5. **`apply_pending_deposit` credits a known pubkey unconditionally** — signature checking only
   happens for pubkeys not yet in the registry. The strategy only calls `verifyDeposit` for
   validators it has already proven exist, so its deposits always end as `increase_balance`,
   never a silent burn.

**Slot-0 pending deposits.** `queue_excess_active_balance` appends a `PendingDeposit` with
`slot=GENESIS_SLOT` (0) and a placeholder signature when a validator switches to 0x02 credentials
or consolidates. Such an entry can sit at the head of the queue with slot 0, which would make the
`depositData.slot < firstPendingDeposit.slot` test unsatisfiable. Hence
`require(firstPendingDeposit.slot != 0, "Zero 1st pending deposit slot")`
(`CompoundingStakingStrategy.sol:711`) and the matching off-chain error in `tasks/beacon.js:461-465`.

### 2.4 Exits, withdrawals and `withdrawable_epoch`

- `initiate_validator_exit` sets **both** `exit_epoch` and
  `withdrawable_epoch = exit_epoch + MIN_VALIDATOR_WITHDRAWABILITY_DELAY (256 epochs ≈ 27.3 h)`.
  `slash_validator` calls it, then raises `withdrawable_epoch` to at least
  `epoch + EPOCHS_PER_SLASHINGS_VECTOR (8192 epochs ≈ 36.4 days)`.
  ⇒ **`withdrawable_epoch == FAR_FUTURE_EPOCH` ⟺ `exit_epoch == FAR_FUTURE_EPOCH` ⟺ not exiting.**
  This equivalence is what makes the cheap "not exiting" branch of the deposit proof sound.
- EIP-7002 `process_withdrawal_request`: `amount == 0` (`FULL_EXIT_REQUEST_AMOUNT`) is a full
  exit and is only accepted if there are no pending partial withdrawals; partial withdrawals
  require 0x02 credentials, `effective_balance >= 32 ETH`, and
  `balance > 32 ETH + pending_balance_to_withdraw`. Both need
  `current_epoch >= activation_epoch + SHARD_COMMITTEE_PERIOD (256 epochs)`. Every branch is a
  silent `return` — an invalid request is **dropped, not reverted**, so the EL call succeeds while
  nothing happens on the CL. That is why the contract allows repeat exit requests
  (`CompoundingStakingStrategy.sol:519-531`) and why `validatorWithdrawal` cannot be treated as
  confirmation of anything.
- Withdrawal latency: `exit_queue_epoch >= current_epoch + MAX_SEED_LOOKAHEAD + 1 (5)` and
  `withdrawable_epoch = exit_queue_epoch + 256`, so **≥ 261 epochs ≈ 27.8 h** minimum from request
  to eligibility, before queue backlog.
- The validator registry only ever grows (`add_validator_to_registry` appends). Validator
  indices are stable forever, so proving by index is safe. A fully-swept validator keeps its
  entry with `balances[i] == 0`.
- **Hysteresis** (`process_effective_balance_updates`): `HYSTERESIS_INCREMENT = 1 ETH / 4`,
  `UPWARD_THRESHOLD = 5 × 0.25 = 1.25 ETH`, and the bump fires when
  `effective_balance + UPWARD_THRESHOLD < balance`. From `effective_balance = 31 ETH` that needs
  `balance > 32.25 ETH` — exactly `MIN_ACTIVATION_BALANCE_GWEI = 32.25 ether / 1e9`
  (`CompoundingStakingStrategy.sol:24-28`), tested with a strict `>` at `:1101`.

---

## 3. Storage model

`CompoundingValidatorStorage` (`CompoundingStakingStrategy.sol:23-196`).

### Bounds

| Constant | Value | Why |
|---|---|---|
| `MAX_DEPOSITS` | 32 | caps `depositList`, hence the per-deposit proofs in `verifyBalances` (32 × 896 B) |
| `MAX_VERIFIED_VALIDATORS` | 48 | caps `verifiedValidators`, hence balance proofs (48 × 1248 B) |
| `MAX_INITIAL_DEPOSIT_AMOUNT_WEI` | 2048 ETH | ceiling on `initialDepositAmountWei` |
| `SNAP_BALANCES_DELAY` | 35 × 12 = 420 s | 3 slots more than one epoch — see [§7](#7-timing-and-liveness) |
| `MIN_ACTIVATION_BALANCE_GWEI` | 32.25e9 | hysteresis threshold, §2.4 |

`MAX_VERIFIED_VALIDATORS` is only enforced on the *first* deposit to a brand-new validator
(`_recordFirstDeposit`, `:489-492`); top-ups to existing validators do not re-check it, which is
correct because they do not add to the list. (It is not actually an invariant — see
[§8](#liveness-risks).)

The two array caps exist for exactly one reason, stated at `:488`: *"Limits the number of
validator balance proofs to verifyBalances."* At both caps a single `verifyBalances` carries
`48×1248 + 32×896 + 2×288 = 89,152` bytes of proof calldata and performs
`48×39 + 32×28 + 2×9 = 2,786` SHA-256 precompile calls.

### Deposits

```solidity
struct DepositData { bytes32 pubKeyHash; uint64 amountGwei; uint64 slot; uint32 depositIndex; DepositStatus status; }
mapping(bytes32 => DepositData) public deposits;   // keyed by pendingDepositRoot
bytes32[] public depositList;                      // unordered; swap-and-pop on removal
bool public firstDeposit;                          // one unverified new validator at a time
```

The key is the **SSZ hash-tree-root of the `PendingDeposit` the beacon chain will create** —
computed on L1 at stake time from `(pubKeyHash, withdrawalCredentials, amountGwei, signature,
depositSlot)`. That is what makes a deposit provable later: the same 32 bytes appear as a leaf of
`state.pending_deposits`. `require(deposits[root].status == UNKNOWN, "Duplicate deposit")`
(`:422-425`) keeps it a unique ID — two identical deposits to the same validator in the same slot
are rejected.

`depositList` is explicitly **not** ordered by time (`:114-115`); `_removeDeposit` moves the last
element into the freed index and fixes its `depositIndex` (`:818-830`).

**Invariant:** for all `i`, `deposits[depositList[i]].depositIndex == i` and `.status == PENDING`.
There is exactly one `depositList.push` (`:435`), one `.status =` write (`:823`) and one
`depositList.pop()` (`:829`) in the whole contract, and the latter two are the same function — so
`depositList` holds *only* `PENDING` deposits, and `status` is monotone
`UNKNOWN → PENDING → VERIFIED`, never reset. Two natspec comments claim otherwise and are stale:
`:111-113` and `:1271-1273` both say the list can also hold "deposits that have been verified to
an exiting validator and is now waiting for the validator's balance to be swept". It cannot.

Monotone `status` is what makes a `pendingDepositRoot` a permanent single-use ID (see the
collision constraint in [§8](#operational-constraint-deposit-root-collisions)).

`DepositStatus.VERIFIED` means one of three things (`:66-81`) — worth reading in the source,
because two of them are loss/imprecision cases, not success cases. Summarised in [§8](#8-accepted-imprecisions).

Tests that manipulate this state directly need the slots: `deposits` is mapping base **52** and
`depositList` is array slot **53** (`test/strategies/compoundingSSVStaking.js:643,663`). These
depend on the C3 linearization of
`CompoundingStakingStrategy is CompoundingValidatorStorage, InitializableAbstractStrategy` —
reordering that inheritance list would silently shift every slot.

### Validators

```solidity
enum ValidatorState { NON_REGISTERED, REGISTERED, STAKED, VERIFIED, ACTIVE, EXITING, EXITED, REMOVED, INVALID }
struct ValidatorData { ValidatorState state; uint40 index; }
bytes32[] public verifiedValidators;               // pubKeyHashes with a proven, non-zero balance
mapping(bytes32 => ValidatorData) public validator;
```

Transitions:

| From → To | Where |
|---|---|
| `NON_REGISTERED → STAKED` | `_recordFirstDeposit` (`:497`) |
| `STAKED → VERIFIED` | `verifyValidator` (`:610-613`) + push to `verifiedValidators` |
| `STAKED → INVALID` | `verifyValidator`, credentials mismatch (`:623`) |
| `VERIFIED → ACTIVE` | `verifyBalances`, balance > 32.25 ETH (`:1100-1107`) |
| `ACTIVE → EXITING` | `validatorWithdrawal(pubkey, 0)` (`:549`) |
| any → `EXITED` | `verifyBalances`, proven zero balance, no pending deposit (`:1076-1080`) |

`REGISTERED` and `REMOVED` remain in the enum for storage compatibility with the retired SSV
strategy, but the current vanilla strategy cannot enter either state.

`ACTIVE` is a local claim ("has enough balance that it *can* activate"), not the CL's
`is_active_validator` — the natspec says so at `:1103-1105`.

### Balance snapshot and reported value

```solidity
struct Balances { bytes32 blockRoot; uint64 timestamp; uint128 ethBalance; }
Balances public snappedBalance;
uint256 public lastVerifiedEthBalance;
uint256 public depositedWethAccountedFor;
uint256[40] private __gap;
```

`checkBalance(WETH) = lastVerifiedEthBalance + WETH.balanceOf(this)` (`:1372-1391`).
Note what `lastVerifiedEthBalance` covers: pending deposits + validator balances + the strategy's
raw ETH **as of the last verified snapshot**, adjusted synchronously for WETH↔ETH movements.
There is **no staleness guard** — see [§8](#8-accepted-imprecisions).

---

## 4. The deposit proof — `verifyDeposit`

`CompoundingStakingStrategy.sol:696-816`. Permissionless (no access modifier).

### What it actually proves

Not "my deposit exists". The opposite: **"my deposit is no longer in
`BeaconState.pending_deposits`, therefore its ETH is now inside a validator balance."**

Proving *absence* from a Merkle tree is not directly possible. The contract proves it indirectly
from the queue's ordering, using two proofs against one beacon block root:

1. `verifyFirstPendingDeposit(depositBlockRoot, slot, proof)` — either
   `pending_deposits[0].slot` (40 witnesses) or, if the queue is empty,
   `pending_deposits[0] == bytes32(0)` (37 witnesses); the proof *length* selects the branch and
   the return value `isDepositQueueEmpty` reports which (`BeaconProofsLib.sol:321-354`).
2. `verifyValidatorWithdrawable(depositBlockRoot, validatorIndex, withdrawableEpoch, proof)` —
   `validators[i].withdrawable_epoch`, 53 witnesses (`:134-166`).

### The soundness argument

Let `D` = our deposit's slot, `S1` = `pending_deposits[0].slot`, `H = S1 / 32` (the code's
`firstPendingDepositEpoch`), `W` = our validator's `withdrawable_epoch`.

The core test is `require(depositData.slot < firstPendingDeposit.slot || isDepositQueueEmpty)`
(`:804-807`). If the queue were strictly slot-ordered this alone would suffice: everything ahead
of the head has been dequeued. But §2.3(2) shows postponed deposits are re-appended at the back,
so a postponed deposit of ours could have `D < S1` while still sitting in the queue.

The guard at `:783-789` closes that hole:

```solidity
require(
    strategyValidatorData.withdrawableEpoch == FAR_FUTURE_EPOCH ||
        strategyValidatorData.withdrawableEpoch <= firstPendingDepositEpoch ||
        isDepositQueueEmpty,
    "Exit Deposit likely not proc."
);
```

**Branch 1 — `W == FAR_FUTURE_EPOCH`.** By §2.4, `W == FFE ⟺ exit_epoch == FFE` *at the proven
root*. `exit_epoch` is monotone: `initiate_validator_exit` returns early once it is set, and
nothing in the spec ever resets it to `FFE`. So `exit_epoch == FFE` at slot `depositProcessedSlot`
implies it was `FFE` at every earlier slot too, hence `is_validator_exited` was never true, hence
our deposit was never postponed. The queue is slot-monotonic with respect to it and `D < S1`
proves it was dequeued.

**Branch 2 — `W <= H`** covers the exiting/slashed case. Suppose our deposit *were* still queued,
and let `P` be the epoch of its most recent postponement.

1. Postponement at `P` requires `is_validator_withdrawn == false`, i.e.
   `withdrawable_epoch >= P + 1`, so `P < W`.
2. The re-append happens in the epoch-transition processing of epoch `P` — after every block of
   epoch `P`.
3. The head entry has slot `S1`, so it was appended during a block in epoch `H`.
4. The guard gives `H >= W > P`, so the head was appended strictly after our re-append.
5. The queue is consumed from the front and appended at the back, so relative order is preserved:
   our deposit precedes the head. If it were still queued, the head would not be the head.
   Contradiction.

So the deposit is not in the queue. The only two outcomes of an examination are *apply* (leaves
permanently) and *postpone* (re-appended); "not in the queue" therefore means the last outcome was
`apply_pending_deposit`, which for an already-registered pubkey is an unconditional
`increase_balance`. ∎

**Branch 3 — `isDepositQueueEmpty`** ⇒ trivially processed.

Note this is a proof about the *consensus spec's queue discipline*, not something the contract
Merkle-verifies. It rests on two spec facts: postponed deposits are appended to the back (not
re-inserted in order), and `PendingDeposit.slot` is the slot of the EL deposit transaction.

It also carries an unstated hypothesis: **our own deposit's slot must be non-zero.** Branch 1 is
false for `D == 0`, because a slot-0 entry from `queue_excess_active_balance` can be appended to
the back at any time and then trivially satisfies `D < S1` while still queued. Origin is safe by
construction — `depositData.slot` is always derived from `block.timestamp` in `stakeEth`
(`:409-410`), never `GENESIS_SLOT` — but the `require(firstPendingDeposit.slot != 0)` guard only
covers the *head* of the queue, not our own deposit, so the property is worth knowing.

Adversarial review of the full four-guard combination (`:711`, `:729`, `:788`, `:806`) against the
Fulu spec did not produce a counterexample.

### The other checks, and why each exists

| Check | Line | Purpose |
|---|---|---|
| `status == PENDING` | 707-710 | idempotence |
| `firstPendingDeposit.slot != 0` | 711 | slot-0 entries from `queue_excess_active_balance` (§2.3); without it the `D < S1` test would revert with a misleading message. Mirrors `tasks/beacon.js:461-465` |
| validator is `VERIFIED`/`ACTIVE`/`EXITING` | 719-724 | see below |
| `depositData.slot < depositProcessedSlot` | 727-730 | needed for the empty-queue branch, where `S1` carries no information |
| `_calcNextBlockTimestamp(depositProcessedSlot) <= snapTimestamp \|\| snapTimestamp == 0` | 740-744 | **the interlock** — see §6 |

On success `_removeDeposit` marks the deposit `VERIFIED` and swap-pops it out of `depositList`
(`:810`).

> **Two defects in the comments around the state check (`:713-724`).**
>
> 1. The comment at `:717` says "when `verifyDeposit` is called for the first deposit it sets the
>    Validator state to EXITING". **`verifyDeposit` writes no validator state at all.** Every
>    `validator[...].state =` write in the system is at `:497`, `:549`, `:611`, `:623`, `:1079`,
>    and `:1106`. The only path to `EXITING` is
>    `validatorWithdrawal(pubkey, 0)` at `:549`.
> 2. Consequently the `EXITING` arm of `:719-724` is **unreachable**. `validatorWithdrawal` with
>    `amountGwei == 0` reverts `"Pending deposit"` if *any* `depositList` entry targets that pubkey
>    (`:534-544`), so `EXITING` can only be entered with zero pending deposits for that validator;
>    and `_admitStake` rejects `EXITING` (`:462-468`), so no deposit can be added
>    afterwards. `status == PENDING` and `state == EXITING` are therefore jointly unsatisfiable.
>    The slashed-validator scenario the comment describes is real, but it plays out with the
>    validator still in `ACTIVE` — which is how
>    `tests/unit/strategies/CompoundingStakingStrategy/concrete/SlashedValidatorDeposit.t.sol`
>    actually drives it. Harmless dead code, but do not reason from that comment.

---

## 5. The balance proof — `snapBalances` → `verifyBalances`

### 5.1 `snapBalances` (`:944-963`)

```solidity
require(snappedBalance.timestamp + SNAP_BALANCES_DELAY < currentTimestamp, "Snap too soon");
bytes32 blockRoot = BeaconRoots.parentBlockRoot(currentTimestamp);
snappedBalance = Balances({ blockRoot: blockRoot, timestamp: currentTimestamp,
                            ethBalance: SafeCast.toUint128(address(this).balance) });
```

It deliberately straddles **two chain states**, and the 90-line natspec at `:845-941` is the
argument that this is safe. In short:

- EL side: `address(this).balance` at execution block `X` (beacon slot `Y`).
- CL side: the beacon block root of slot `Y-1` (EIP-4788 returns the *parent* root).

Within one beacon block the CL runs `process_withdrawals` (debit validator) → execute payload →
credit the withdrawal recipient. Transactions inside block `X` cannot see withdrawals credited in
block `X`; only block `X+1` can. So a validator swept at slot `Y-1` has balance 0 in the snapped
CL root and its ETH is already in `address(this).balance` at block `X`. Exactly one of the two
sides counts it. Conversely a sweep at slot `Y` is invisible to both — an undercount that the
next cycle picks up, never a double count.

Because the delay check compares against `snappedBalance.timestamp`, and `verifyBalances` resets
that to 0, a fresh snap is allowed immediately after a successful verify. The 420 s only throttles
*re-snapping over an unverified snap*.

### 5.2 `verifyBalances` (`:1003-1176`)

```solidity
function verifyBalances(BalanceProofs calldata balanceProofs,
                        PendingDepositProofs calldata pendingDepositProofs) external
```

The function is permissionless. Callers cannot choose an unverified balance: every supplied leaf
and proof is anchored to the beacon block root stored by `snapBalances`.

**Step 1 — validator balances.** Requires `validatorBalanceProofs.length == validatorBalanceLeaves.length
== verifiedValidators.length` (`:1018-1026`): every verified validator must be accounted for, no
more, no fewer. Then one `verifyBalancesContainer` against the snapped root (9 witnesses), and per
validator a `verifyValidatorBalance` against that container root (39 witnesses).

The two-level split matters: the container root is proven once (288 B) and every balance proof is
then only 39 nodes instead of 48. It also means `verifyValidatorBalance` takes no beacon block
root at all — it is anchored solely by the container root that step 1 already tied to the snapshot.

`balanceAtIndex` (`BeaconProofsLib.sol:406-416`) extracts the balance from the packed leaf:

```solidity
uint256 bitShiftAmount = (validatorIndex % 4) * 64;
return Endian.fromLittleEndianUint64(bytes32(uint256(validatorBalanceLeaf) << bitShiftAmount));
```

Left-shifting by `64 · (i mod 4)` moves the target 8-byte slot into the top bytes, then
`fromLittleEndianUint64` takes `>> 192` and reverses byte order.

The loop runs **in reverse** (`:1040-1042`) so that swap-and-pop of exited validators only ever moves an
already-processed entry down into the current slot (`:1084-1094`). The proof arrays are indexed by
the *original* position `i`, so the off-chain arrays must be in the same order as the on-chain
`verifiedValidators` array — which is what `CompoundingStakingStrategyView.getVerifiedValidators()`
returns.

Per validator:
- `balance == 0` → treated as exited. Remove from `verifiedValidators` and set `EXITED`,
  **unless** the validator still has an entry in `depositList` (`:1056-1080`).
- `VERIFIED` and `balance > 32.25 ETH` → `ACTIVE`.
- otherwise accumulate `totalValidatorBalance += validatorBalanceGwei * 1 gwei`.

> **`verifyValidatorBalance` performs no existence check, so "balance == 0" is weaker than
> "exited".** `BeaconProofsLib.sol:202-237` derives the gindex purely from `validatorIndex / 4`
> and never compares against `len(state.balances)`. SSZ zero-pads a list's data tree to its
> `2^38`-chunk capacity, so a well-formed 1248-byte proof of an all-zero chunk *beyond the live
> length* verifies against the container root and `balanceAtIndex` returns 0. A validator that did
> not yet exist at the snapped root therefore proves as balance 0.
>
> The `depositPending` retention at `:1056-1080` is what makes this safe, and it is load-bearing
> well beyond the slashed-validator case its comment describes. `verifyValidator` accepts *any*
> beacon block root the caller supplies — including one newer than the outstanding snapshot — so a
> validator can be pushed onto `verifiedValidators` while not existing at the snapped root. But in
> that situation its first deposit is necessarily still in `depositList`: `verifyDeposit` could
> only have removed it by proving processing at a slot `<= ` the snapped slot (`:740-744`), which
> would imply the validator did exist there with a non-zero balance. So the retention rule fires,
> the validator is kept, and its ETH is still counted — via `totalDepositsWei` rather than
> `totalValidatorBalance`. Without it the validator would be marked `EXITED` and popped
> irreversibly (`_admitStake` rejects `EXITED`; `verifyValidator` requires `STAKED`).

**Step 2 — pending deposits.** Requires `pendingDepositProofs.length == pendingDepositIndexes.length
== depositList.length` (`:1125-1133`), one `verifyPendingDepositsContainer` (9 witnesses) and then
for each entry a `verifyPendingDeposit` (28 witnesses) showing the stored root is **still present**
in `state.pending_deposits` at the snapped root. Only then is its `amountGwei` added to
`totalDepositsWei`.

Deposits are verified *after* validators so an exited validator is marked `EXITED` before the
deposit loop (`:1115-1124`).

**Step 3 — settle.**

```solidity
lastVerifiedEthBalance = totalDepositsWei + totalValidatorBalance + balancesMem.ethBalance;
snappedBalance.timestamp = 0;   // force a fresh snap next time
```

Units: `validatorBalanceGwei` and `amountGwei` are gwei, converted with `* 1 gwei` at `:1111` and
`:1155-1158`; `ethBalance` is already wei. `lastVerifiedEthBalance` is wei.

---

## 6. The interlock — why nothing is double counted

This is the crux and it is worth stating precisely. Fix the snapped beacon block root `R` at slot
`Y-1`. Every ETH the strategy staked is, at `R`, in exactly one of two places: still in
`state.pending_deposits`, or already inside `state.balances[i]`.

- A deposit contributes to `totalDepositsWei` **only after `verifyPendingDeposit` proves it is
  present in `pending_deposits` at `R`** — so it is provably *not* in any balance.
- A deposit is removed from `depositList` **only via `verifyDeposit`, which is forced to prove
  processing at a slot no later than the snapped slot**:

  ```solidity
  require((_calcNextBlockTimestamp(depositProcessedSlot) <= snapTimestamp) || snapTimestamp == 0,
          "Deposit after balance snapshot");   // :740-744
  ```

  `_calcNextBlockTimestamp(s) <= snapTimestamp` ⇔ `s <= Y-1`. So a removed deposit is provably in
  a balance at `R`.

  The `<=` (rather than `<`) is exactly calibrated, not slack. If the snap happened in the block at
  slot `Y`, then `snapTimestamp = 12·Y + GENESIS` and the snapped root is slot `Y-1`; proving at
  `depositProcessedSlot = Y-1` gives `_calcNextBlockTimestamp(Y-1) = 12·(Y-1) + GENESIS + 12 =
  snapTimestamp`. The `<=` is what admits proving a deposit processed *at the snapped slot itself*
  — precisely the case `verifyBalances` needs cleared.

The two rules partition the set. And the forcing function is that `verifyBalances` demands a
*still-pending* proof for **every** entry in `depositList` — if one has actually been processed,
no such proof exists and `verifyBalances` reverts (`"Invalid deposit proof"`) until `verifyDeposit`
is called for it. The system cannot drift.

This is a hard protocol dependency, not optional cleanup. Since `snapBalances` always snaps the
current parent root, every snapshot taken after a deposit is processed makes that deposit
unprovable. So from deposit-processing time until
`verifyValidator → snapBalances → verifyDeposit → verifyBalances` completes **in that order**,
`verifyBalances` cannot succeed at all and `lastVerifiedEthBalance` is frozen.

The natspec at `:734-739` spells out the failure the interlock prevents: snap at `T`, deposit gets
processed after `T`, `verifyDeposit` removes it from `depositList`, then `verifyBalances` runs and
under-reports because the ETH is in neither bucket.

**Snapshot invalidation.** Any EL-side ETH movement between snap and verify would break the
`ethBalance` term, so both conversion helpers zero the snapshot:

- `_convertWethToEth` (`:1250-1263`) — called by `stakeEth`; `lastVerifiedEthBalance += amount`,
  `snappedBalance.timestamp = 0`.
- `_convertEthToWeth` (`:1232-1248`) — called by `_withdraw`; `lastVerifiedEthBalance -= min(...)`,
  `snappedBalance.timestamp = 0`.

The `min` clamp in `_convertEthToWeth` means `checkBalance` is **not continuous across a
withdraw**. `lastVerifiedEthBalance` falls by `min(L, E)` while the WETH term rises by the full
`E`. When `L >= E` that is neutral; when `L < E` — the normal state after sweeps that have not yet
been re-verified — `checkBalance` *rises* by `E − L`. So a vault redemption can increase the
strategy's reported value. It is conservative in aggregate (unproven ETH is only recognised once
it is physically WETH), but `totalValue()` is path-dependent and `VaultCore` consumes
`checkBalance` directly for rebase.

A bare `receive()` (`:1408`) — MEV/execution rewards, validator sweeps, donations — does *not*
invalidate. That is safe because it only makes the snapshot an undercount.

---

## 7. Timing and liveness

| Constraint | Value | Consequence |
|---|---|---|
| `SNAP_BALANCES_DELAY` | 420 s (35 slots) | guaranteed window to submit `verifyBalances` before anyone can re-snap |
| EIP-4788 ring buffer | ≈ 27.3 h | hard deadline to submit any proof against a snapped root |
| Deposit finality gate | ≥ 2 epochs | earliest a deposit can be processed |
| `MAX_PENDING_DEPOSITS_PER_EPOCH` | 16 / epoch | queue drain rate ceiling |
| Slashed-validator postponement | up to 8192 epochs ≈ 36.4 days | how long `W` can sit in the future |

Why 35 slots and not 32: deposits are processed once per epoch, so the natspec (`:42-49`) wants
`snapBalances` to sometimes land mid-epoch, giving the off-chain script room after the epoch
boundary. It is sized against an adversary re-snapping as fast as possible.

**Operator loop** (Talos, `docs/ACTIONS.md:50-52`, mainnet):

| Action | Cron | Implementation |
|---|---|---|
| `snapBalances` | `2 0 * * *` | `tasks/actions/snapBalances.ts` → `tasks/validatorCompound.js` |
| `verifyBalances` | `6 0 * * *` | `tasks/actions/verifyBalances.ts` → `tasks/beacon.js:556` |
| `verifyDeposits` | `11 */4 * * *` | `tasks/actions/verifyDeposits.ts` → `tasks/beacon.js:310` |

Snap and verify are 4 minutes apart, well inside both windows.

Proof generation (`utils/beacon.js:130-254`, `utils/proofs.js`):

1. `client.beacon.getBlockV2({ blockId })` — `blockId` is the snapped `blockRoot`
   (`tasks/beacon.js:577-579`), so the proof is built against exactly the root the contract stored.
2. `GET eth/v2/debug/beacon/states/{slot}` with `Accept: application/octet-stream` — the full SSZ
   `BeaconState` (hundreds of MB; 15-minute timeout, held in memory for proof generation).
3. `blockTree.setNode(stateRootGindex, stateView.node)` grafts the state into the block tree so a
   single `createProof` spans both containers.
4. `@chainsafe/persistent-merkle-tree` `createProof({ type: ProofType.single, gindex })`, then
   `concatProof` flattens witnesses into the packed `bytes` the contract expects
   (`utils/beacon.js:256-263`).

`verifyDeposits` decides *which* deposits to verify by fetching the state at `head - 30` and
checking which of the strategy's `pendingDepositRoot`s are absent from `state.pending_deposits`
(`tasks/beacon.js:272-308`) — the off-chain mirror of the on-chain absence argument. It then calls
`snapBalances()` *before* `verifyDeposit` so the `<= snapTimestamp` interlock is satisfied
(`:332-346`).

`getBeaconBlock` uses a raw `fetch` rather than the Lodestar client because Lodestar v1.38.0
mis-decodes an SSZ body served with a JSON content-type (`utils/beacon.js:158-166`).

---

## 8. Accepted imprecisions, trust assumptions and griefing

### Access control

| Function | Guard |
|---|---|
| `stakeEth`, `validatorWithdrawal` | `onlyRegistrator` |
| `snapBalances`, `verifyBalances`, `verifyValidator`, `verifyDeposit` | **permissionless** |
| `setRegistrator`, `setInitialDepositAmount`, `unPause` | `onlyGovernor` |
| `resetFirstDeposit` | `onlyGovernorOrStrategist` |
| `pause` | `onlyRegistratorOrGovernor` |

### What is actually deployed on mainnet

`deploy/mainnet/199_deploy_compounding_staking_strategy.js` deployed the current strategy, and
`deploy/mainnet/202_remove_2nd_native_staking_strategy.js` applied its post-consolidation wiring:

- The live strategy behind `CompoundingStakingStrategyProxy` is the **vanilla
  `CompoundingStakingStrategy`**. `REGISTERED` and `REMOVED` are unreachable states, entry
  is `NON_REGISTERED → STAKED` via the base `_admitStake` (`:462-473`), and `INVALID` / `EXITED`
  are absolutely terminal.
- `initialDepositAmountWei` is currently **2030 ETH** on mainnet (deployment 199, line 101), not
  the 1 ETH default used in tests and on Hoodi (`deploy/deployActions.js:243-248`). Deployment 005
  proposes lowering it to **32.25 ETH**. Consensus rewards will then push the balance over the
  strategy's strict `> 32.25 ETH` transition to `ACTIVE`.
- Deployment 202 changed the strategy's registrator from the retired `ConsolidationController` to
  the **Talos relayer**. It can call `stakeEth` and `validatorWithdrawal`, including full exits.
- In the current source all four proof entrypoints are directly permissionless. The 420-second
  `SNAP_BALANCES_DELAY` bounds re-snapshot griefing; `verifyBalances` accepts only proofs anchored
  to the stored beacon block root. `scripts/deploy/mainnet/005_UpgradeCompoundingStakingStrategy.s.sol`
  deploys and proposes this implementation upgrade and lowers `initialDepositAmountWei` to
  32.25 ETH. Until that proposal executes on mainnet, the deployed implementation still
  applies `onlyRegistrator` to `snapBalances` and `verifyBalances`, so the Talos relayer remains
  their only direct caller and the first-deposit cap remains 2030 ETH.

### Known accounting errors

1. **Postponed deposit to a slashed validator** — *undercount* (`:66-81`, `:1121-1123`). Once
   `W <= H`, `verifyDeposit` succeeds and the deposit leaves `depositList` — but the beacon chain
   may not have credited it yet. The contract believes the ETH is in a balance while it is still
   queued, so `checkBalance` shows a deficit for days or weeks (bounded by the 36.4-day slashing
   withdrawability delay). Explicitly accepted: it offsets yield and cannot double count.
2. **ETH arriving between snap and verify** — *undercount*. Sweeps, MEV and donations via
   `receive()` are not counted until the next cycle.
3. **No staleness guard on `checkBalance`.** If `verifyBalances` stops succeeding, the vault keeps
   reading a stale `lastVerifiedEthBalance` indefinitely. Consensus rewards accrue invisibly
   (undercount); a slashing is invisible until the next verify (**overcount** — the one direction
   that is not conservative). Note from §6 that staleness is not purely operational: a processed
   deposit *forces* `verifyBalances` to revert until the verify sequence completes.

### Liveness risks

- **A deposit that leaves the beacon queue without creating a validator permanently bricks
  `verifyBalances`.** If a `stakeEth` to a brand-new validator carries an invalid BLS signature,
  Electra's `apply_pending_deposit` discards it and no validator is created. Then:
  `verifyValidator` is unprovable (no such pubkey in `state.validators`, so the validator is stuck
  `STAKED`) → `verifyDeposit` fails its `VERIFIED/ACTIVE/EXITING` gate (`:719-724`) → the entry can
  never leave `depositList` (`depositList.pop()` occurs only in `_removeDeposit` at `:829`, whose
  only callers are `:636` and `:810`, both gated on validator state) → `verifyBalances` reverts
  forever and `lastVerifiedEthBalance` freezes.

  There is no *governance* escape hatch, and the strategy cannot re-stake to that pubkey either
  (`_admitStake` rejects `STAKED`). The unblock has to come from outside: **anyone** can send a
  1 ETH deposit for that pubkey directly to the beacon deposit contract, which creates the
  validator and re-enables `verifyValidator`. Either outcome then resolves correctly — matching
  `0x02 ‖ address(this)` credentials put the validator on the normal path, non-matching ones take
  the `INVALID` branch (`:621-648`) — and in both cases the next `verifyBalances` writes off the
  burned ETH, because the deposit is no longer in `totalDepositsWei` and never entered a balance.
  So the loss is realised correctly; it is availability that is at risk, potentially for as long
  as it takes someone to notice.

  The real mitigation is off-chain: `verifyDepositSignatureAndMessageRoot`
  (`utils/beacon.js:497-567`) BLS-verifies before staking, and is called **only for the first
  deposit** (`tasks/validatorCompound.js:255-271`) — which is exactly the deposit that can trigger
  this, since top-ups go to an already-registered pubkey where the CL ignores the signature.
- **Proof-set invalidation between snap and verify.** `verifyBalances` requires the proof array
  lengths to equal `verifiedValidators.length` and `depositList.length` *exactly* (`:1018-1026`,
  `:1125-1133`), while `verifyValidator` and `verifyDeposit` are permissionless. Anyone holding
  valid proofs can therefore push or pop an entry between the snap and the verify and invalidate an
  in-flight proof set. Narrow in practice (only the registrator can create a `STAKED` validator to
  verify) but it is a second griefing vector alongside re-snapping.
- **A `VERIFIED` validator below 32.25 ETH cannot be exited.** `validatorWithdrawal` requires
  `ACTIVE || EXITING` (`:527-531`), and the only route to `ACTIVE` is `verifyBalances` observing a
  balance strictly above `MIN_ACTIVATION_BALANCE_GWEI` (`:1100-1107`). A validator stuck below that
  can only be freed by a top-up via `stakeEth`, which *is* permitted from `VERIFIED`. Live concern
  wherever `initialDepositAmountWei` is 1 ETH (Hoodi and tests,
  `deploy/deployActions.js:243-248`); a non-issue at mainnet's current 2030 ETH and proposed
  32.25 ETH cap once consensus rewards accrue. Note there is also no `ACTIVE → VERIFIED` demotion,
  so a slashed validator that falls back below 32.25 ETH stays exitable — the desired behaviour,
  but nowhere written down.
- **`resetFirstDeposit` weakens two bounds it is credited with.** It clears `firstDeposit`
  (`:326-334`) without touching the outstanding validator, which stays `STAKED` and can still be
  verified later by the permissionless `verifyValidator`. So `verifiedValidators.length <= 48` is
  **not an invariant** — at 47, staking A, resetting, staking B, then verifying both yields 49.
  Nothing reverts at the bound (`verifyBalances` just wants longer arrays), but the constant is
  advisory, not enforced. The same reset also lifts the "at most one in-flight unverified deposit"
  cap on front-running exposure. Intended use is the `INVALID` case, where the validator can never
  be verified again.

### Attack surface

- **Deposit front-running.** The EL deposit contract accepts a deposit for *any* pubkey from
  *anyone*, and the CL sets `withdrawal_credentials` only when the validator record is created —
  every later deposit for that pubkey ignores the supplied credentials and signature entirely. So
  an attacker watching `stakeEth` in the mempool (public tx, pubkey in the clear) can land a small
  deposit first with their own credentials; ours becomes an unrecoverable top-up to their
  validator. This is exactly why only the *first* deposit is gated and top-ups are unbounded above
  (`:390` only enforces `>= 1 ether`): once the validator exists with `0x02 ‖ address(this)`,
  credentials can no longer be hijacked.

  Mitigations: `firstDeposit` allows only one unverified new validator at a time (`:483`); the
  first deposit is capped at `initialDepositAmountWei` (`:485-487`) — currently **2030 ETH on
  mainnet**, with deployment 005 proposing **32.25 ETH** — and `verifyValidator` compares
  the proven credentials to `0x02 ‖ bytes11(0) ‖ address(this)`, marking the validator `INVALID`,
  dropping the deposit and *immediately* debiting `lastVerifiedEthBalance` on mismatch (`:621-648`).
  `firstDeposit` stays `true`, so a human must call `resetFirstDeposit` before staking to another
  new validator. `stakeEth` goes through the public mempool
  (`tasks/validatorCompound.js:300-306`); there is no private-relay submission in-repo.

  Note how the credentials are proven: `verifyValidator` reads them from `proof[:32]`
  (`BeaconProofsLib.sol:106`). In the `Validator` container the sibling of `pubkey` (index 0) *is*
  `withdrawal_credentials` (index 1), so proving the pubkey pins the credentials at no extra cost.
  The `break` after the first matching deposit at `:637` is safe because a `STAKED` validator can
  have exactly one deposit — `_admitStake` rejects `STAKED`, so no second `stakeEth` can add one
  while the validator is unverified.
- **Snap griefing.** Repeated `snapBalances` before the operator can verify. Bounded by the 420 s
  delay, and `verifyBalances` never gets *wrong* data — it just may need a retry.
- **Reorgs.** Proofs are built against a specific block root; a reorg makes the proof fail rather
  than produce a wrong value. `verifyDeposits` reads at `head - 30` (`tasks/beacon.js:273`), well
  past finality-ish depth.
- **Missed slots.** `verifyDeposit`/`verifyValidator` need slot `S+1` to have produced a block;
  otherwise pick a different slot.
- **Registrator compromise.** Can stake to undesirable validators; bounded by `pause` (available
  to the registrator *and* governor) and the first-deposit cap.

### Operational constraint: deposit-root collisions

The deposit ID is `merkleizePendingDeposit(pubKeyHash, creds, amountGwei, signature, depositSlot)`.
`creds` are constant and, **for top-ups, the off-chain task substitutes a fixed dummy signature**
`0x00…01` (`tasks/validatorCompound.js:269-271` — "the signature doesn't matter after the first
deposit", which is true on the CL). So a top-up's root degenerates to a function of
`(pubkey, amount, slot)`, and two identical top-ups to the same validator in the same slot collide
on `require(status == UNKNOWN, "Duplicate deposit")` (`:422-425`). Because `_removeDeposit` leaves
the mapping entry as `VERIFIED` rather than clearing it (`:823`), **a root is single-use forever** —
the collision is permanent, not per-block. Different slots produce different roots, so this only
bites within a single slot.

---

## 9. Worked example (real mainnet data)

From `test/beacon/beaconProofs.js:204-225` — a real balance proof:

```
balancesContainerRoot = 0xdbdf8b18bb50a2ac84864bf12779da475aca1e2b98854b2a1b02506396250eff
validatorIndex        = 1770193
balanceLeaf           = 0x0000000000000000 f5b8747307000000 0000000000000000 dd06757307000000
proof                 = 1248 bytes = 39 witnesses
```

- `balanceIndex = 1770193 / 4 = 442548`, `1770193 % 4 = 1`.
- gindex inside the balances container = `(1 << 39) | 442548 = 549,756,256,436`.
- The leaf packs four validators' balances:

  | slot | validator | LE bytes | gwei | ETH |
  |---|---|---|---|---|
  | 0 | 1770192 | `0000000000000000` | 0 | 0 |
  | 1 | **1770193** | `f5b8747307000000` | **32,001,800,437** | 32.001800437 |
  | 2 | 1770194 | `0000000000000000` | 0 | 0 |
  | 3 | 1770195 | `dd06757307000000` | 32,001,820,381 | 32.001820381 |

- `balanceAtIndex(leaf, 1770193)` shifts left by `1 × 64` bits, takes the top 8 bytes, reverses
  them → `32001800437`, which is what the test asserts.
- Multiplied by `1 gwei` this contributes `32.001800437e18` wei to `totalValidatorBalance`.

Then the 39-node proof lifts the leaf to `balancesContainerRoot`, and a separate 9-node proof
(`gindex 716`) lifts that container root to the snapped beacon block root. Two hops, 48 hashes
total per validator.

---

## 10. Forward compatibility — read this before a hard fork

The gindices in `BeaconProofsLib.sol` are hard-coded and depend on `BeaconState`'s field count,
field order and merkleization scheme. **They are Electra-or-later constants and nothing in the
contract checks the fork.**

Mainnet fork schedule (`configs/mainnet.yaml`, verified 2026-08-06):

| Fork | Epoch | Date |
|---|---|---|
| Deneb | 269568 | 2024-03-13 |
| Electra | 364032 | 2025-05-07 |
| **Fulu (Fusaka)** | **411392** | **2025-12-03 — live head fork** |
| Gloas | `2**64-1` | **not scheduled** |
| Heze | `2**64-1` | not scheduled |

- **Deneb and earlier — already incompatible.** Deneb's `BeaconState` has 28 fields ⇒ height **5**,
  so `balances` sits at gindex `(11 << 5) | 12 = 364`, not 716. These proofs cannot be used against
  a pre-Electra block root. Not a live concern, but it demonstrates that a fork *has* moved these
  constants before.
- **Electra** — 37 fields, height 6. Baseline; all constants correct.
- **Fulu (live)** — appends `proposer_lookahead` at index 37 ⇒ 38 fields. `ceil(log2(38))` is still
  6 and the append does not move indices 11/12/34, so **715 / 716 / 738 are unchanged and every
  proof keeps working**. Fulu's `process_pending_deposits` differs from Electra only by dropping the
  eth1-bridge guard; the postponement logic the deposit proof depends on is byte-identical.
- **Gloas (EIP-7688 / EIP-7732) — BREAKING, but unscheduled.** Two independent changes, either of
  which alone would invalidate the constants:
  1. `BeaconState` becomes `ProgressiveContainer(active_fields=[1] * 46)` (46 fields —
     `latest_execution_payload_header` removed, `latest_block_hash` inserted, 9 appended).
     Progressive containers abandon the fixed-depth `(parent << height) | index` scheme, so
     `gindex(balances)` moves from 716 to 359. Note `validators` / `balances` /
     `pending_deposits` keep field indices 11/12/34 — index stability is *not* sufficient, because
     the merkleization itself changes.
  2. `Balances`, `Validators`, `PendingDeposits` and `PendingPartialWithdrawals` all become
     **`ProgressiveList`** (`specs/gloas/beacon-chain.md:228,370,319,329`). A progressive list has
     no limit-sized subtree, so there is **no constant tree height at all** — element depth grows
     with the registry as `10 + 3k` for progressive segment `k`. Every hard-coded proof length in
     `BeaconProofsLib.sol` (39 / 41 / 28 and the derived 1248 / 1696 / 896 byte checks) stops being
     a constant and becomes size-dependent. This is a redesign, not a constant swap.

  Heze uses the same `ProgressiveContainer` scheme and is likewise unscheduled.

Guard rails when a fork lands: a field count staying ≤ 64 keeps the height at 6; appended fields
are safe; fields inserted or removed *before* index 34 are not; a change of container kind
invalidates everything. The off-chain generator derives gindices dynamically from `@lodestar/types`
(`stateView.type.getPathInfo([...]).gindex`, `utils/proofs.js`), so it will silently follow a fork
while the contract does not — the failure mode is proof-verification reverts, not wrong values.

To re-derive: `ethereum/consensus-specs` renamed its default branch from `dev` to **`master`**;
`raw.githubusercontent.com/.../dev/...` URLs now 404. Use
`gh api repos/ethereum/consensus-specs/contents/specs/<fork>/beacon-chain.md --jq .content | base64 -d`.

---

## 11. Test coverage

- `tests/unit/beacon/BeaconProofsLib/**` — every entrypoint's proof-length and revert-string cases,
  `balanceAtIndex` packing, `concatGenIndices` arithmetic, fuzz.
- `tests/unit/beacon/{Merkle,Endian}/**` — primitives.
- `tests/fork/mainnet/beacon/**` — real proofs and the live EIP-4788 ring buffer.
- `tests/unit/strategies/CompoundingStakingStrategy/**` — state machine, including
  `TwentyOneValidators.t.sol` (real 21-validator proofs), `SlashedValidatorDeposit.t.sol`,
  `FrontRunAndInvalid.t.sol`, `VerifyDeposit.t.sol`.
- `test/beacon/beaconProofs.js` — hard-coded real mainnet/Hoodi proofs (source of §9).

Caveat from `tests/unit/strategies/CompoundingStakingStrategy/README.md`: many strategy unit
tests swap in `MockBeaconProofs`, which **auto-passes all verification**. Those tests exercise the
accounting state machine, not the proofs. Real-proof coverage lives in the `BeaconProofsLib` unit
tests, the fork tests, and `TwentyOneValidators.t.sol`.
