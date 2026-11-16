# Fresh Hoodi staking deployment

The old Defender governor cannot be recovered. This deployment creates independent OETH and vault proxies, a vanilla CompoundingStakingStrategy proxy and view, and legacy/Gloas proof verifiers behind a fork router. It does not migrate balances, deposits or validators from the old stack. New validators must use the new strategy's withdrawal credentials.

## Provision the relayer

In `oplabs/talos`, branch `codex/hoodi-relayer` adds a secp256k1 KMS key with alias `alias/talos-prod-hoodi-evm-signer`, an origin-dollar runner grant, and `HOODI_KMS_RELAYER_ID` in that runner. Only the origin-dollar runtime role may sign with it. Existing production key selection is unchanged. Apply through the signed Talos infrastructure release process, then deploy the origin-dollar runner containing this branch. No Talos client version change is required.

After the key exists, resolve its address without signing or exposing a private key:

```sh
AWS_PROFILE=talos-admin node scripts/hoodi-relayer-address.js
```

Fund this address with Hoodi ETH for governance claims and future transactions. Talos registers it automatically on its first queued transaction.

## Deploy the fresh contracts

Use a separate funded EOA with the encrypted `deployerKey` keystore for Foundry. Set `DEPLOYER_ADDRESS`, `HOODI_PROVIDER_URL`, and `HOODI_RELAYER_ADDRESS` (the address derived above). Never put an invented address into a live deployment. `HOODI_GLAMSTERDAM_TIMESTAMP` is optional: zero prefers legacy proofs with a Gloas fallback, so a fork date is not required.

```sh
make simulate NETWORK=hoodi
make deploy-hoodi
```

The simulation claims governance as the relayer and verifies minting and vault allocation using real Hoodi WETH. It does not broadcast. The real deployment configures strategist/operator/registrator as the relayer and leaves governance pending for it to claim. `make deploy-hoodi` updates the deployment descriptors only from confirmed broadcasts. Preserve the old descriptors in Git history; do not overwrite them with simulated addresses.

The script is one-time, tracked in `build/deployments-560048.json`. Do not delete a live deployment ledger or use a fork ledger for a real run.

## Claim governance in Talos

Deploy the runner image containing the new descriptors and `claimHoodiGovernance` action, then run it manually on Hoodi. It checks that the fresh vault and strategy are configured for its signer before claiming governance of OETHProxy, OETHVaultProxy and CompoundingStakingStrategyProxy. It is safe to retry after a partial claim. Keep existing schedules disabled for this fresh stack until its operational configuration is verified.

A local invocation is supported only where the intended KMS runtime identity and nonce queue are available:

```sh
pnpm exec tsx tasks/run.ts claimHoodiGovernance --network hoodi
```

Validate on-chain that all three proxy governors, the vault strategist/operator and the strategy validatorRegistrator equal the new signer. Check vault/default-strategy/token links, proof-router address, initial-deposit cap (1 ETH), WETH/deposit-contract addresses and genesis timestamp.

## Remaining testing before validator operations

The current branch's Gloas tests use synthetic roots; independent Lodestar-generated Gloas fixtures and end-to-end validator/deposit/balance proof tests remain required. The fresh deployment does not fix the pre-existing recursive getStrategyNetworkName helper or missed-slot handling in verifyValidator. Existing staking actions are mainnet-only in the Talos action catalog; enable Hoodi operations with a Hoodi beacon provider and dedicated signer only after those task paths are validated. No automatic staking schedules are enabled by this change.
