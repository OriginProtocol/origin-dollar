# CompoundingStakingStrategy — Foundry Tests

## Coverage Notes

Most unit tests here use `MockBeaconProofs`, which auto-passes proof verification and isolates the strategy's state machine. The historical-fixture tests use `EnhancedBeaconProofs` to exercise the real `BeaconProofs` implementation.

### Legacy Hardhat parity

The deleted Hardhat coverage came from two files:

- All nine first-deposit/reset scenarios from the final `compoundingStaking.js` are covered in `concrete/ValidatorStaking.t.sol` and `concrete/Configuration.t.sol`, including exact staking events and the large-deposit boundaries.
- The older `compoundingSSVStaking.js` contained the historical Beacon-proof scenarios summarized below.

The three 21-validator scenarios were ported with their historical Beacon proofs in `concrete/TwentyOneValidators.t.sol`.

The remaining historical scenarios are covered with the original Beacon proof snapshots:

- `concrete/HistoricalBalanceTransitions.t.sol` covers consensus and execution rewards across snapshots;
- `concrete/HistoricalWithdrawals.t.sol` covers pending and processed partial withdrawals, full withdrawal, and pending deposits on a zero-balance validator;
- `concrete/RealValidatorProofs.t.sol` provides a positive control and rejects invalid withdrawal credential type and non-zero padding through the strategy.

The historical tests are deterministic and do not require an RPC fork.

### Test data

Validator test data is loaded at runtime from `tests/unit/strategies/CompoundingStakingStrategy/fixtures/validators.json` using `vm.readFile` + `stdJson`. The JSON contains 21 validators with public keys, operator IDs, shares data, signatures, and deposit data roots.
