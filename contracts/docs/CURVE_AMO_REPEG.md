# Curve AMO repegging

`ousdCurveAmoRepeg` removes excess OUSD from the Ethereum Curve OUSD/USDC pool
and burns it. The sell-price target is USDC received for selling one OUSD. The
default target is `0.9998`; an existing quote at or above the target produces no
transaction. This action does not mint OUSD or lower an above-target price.

Only the OUSD Ethereum Talos action is available. Its parameters are `sellPrice`
and `dryrun`; the asset is fixed to OUSD. The reusable module and internal sizing
library retain the following configurations for future dedicated asset actions:

| Asset     | Network | Pool sell direction  | Quote units       | Module descriptor              |
| --------- | ------- | -------------------- | ----------------- | ------------------------------ |
| OUSD      | mainnet | `get_dy(0, 1, 1e18)` | USDC, 6 decimals  | `OUSDCurveAmoRepegModule`      |
| OETH      | mainnet | `get_dy(0, 1, 1e18)` | WETH, 18 decimals | `OETHCurveAmoRepegModule`      |
| SuperOETH | base    | `get_dy(1, 0, 1e18)` | WETH, 18 decimals | `SuperOETHCurveAmoRepegModule` |

The action verifies pool coin order, token decimals, strategy/vault/checker
bindings, module operator role and Safe enablement against chain state. Module
addresses come from per-instance deployment descriptors; missing descriptors are
a hard failure. OETH and SuperOETH need separate Talos wrappers, reviewed module
deployments, and variance caps before they can be automated. Their internal
profiles are not public action parameters. No module addresses are inferred from
the presence of a contract implementation.

## Module permissions

Each `CurveAmoRepegModule` permanently binds one Safe, vault, AMO and checker.
Only an operator may request the following four Safe calls, atomically:

1. Vault `rebase()`.
2. Value Checker `takeSnapshot()`.
3. AMO `removeAndBurnOTokens(lpTokens)`.
4. Value Checker `checkDelta(expectedProfit, profitVariance, expectedVaultChange, vaultChangeVariance)`.

All calls originate from the bound Safe. Any failed step rolls back the burn,
snapshot, rebase and request nonce. The module exposes no arbitrary target or
calldata execution and cannot unpause a vault. A paused rebase fails closed.

The action derives all four checker arguments off-chain. Both variances are
bounded by immutable per-deployment caps. Simulated profit must be strictly
positive. Profit variance is the smaller of the profit cap and simulated profit
minus one accounting wei, so the permitted profit range starts at one accounting
wei or more. Zero-profit and loss-making executions are rejected. Vault-change
variance uses the deployed vault-change cap. Checker values
are 18-decimal accounting amounts: USD for OUSD and ETH for OETH/SuperOETH.
OUSD's deployment caps are 1 OUSD each; do not copy that numeric amount into an
ETH deployment without reviewing its economic size.

Each request carries the module's current nonce and expires at the source block's
timestamp plus 300 seconds. Successful requests consume the nonce. Concurrent
runs based on one nonce cannot both execute. The Safe administers operator roles
and can revoke a relayer or disable the module.

## RPC and sizing

The configured network RPC must implement `eth_simulateV1`. There is no
unsimulated fallback or production Anvil dependency. Sizing simulates rebase,
burn and quote against one pinned canonical block, searches in 0.01 LP-token
increments, and is bounded by the AMO's staked gauge balance. The strategy's peg
overshoot rejection is an upper sizing bound; other reverts abort the action.
An unattainable target produces an error and no transaction.

The checker values are derived from the actual simulated checker snapshot,
post-burn vault value and post-burn token supply. Before submission the action
simulates the exact module call from the Talos signer at fresh chain state,
without state overrides, and checks the resulting sell quote. This exercises the
module's operator checks, the Safe's enabled-module check and the atomic value
checker. A stale nonce, expired calculation or failed final preflight causes one
fresh recomputation; a second failure aborts. Submitted transactions are never
blindly retried with the same burn calldata.

The module enforces strictly positive profit, not the price target. State movement
between final preflight and mining can change the achieved price or cause a
checker revert. A simulation result is not a guarantee of a mined price.

## OUSD deployment and enablement

The Ethereum deployment script is
`scripts/deploy/mainnet/016_DeployOUSDCurveAmoRepegModule.s.sol`. It records the
OUSD instance as `OUSD_CURVE_AMO_REPEG_MODULE`. The broadcast descriptor export
maps that recorded address to `deployments/mainnet/OUSDCurveAmoRepegModule.json`;
the action reads the address only and uses its own fixed function ABI.

Review and simulate the deployment through the repository's Foundry deployment
workflow before broadcasting. Safe enablement is a separate owner transaction:
after a successful deployment receipt, descriptor export writes
`build/ousd-curve-amo-repeg-enable-1.json`. Failed deployments and exporter
dry runs do not create an upload file. Upload it to the module's bound
strategist Safe and review `enableModule(module)` before signing. Deployment by
itself does not enable the module.

After enablement, run the default OUSD action as a dry run:

```sh
pnpm action ousdCurveAmoRepeg --network mainnet --dryrun
```

Logs include the source block/hash, before/after quote, LP withdrawal, expected
burn, checker bounds, module nonce and expiry. Once those values are reviewed,
execute with the same target parameter:

```sh
pnpm action ousdCurveAmoRepeg --network mainnet --sell-price 0.9998
```

## Recurring execution

The `ousd_curve_amo_repeg` seed invokes the OUSD Ethereum action every 20 minutes
in UTC (`*/20 * * * *`) with `--sell-price 0.9998`. Each run skips submission
when the quote already meets the target. The row starts with `enabled = false`;
adding the seed does not activate execution.

Enable it only after deployment 016, descriptor export into the deployed action
image, Safe module enablement, and funding the authorized Talos relayer with ETH
for gas. Complete the dry run above first. Before activation, review active
Ethereum jobs sharing that relayer and stagger transaction-writing jobs that
would run within five minutes of one another. Other schedule rows are unchanged.
The seed uses `ON CONFLICT (product, name) DO NOTHING`, so subsequent boots
preserve an existing row's enabled state and cron settings.

The action uses the existing Talos signer and transaction logger. To stop
execution, disable the Talos schedule; the Safe can independently revoke
`OPERATOR_ROLE` from the relayer or call `disableModule` with the current module
predecessor from `getModulesPaginated`.
