# Zapper

This directory contains zapper contracts for simplified token operations.

## Overview

Zappers provide one-transaction convenience functions that combine multiple operations, such as wrapping and bridging in a single call.

## Contracts

| Contract | Description |
|----------|-------------|
| `WOETHCCIPZapper.sol` | Zap ETH on mainnet directly to WOETH on L2 chains |

## WOETHCCIPZapper

The WOETH CCIP Zapper enables users to convert ETH on Ethereum mainnet directly into Wrapped OETH (WOETH) on supported L2 chains in a single transaction.

### Flow

1. User sends ETH to the zapper
2. Zapper converts ETH to OETH via the OETH Zapper
3. OETH is wrapped to WOETH
4. WOETH is bridged to the destination chain via Chainlink CCIP
5. WOETH arrives at the recipient address on L2

### Benefits

- **Gas Efficient**: Single transaction instead of multiple
- **User Friendly**: No need to manage intermediate tokens
- **Cross-Chain**: Direct mainnet ETH to L2 WOETH

## Events

- `Zap`: Emitted on each successful zap with message ID, sender, recipient, and amount
