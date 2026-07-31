# CompoundingStakingSSVStrategy — Foundry Tests

## Coverage Notes

The unit tests here use `MockBeaconProofs` which auto-passes all proof verification. This covers the strategy's state machine logic thoroughly but does **not** exercise the real `BeaconChainProofs` library.

### Hardhat tests not yet ported (candidates for fork tests)

The following Hardhat test scenarios from `test/strategies/compoundingSSVStaking.js` require real beacon chain proof data and are not suitable for mock-based unit tests. They should be ported as **fork tests** instead:

1. **21-validator balance verification** (lines 2622-2695)
   - `"Should verify balances with some WETH, ETH and no deposits"` — 21 active validators with real balance proofs
   - `"Should verify balances with one validator exited with two pending deposits"` — exited validator among 21
   - `"Should verify balances with one validator exited with two pending deposits and three deposits to non-exiting validators"` — mixed active/exited validators with multiple pending deposits

2. **Multi-validator consensus rewards** (lines 2470-2530)
   - `"consensus rewards are earned by the validators"` — 2 active validators, real `testBalancesProofs[3]` and `[4]` data showing balance increase
   - `"execution rewards are earned as ETH in the strategy"` — ETH balance tracking across snap/verify cycles

3. **Partial/full withdrawal with real balance tracking** (lines 2306-2468)
   - `"Should account for a pending partial withdrawal"` — uses `testBalancesProofs[0]` with real validator balances
   - `"Should account for a processed partial withdrawal"` — balance diff between `testBalancesProofs[0]` and `[1]`
   - `"Should account for full withdrawal"` — validator exit with real balance data from `testBalancesProofs[1]` and `[2]`

4. **Proof-level credential validation** (lines 2254-2280)
   - `"Should not verify a validator with incorrect withdrawal credential validator type"` — mutates real proof bytes
   - `"Should not verify a validator with incorrect withdrawal zero padding"` — mutates real proof bytes

5. **`hackDepositList` storage manipulation scenarios** (lines 1484-1554)
   - `"Should not remove a validator if it still has a pending deposit"` — overwrites `depositList` storage slots to match proof fixtures, then runs multiple snap/verify cycles

These tests rely on the `testBalancesProofs` array (loaded from external JSON fixtures) containing real beacon block roots, validator balance leaves, and Merkle proofs. They also use `hackDepositList` to manipulate strategy storage for proof consistency.

### Test data

Validator test data is loaded at runtime from `test/strategies/compoundingSSVStaking-validatorsData.json` using `vm.readFile` + `stdJson`. The JSON contains 21 validators with public keys, operator IDs, shares data, signatures, and deposit data roots.
