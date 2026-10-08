# Talos action inventory (generated)

> Regenerate: `node scripts/talos/action-chains.mjs > docs/talos-actions-inventory.md`

## A1. Chains supported per action

| chains | actions |
|---|---|
| eth | autoValidatorDeposits, autoValidatorWithdrawals, cowHarvest, executeGovernorSixProposal, feeSplitterDistribute, harvest, manageBribes, managePassThrough, ognClaimAndForwardRewards, otokenOethRebase, otokenOusdAutoWithdrawal, otokenOusdRebase, ousdRebalancer, queueGovernorSixProposal, setXOGNRewardRate, snapBalances, stakeValidator, verifyBalances, verifyDeposits, withdrawValidator |
| hyper | crossChainBalanceUpdateHyperevm |
| base | claimBribes, crossChainBalanceUpdateBase, otokenOethbHarvest, otokenOethbRebase, otokenOethbUpdateWoethPrice |
| eth, hyper | crossChainRelayHyperEVM |
| arb | updateVotemarketEpochs |
| eth, base | crossChainRelay, manageMerklBribes, permissionedRebase, proposeVaultStrategyMoves, relayCCTPMessage |
| eth, sonic, base, plume | otokenAddWithdrawalQueueLiquidity |
| eth, sonic, hyper, base, arb, plume, hoodi | healthcheck |

## A2. Utility / lib / abi -> union of importing actions' chains

| module | # chains | chains |
|---|---|---|
| `tasks/lib/action` | 7 | eth, sonic, hyper, base, arb, plume, hoodi |
| `tasks/lib/logger` | 6 | eth, sonic, hyper, base, arb, plume |
| `tasks/lib/network` | 6 | eth, sonic, hyper, base, arb, plume |
| `utils/logger` | 6 | eth, sonic, hyper, base, arb, plume |
| `tasks/lib/contracts` | 5 | eth, sonic, hyper, base, plume |
| `utils/txLogger` | 5 | eth, sonic, hyper, base, plume |
| `utils/addresses` | 4 | eth, hyper, base, arb |
| `tasks/lib/signer` | 3 | eth, base, arb |
| `utils/cctp` | 3 | eth, hyper, base |
| `utils/localKeyValueStore` | 3 | eth, hyper, base |
| `utils/regex` | 3 | eth, base, arb |
| `utils/signers` | 3 | eth, base, arb |
| `utils/signersStandalone` | 3 | eth, base, arb |
| `tasks/lib/safeProposal` | 2 | eth, base |
| `tasks/lib/vaultStrategyMoves` | 2 | eth, base |
| `utils/resolvers` | 2 | eth, base |
| `abi/claim-rewards-module.json` | 1 | eth |
| `abi/passThrough.json` | 1 | eth |
| `tasks/lib/cowHarvest` | 1 | eth |
| `tasks/lib/deployments` | 1 | eth |
| `utils/anvil` | 1 | eth |
| `utils/beacon` | 1 | eth |
| `utils/constants` | 1 | eth |
| `utils/discord` | 1 | eth |
| `utils/harvest` | 1 | eth |
| `utils/managePassThrough` | 1 | eth |
| `utils/morpho-apy` | 1 | eth |
| `utils/ogn-buyback-config` | 1 | eth |
| `utils/proofs` | 1 | eth |
| `utils/rebalancer` | 1 | eth |
| `utils/rebalancer-config` | 1 | eth |
| `utils/units` | 1 | eth |
| `utils/vault` | 1 | eth |
