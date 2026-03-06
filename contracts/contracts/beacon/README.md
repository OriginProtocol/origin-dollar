# Beacon

This directory contains contracts for Ethereum Beacon Chain proof verification.

## Overview

These contracts enable verification of Beacon Chain data through Merkle proofs, which is essential for OETH's native staking functionality. They verify validator states, withdrawal credentials, and other beacon chain data.

## Contracts

| Contract | Description |
|----------|-------------|
| `BeaconProofs.sol` | Main contract for verifying beacon chain Merkle proofs |
| `BeaconProofsLib.sol` | Library implementation of proof verification logic |
| `BeaconConsolidation.sol` | Handles validator consolidation proofs |
| `BeaconRoots.sol` | Access to beacon block roots (EIP-4788) |
| `Merkle.sol` | Merkle tree utilities for proof verification |
| `Endian.sol` | Endianness conversion utilities |
| `PartialWithdrawal.sol` | Handles partial withdrawal proofs |

## Use Cases

- **Validator Verification**: Verify validator public keys and indices
- **Withdrawal Credentials**: Confirm validators point to correct withdrawal addresses
- **Withdrawal Proofs**: Verify partial and full validator withdrawals
- **Consolidation**: Handle validator consolidation operations

## Integration

These contracts are used by the Native Staking strategy (`strategies/NativeStaking/`) to verify on-chain that validators are correctly configured and to process withdrawals trustlessly.
