---
name: action-migration-hardhat
description: Use this skill when migrating cron actions in contracts/tasks/actions from viem/raw signer.sendTransaction calls to readable ethers contract method calls resolved from Hardhat deployments.
---

# Action Migration Skill

## Use This For

- Migrating existing action tasks in `contracts/tasks/actions/*.ts`
- Replacing raw calldata + `signer.sendTransaction` patterns
- Standardizing actions on Hardhat deployments + ethers `Contract` calls

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
8. Keep waits (`await tx.wait()`) and useful tx hash logging.
9. When replacing a hard-coded contract address with `ethers.getContract("<Name>")`, verify the old address equals the deployment address for that contract on the target chain; if it does not match, stop and flag it.

## Preferred Pattern

```ts
import { ethers } from "hardhat";
import { action } from "../lib/action";

action({
  name: "example-action",
  description: "Example migration target",
  chains: [1],
  run: async ({ signer, log }) => {
    const contract = await ethers.getContract("MyContractProxy");
    const tx = await contract.connect(signer).myMethod();
    log.info(`myMethod tx: ${tx.hash}`);
    await tx.wait();
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
- Logging includes enough context to debug failures.
