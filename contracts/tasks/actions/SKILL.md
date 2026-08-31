---
name: talos-action-development
description: Develop, modify, review, and maintain standalone Talos actions in contracts/tasks/actions, including chain guardrails, contract bindings, transaction safety, schedules, action catalogues, and Talos documentation. Use when adding an action, changing an action’s behavior or parameters, updating a Talos schedule, or maintaining action runtime support.
---

# Talos Action Development and Maintenance

## Runtime Model

- Author actions in `tasks/actions/<actionName>.ts` with the `action({...})`
  wrapper from `tasks/lib/action.ts`.
- Actions self-register and run through `tasks/run.ts`; do not register ops tasks.
- Run an action locally with `pnpm exec tsx tasks/run.ts <actionName> --network
  <network>`. Treat a transaction-writing invocation as production-affecting.
- Production schedules are defined in `migrations/seed_schedules.sql`; the
  Talos runner loads the generated catalogue from `actions-catalog.json`.

## Implement an Action

1. Match the filename and `name` with camelCase, and provide a clear
   description and explicit `chains` guardrail.
2. Define every CLI parameter with the `params` builder and keep names
   camelCase. The generated catalogue converts names to kebab-case flags.
3. Use the context's `signer`, `chainId`, `networkName`, `log`, and `args`.
   Initialise no independent provider or signer unless the action genuinely
   requires it.
4. Prefer `getContract("DeploymentName")` from `tasks/lib/contracts` for a
   direct committed deployment binding. For a proxy or interface call, use
   `getContractAt()` with a curated interface ABI or instantiate
   `ethers.Contract` with a narrow inline ABI.
5. Treat committed deployment artifacts, `utils/addresses.js`, and
   action-local chain maps as address sources. `artifacts/` and Foundry
   `build/deployments-<chainId>.json` are not Talos runtime inputs.
6. Use named ethers contract methods and `logTxDetails` for write transactions.
   Avoid raw selector encoding and `signer.sendTransaction({ to, data })` when
   the method is known.
7. Validate chain-specific addresses, deployment availability, and signer
   authority before a transaction. For Safe proposals, preserve simulation,
   nonce, and delegate checks.

## Maintain Existing Actions

- Keep proxy ABI selection deliberate: a deployment artifact supplies an
  address, but its ABI may not expose an implementation method. Prefer curated
  `abi/*.json` interfaces for stable proxy calls.
- When a Foundry deployment changes an action target, update the corresponding
  deployment descriptor address or pinned action address in the same change.
- Preserve idempotency and useful action-specific logging. Do not turn a
  manual-only or proposal action into an enabled schedule without explicit
  authorization.
- Avoid co-scheduling two transaction-writing actions for the same signer in a
  five-minute window; check `migrations/seed_schedules.sql`.

## Update Supporting Records

- Update `docs/ACTIONS.md` when a scheduled action or its operational behavior
  changes.
- Regenerate `docs/talos-actions-inventory.md` after action entry-point or
  local-import changes:

  ```bash
  node scripts/talos/action-chains.mjs > docs/talos-actions-inventory.md
  ```

- Rebuild the runtime catalogue when validating the action image:

  ```bash
  pnpm run dump-catalog
  ```

## Verify

```bash
pnpm prettier:ts
pnpm typecheck
```

Run the smallest safe action-level validation available. Only invoke an action
against a live network when the requested work authorizes its side effects.
