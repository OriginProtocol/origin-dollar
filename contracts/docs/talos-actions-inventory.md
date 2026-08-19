# Talos action inventory (generated)

> Regenerate: `node scripts/talos/action-chains.mjs > docs/talos-actions-inventory.md`

## A1. Chains supported per action

| chains | actions |
|---|---|
| eth | autoValidatorDeposits, autoValidatorWithdrawals, claimSSVRewards, executeGovernorSixProposal, harvest, manageBribes, managePassThrough, ognClaimAndForwardRewards, otokenOethRebase, otokenOusdAutoWithdrawal, otokenOusdOethRebase, otokenOusdRebase, ousdRebalancer, queueGovernorSixProposal, removeValidator, snapBalances, stakeValidator, verifyBalances, verifyDeposits |
| sonic | manageBribeOnSonic, otokenOsCollectAndRelease, otokenOsRebase, otokenOsSonicRestakeRewards, sonicClaimWithdrawals, sonicUndelegate |
| hyper | crossChainBalanceUpdateHyperevm |
| base | claimBribes, crossChainBalanceUpdateBase, otokenOethbHarvest, otokenOethbRebase, otokenOethbUpdateWoethPrice |
| eth, hyper | crossChainRelayHyperEVM |
| arb | updateVotemarketEpochs |
| eth, base | crossChainRelay, manageMerklBribes, proposeVaultStrategyMoves, relayCCTPMessage |
| eth, hoodi | doAccounting, registerValidators, stakeValidators |
| eth, sonic, base | permissionedRebase |
| eth, sonic, base, plume | otokenAddWithdrawalQueueLiquidity |
| eth, sonic, hyper, base, holesky, arb, plume, hoodi | healthcheck |

## A2. Utility / lib / abi -> union of importing actions' chains

| module | # chains | chains |
|---|---|---|
| `tasks/lib/action` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `tasks/lib/logger` | 7 | eth, sonic, hyper, base, arb, plume, hoodi |
| `utils/logger` | 7 | eth, sonic, hyper, base, arb, plume, hoodi |
| `tasks/lib/network` | 6 | eth, sonic, hyper, base, arb, plume |
| `utils/addresses` | 6 | eth, sonic, hyper, base, arb, hoodi |
| `utils/txLogger` | 6 | eth, sonic, hyper, base, plume, hoodi |
| `tasks/lib/contracts` | 5 | eth, sonic, hyper, base, plume |
| `utils/localKeyValueStore` | 4 | eth, hyper, base, hoodi |
| `tasks/lib/signer` | 3 | eth, base, arb |
| `utils/cctp` | 3 | eth, hyper, base |
| `utils/regex` | 3 | eth, base, arb |
| `utils/signers` | 3 | eth, base, arb |
| `utils/signersNoHardhat` | 3 | eth, base, arb |
| `abi/erc20.json` | 2 | eth, sonic |
| `abi/IWETH9.json` | 2 | eth, hoodi |
| `abi/native_staking_SSV_strategy.json` | 2 | eth, hoodi |
| `tasks/lib/safeProposal` | 2 | eth, base |
| `tasks/lib/vaultStrategyMoves` | 2 | eth, base |
| `utils/resolvers` | 2 | eth, base |
| `utils/validator` | 2 | eth, hoodi |
| `abi/claim-rewards-module.json` | 1 | eth |
| `abi/cumulative_merkle_drop.json` | 1 | eth |
| `abi/generalized_4626_strategy.json` | 1 | eth |
| `abi/harvester.json` | 1 | eth |
| `abi/passThrough.json` | 1 | eth |
| `abi/poolBoosterCentralRegistry.json` | 1 | sonic |
| `abi/poolBoosterSwapX.json` | 1 | sonic |
| `abi/sonic_staking_strategy.json` | 1 | sonic |
| `abi/vault.json` | 1 | sonic |
| `utils/beacon` | 1 | eth |
| `utils/constants` | 1 | eth |
| `utils/discord` | 1 | eth |
| `utils/hardhat` | 1 | eth |
| `utils/hardhat-helpers` | 1 | eth |
| `utils/harvest` | 1 | eth |
| `utils/managePassThrough` | 1 | eth |
| `utils/morpho-apy` | 1 | eth |
| `utils/p2pValidatorCompound` | 1 | eth |
| `utils/proofs` | 1 | eth |
| `utils/rebalancer` | 1 | eth |
| `utils/rebalancer-config` | 1 | eth |
| `utils/sonicActions` | 1 | sonic |
| `utils/ssv` | 1 | eth |
| `utils/units` | 1 | eth |
| `utils/vault` | 1 | eth |
