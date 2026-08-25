# CompoundingStakingStrategy — Foundry Tests

## Coverage Notes

The unit tests here use `MockBeaconProofs` which auto-passes all proof verification. This covers the strategy's state machine logic thoroughly but does **not** exercise the real `BeaconChainProofs` library.

### Test data

Validator test data is loaded at runtime from `tests/unit/strategies/CompoundingStakingStrategy/fixtures/validators.json` using `vm.readFile` + `stdJson`. The JSON contains 21 validators with public keys, operator IDs, shares data, signatures, and deposit data roots.
