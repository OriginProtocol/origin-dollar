# Automation

This directory contains Safe Module contracts for automating protocol operations.

## Overview

Automation modules extend Gnosis Safe functionality to enable operators to execute specific, pre-approved actions without requiring full multisig approval for each transaction.

## Contracts

### Base Contracts

| Contract | Description |
|----------|-------------|
| `AbstractSafeModule.sol` | Base contract for all Safe modules with operator role management |

### Bridge Helpers

| Contract | Description |
|----------|-------------|
| `AbstractCCIPBridgeHelperModule.sol` | Base for Chainlink CCIP bridge operations |
| `AbstractLZBridgeHelperModule.sol` | Base for LayerZero bridge operations |
| `BaseBridgeHelperModule.sol` | Common bridge helper functionality |
| `EthereumBridgeHelperModule.sol` | Ethereum mainnet bridge operations |
| `PlumeBridgeHelperModule.sol` | Plume network bridge operations |

### Operational Modules

| Contract | Description |
|----------|-------------|
| `ClaimBribesSafeModule.sol` | Automate claiming of bribe rewards |
| `ClaimStrategyRewardsSafeModule.sol` | Automate claiming strategy rewards |
| `CollectXOGNRewardsModule.sol` | Automate collection of xOGN rewards |
| `CurvePoolBoosterBribesModule.sol` | Automate Curve pool booster bribes |

## Architecture

All modules inherit from `AbstractSafeModule` which provides:
- **Operator Role**: Designated addresses can trigger module actions
- **Safe Integration**: Modules execute transactions through the Safe contract
- **Access Control**: OpenZeppelin's `AccessControlEnumerable` for role management

## Usage

Modules are registered with a Gnosis Safe and can then be triggered by operators to execute pre-defined actions safely.
