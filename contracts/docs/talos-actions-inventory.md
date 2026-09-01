# Talos action inventory (generated)

> Regenerate: `node scripts/talos/action-chains.mjs > docs/talos-actions-inventory.md`

## A1. Chains supported per action

| chains | actions |
|---|---|
| eth | autoValidatorDeposits, autoValidatorWithdrawals, executeGovernorSixProposal, harvest, manageBribes, managePassThrough, ognClaimAndForwardRewards, otokenOethRebase, otokenOusdAutoWithdrawal, otokenOusdRebase, ousdRebalancer, queueGovernorSixProposal, snapBalances, stakeValidator, verifyBalances, verifyDeposits, withdrawValidator |
| sonic | manageBribeOnSonic, otokenOsCollectAndRelease, otokenOsRebase, otokenOsSonicRestakeRewards, sonicClaimWithdrawals, sonicUndelegate |
| hyper | crossChainBalanceUpdateHyperevm |
| base | claimBribes, crossChainBalanceUpdateBase, otokenOethbHarvest, otokenOethbRebase, otokenOethbUpdateWoethPrice |
| eth, hyper | crossChainRelayHyperEVM |
| arb | updateVotemarketEpochs |
| eth, base | crossChainRelay, manageMerklBribes, proposeVaultStrategyMoves, relayCCTPMessage |
| eth, hoodi | doAccounting, registerValidators, stakeValidators |
| eth, sonic, base, plume | otokenAddWithdrawalQueueLiquidity |
| eth, sonic, hyper, base, holesky, arb, plume, hoodi | healthcheck |

## A2. Utility / lib / abi -> union of importing actions' chains

| module | # chains | chains |
|---|---|---|
| `tasks/lib/action` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `tasks/lib/logger` | 6 | eth, sonic, hyper, base, arb, plume |
| `tasks/lib/network` | 6 | eth, sonic, hyper, base, arb, plume |
| `utils/logger` | 6 | eth, sonic, hyper, base, arb, plume |
| `tasks/lib/contracts` | 5 | eth, sonic, hyper, base, plume |
| `utils/addresses` | 5 | eth, sonic, hyper, base, arb |
| `utils/txLogger` | 5 | eth, sonic, hyper, base, plume |
| `tasks/lib/signer` | 3 | eth, base, arb |
| `utils/cctp` | 3 | eth, hyper, base |
| `utils/localKeyValueStore` | 3 | eth, hyper, base |
| `utils/regex` | 3 | eth, base, arb |
| `utils/signers` | 3 | eth, base, arb |
| `utils/signersNoHardhat` | 3 | eth, base, arb |
| `tasks/lib/safeProposal` | 2 | eth, base |
| `tasks/lib/vaultStrategyMoves` | 2 | eth, base |
| `utils/resolvers` | 2 | eth, base |
| `abi/claim-rewards-module.json` | 1 | eth |
| `abi/erc20.json` | 1 | sonic |
| `abi/passThrough.json` | 1 | eth |
| `abi/poolBoosterCentralRegistry.json` | 1 | sonic |
| `abi/poolBoosterSwapX.json` | 1 | sonic |
| `abi/sonic_staking_strategy.json` | 1 | sonic |
| `abi/vault.json` | 1 | sonic |
| `utils/beacon` | 1 | eth |
| `utils/constants` | 1 | eth |
| `utils/discord` | 1 | eth |
| `utils/hardhat` | 1 | eth |
| `utils/harvest` | 1 | eth |
| `utils/managePassThrough` | 1 | eth |
| `utils/morpho-apy` | 1 | eth |
| `utils/proofs` | 1 | eth |
| `utils/rebalancer` | 1 | eth |
| `utils/rebalancer-config` | 1 | eth |
| `utils/sonicActions` | 1 | sonic |
| `utils/units` | 1 | eth |
| `utils/vault` | 1 | eth |
