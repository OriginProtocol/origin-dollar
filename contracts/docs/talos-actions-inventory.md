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
| eth, base | crossChainRelay, manageMerklBribes, relayCCTPMessage |
| eth, holesky | stakeValidators |
| eth, hoodi | doAccounting, registerValidators |
| eth, sonic, base | permissionedRebase |
| eth, sonic, base, plume | otokenAddWithdrawalQueueLiquidity |
| eth, sonic, hyper, base, holesky, arb, plume, hoodi | healthcheck |

## A2. Utility / lib / abi -> union of importing actions' chains

| module | # chains | chains |
|---|---|---|
| `tasks/lib/action` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `tasks/lib/logger` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `utils/logger` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `utils/regex` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `utils/signers` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `utils/signersNoHardhat` | 8 | eth, sonic, hyper, base, holesky, arb, plume, hoodi |
| `utils/addresses` | 7 | eth, sonic, hyper, base, holesky, arb, hoodi |
| `utils/txLogger` | 6 | eth, sonic, hyper, base, plume, hoodi |
| `utils/defender` | 5 | eth, hyper, base, holesky, hoodi |
| `abi/IWETH9.json` | 3 | eth, holesky, hoodi |
| `abi/native_staking_SSV_strategy.json` | 3 | eth, holesky, hoodi |
| `utils/cctp` | 3 | eth, hyper, base |
| `utils/hardhat-helpers` | 3 | eth, hyper, base |
| `utils/validator` | 3 | eth, holesky, hoodi |
| `abi/erc20.json` | 2 | eth, sonic |
| `utils/resolvers` | 2 | eth, base |
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
