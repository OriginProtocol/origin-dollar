# Buyback

This directory contains contracts for protocol buyback mechanisms.

## Overview

Buyback contracts swap protocol yield (OUSD/OETH) for governance tokens (OGN) and CVX, supporting token value and protocol governance power.

## Contracts

| Contract | Description |
|----------|-------------|
| `AbstractBuyback.sol` | Base buyback implementation with common logic |
| `OUSDBuyback.sol` | OUSD-specific buyback contract |
| `OETHBuyback.sol` | OETH-specific buyback contract |
| `ARMBuyback.sol` | ARM (Automated Redemption Manager) buyback contract |

## Mechanism

1. **Yield Collection**: Protocol yield is collected from strategies
2. **Swap Execution**: Yield tokens are swapped via 1inch or other DEX aggregators
3. **Token Distribution**: 
   - OGN is sent to treasury or staking
   - CVX is locked in vlCVX for voting power

## Configuration

- **CVX Share BPS**: Configurable percentage split between OGN and CVX
- **Rewards Source**: Address that receives buyback proceeds
- **Treasury Manager**: Address managing treasury operations
- **Swap Router**: DEX aggregator for executing swaps

## Access Control

Buyback operations are restricted to the Strategist role, ensuring controlled execution of swaps with appropriate slippage parameters.
