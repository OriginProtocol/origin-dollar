# Bridges

This directory contains contracts for cross-chain token bridging using omnichain standards.

## Overview

Bridge adapters enable OETH and other Origin tokens to be bridged across multiple chains using LayerZero's Omnichain Fungible Token (OFT) standard.

## Contracts

| Contract | Description |
|----------|-------------|
| `OmnichainL2Adapter.sol` | LayerZero OFT adapter for L2 chains (mint/burn mechanism) |
| `OmnichainMainnetAdapter.sol` | LayerZero OFT adapter for Ethereum mainnet (lock/unlock mechanism) |

## Architecture

### Mainnet (Lock/Unlock)
On Ethereum mainnet, the adapter locks tokens when bridging out and unlocks when receiving from L2s.

### L2 (Mint/Burn)
On L2 chains, the adapter mints tokens when receiving from mainnet and burns when bridging back.

## Integration

These adapters integrate with LayerZero's messaging infrastructure to enable secure cross-chain token transfers while maintaining a unified token supply across all chains.

## Related

- See `automation/` for bridge helper modules that assist with cross-chain operations
