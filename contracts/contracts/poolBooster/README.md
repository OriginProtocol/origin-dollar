# Pool Booster

This directory contains contracts for boosting liquidity pool incentives.

## Overview

Pool Booster contracts distribute Origin token rewards to liquidity providers through various incentive distribution platforms like Merkl and Metropolis.

## Contracts

### Core

| Contract | Description |
|----------|-------------|
| `PoolBoostCentralRegistry.sol` | Central registry tracking all pool boosters |
| `AbstractPoolBoosterFactory.sol` | Base factory for deploying pool boosters |

### Merkl Integration

| Contract | Description |
|----------|-------------|
| `PoolBoosterMerkl.sol` | Pool booster using Merkl distribution |
| `PoolBoosterFactoryMerkl.sol` | Factory for deploying Merkl boosters |

### Metropolis Integration

| Contract | Description |
|----------|-------------|
| `PoolBoosterMetropolis.sol` | Pool booster using Metropolis distribution |
| `PoolBoosterFactoryMetropolis.sol` | Factory for deploying Metropolis boosters |

### Swapx Integration

| Contract | Description |
|----------|-------------|
| `PoolBoosterSwapxSingle.sol` | Single-token Swapx pool booster |
| `PoolBoosterSwapxDouble.sol` | Dual-token Swapx pool booster |
| `PoolBoosterFactorySwapxSingle.sol` | Factory for single-token Swapx boosters |
| `PoolBoosterFactorySwapxDouble.sol` | Factory for dual-token Swapx boosters |

## Architecture

1. **Registry**: Tracks all deployed pool boosters
2. **Factories**: Deploy new pool boosters with consistent configuration
3. **Boosters**: Distribute rewards to target liquidity pools

## Usage

Pool boosters are funded with Origin tokens (OS) and create incentive campaigns on the respective platforms to attract liquidity to OETH/OUSD pools.
