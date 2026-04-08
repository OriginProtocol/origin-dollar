---
name: action-migration-hardhat
description: Use this skill when migrating cron actions in contracts/tasks/actions from viem/raw signer.sendTransaction calls to readable ethers contract method calls resolved from Hardhat deployments.
---

# Action Migration Skill

## Use This For

- Migrating existing action tasks in `contracts/tasks/actions/*.ts`
- Replacing raw calldata + `signer.sendTransaction` patterns
- Standardizing actions on Hardhat deployments + ethers `Contract` calls

## Naming Conventions

- Action task `name` values should be `camelCase` and match the action filename (without `.ts`), e.g. `otokenOusdOethRebase`.
- Variables, functions, and local identifiers should use `camelCase`.
- Contract/deployment names passed to `ethers.getContract("<Name>")` should use the existing deployment name casing (usually `PascalCase` with suffixes like `Proxy`).

## Target State

- Keep the `action({ ... })` wrapper and chain restrictions.
- Prefer fetching deployed contracts by name via Hardhat (`ethers.getContract("<Name>")`).
- Call named contract methods (`contract.rebase()`) instead of encoding selectors manually.
- Keep logs clear and action-specific.

## Migration Rules

1. Remove `viem` usage (`parseAbi`, `encodeFunctionData`) from actions.
2. Avoid `signer.sendTransaction({ to, data })` for contract calls.
3. Prefer `ethers.getContract("<DeploymentName>")` and call methods on that contract.
4. Connect to action signer before write calls: `contract.connect(signer).myMethod()`.
5. Use `new ethers.Contract(address, abi, signer)` only as fallback when no deployment name is available.
6. For proxy contracts, check existing patterns in `contracts/deploy/<network>/*.js` (mainnet/base/sonic/etc.) and `contracts/test/**/*.js` to choose the correct binding style (`getContract`, `getContractAt("I...")`, or implementation ABI at proxy address).
7. Keep explicit `chains: [...]` guardrails for each action.
8. Prefer `logTxDetails` from `../../utils/txLogger` for transaction logging/confirmation instead of manual `log.info(tx.hash)` + `await tx.wait()`.
9. When replacing a hard-coded contract address with `ethers.getContract("<Name>")`, verify the old address equals the deployment address for that contract on the target chain; if it does not match, stop and flag it.
10. If only a 4-byte selector/call-data hash is available, resolve it using 4byte API, then confirm the resolved text signature exists in the target contract ABI before coding the method call.
11. Cron nonce safety: assume action tasks share a single signer/EOA unless explicitly configured otherwise. When adding or modifying cron jobs in `contracts/cron/cron-jobs.ts`, avoid scheduling two transaction-writing actions in the same 5-minute window to reduce nonce contention/race conditions.

## 4byte Selector Resolution (Proposal)

Use this when migrating a raw `sendTransaction({ to, data })` call and the method name is unclear.

1. Extract selector:
   - Selector is the first 4 bytes of calldata (first 10 hex chars including `0x`), e.g. `0x80bef06d`.
2. Query 4byte:
   - `GET https://www.4byte.directory/api/v1/signatures/?hex_signature=<selector>`
   - Parse `results[].text_signature`.
3. Handle ambiguity:
   - If multiple candidates are returned, treat them as hypotheses only.
   - Narrow using expected argument count/types from calldata length and usage context.
4. Verify against local ABI (required):
   - Check `contracts/deployments/<network>/<ContractName>.json` ABI for exact method presence.
   - Recompute selector locally from candidate text signature and ensure exact match.
5. Only then migrate:
   - Replace raw calldata call with `contract.connect(signer).methodName(...)`.
6. If unresolved:
   - Keep the raw call and leave a TODO with selector + 4byte candidates, or stop and flag.

## Preferred Pattern

```ts
import { ethers } from "hardhat";
import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

action({
  name: "example-action",
  description: "Example migration target",
  chains: [1],
  run: async ({ signer, log }) => {
    const contract = await ethers.getContract("MyContractProxy");
    const tx = await contract.connect(signer).myMethod();
    await logTxDetails(tx, "myMethod");
  },
});
```

Fallback only (if contract cannot be fetched by deployment name):

```ts
// import { ethers } from "ethers";
// import { abi, address } from "../../deployments/mainnet/MyContract.json";
// const contract = new ethers.Contract(address, abi, signer);
```

## Review Checklist

- Action still runs on intended chain(s) only.
- No manual calldata encoding for known contract methods.
- Contract source (deployment/address) is readable and obvious.
- For proxy targets, contract binding style matches existing deploy/test patterns for that proxy and network.
- If a hard-coded address was migrated, its value was checked against the deployment address for the chosen contract name and chain.
- Method name reflects protocol intent (better than raw selector calls).
- Transaction logging uses `logTxDetails` (or an equivalent shared helper), not ad-hoc hash logging and manual waits.
- For selector-based migrations, 4byte lookup was used and final method choice was validated against the local deployment ABI.
- For cron wiring changes, transaction-writing actions are not co-scheduled in the same 5-minute window; check `contracts/cron/cron-jobs.ts` for collisions before finalizing.
