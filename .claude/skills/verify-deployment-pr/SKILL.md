---
name: verify-deployment-pr
description: >-
  Verifies a POST-EXECUTION mainnet (or other network) smart-contract deployment
  PR for this repo: confirms every deployed contract is listed in the PR
  description, that the on-chain verified source (and its dependencies) matches the
  codebase via `sol2uml diff`, that constructor args and the initialize tx match the
  deploy file, and that the on-chain governance proposal matches the deploy script's
  actions. Use when asked to review, verify, audit, or sign off on an executed
  deployment PR. Invoke explicitly with /verify-deployment-pr <PR#>.
argument-hint: <PR#>
allowed-tools: Bash, Read, Grep, Glob, Task
disable-model-invocation: false
---

# Verify Deployment PR

READ-ONLY audit of an already-executed deployment PR. Never broadcast a transaction,
never edit files, never re-run the live deployment. All on-chain data comes from the
block explorer (via `sol2uml`/Etherscan) or a read-only RPC.

## Step 0 — Prerequisites (fail fast)

1. All commands run from `contracts/`: `cd contracts`.
2. Require `contracts/.env` with `PROVIDER_URL` and `ETHERSCAN_API_KEY`:
   `grep -oE '^(PROVIDER_URL|ETHERSCAN_API_KEY)=' .env`. Source it for shell use:
   `set -a; . ./.env; set +a` (so `$ETHERSCAN_API_KEY` is available to `sol2uml`).
   - Missing `ETHERSCAN_API_KEY` → checks 2/3/4 can't run → STOP and report the blocker.
3. Require `gh` authenticated (`gh auth status`). If absent, ask the user to paste the
   PR body + deployed-address list rather than failing.
4. Require `sol2uml` on PATH (`command -v sol2uml`). If absent: `npm i -g sol2uml`.
5. **Verify you are on the correct branch.** This is the most important prereq: every
   check diffs the on-chain deployment against the *local* code, so a wrong branch (or a
   dirty tree) silently produces meaningless results. Match the checkout to the PR head:
   - `gh pr view "$PR" --json headRefName,state,mergeCommit`
   - `git rev-parse --abbrev-ref HEAD` and `git status --porcelain`
   - Require the current branch to equal the PR's `headRefName`, OR — if the PR is already
     merged — that the checkout contains its merge commit
     (`git merge-base --is-ancestor <mergeCommit> HEAD`).
   - On mismatch or a dirty working tree → **STOP**. Tell the user to `gh pr checkout <PR>`
     (or `git checkout <headRefName>` / `git stash`) and re-run. Do not verify against the
     wrong code.

## Step 1 — Gather PR context

1. `PR=$1`. `gh pr view "$PR" --json title,body,files,baseRefName,headRefName,state,url`.
2. Find the changed deploy script(s): `git diff --name-only origin/master...HEAD -- 'contracts/deploy/'`
   (or read the PR `files`). The folder under `deploy/<network>/` gives the **network**
   (mainnet, base, sonic, arbitrumOne, …) — use it for `sol2uml --network <net>` and the
   `deployments/<network>/` artifact folder.
3. From each deploy script, parse the deployed contracts: every
   `deployWithConfirmation("<Name>", [args])` call (and any `*Proxy` deploys). Resolve
   each `<Name>` → address + recorded args via `deployments/<network>/<Name>.json`
   (`.address`, `.args`, `.transactionHash`).
4. Extract `proposalId` and `deployName` from the script's
   `deploymentWithGovernanceProposal({ ... })` options block, and the `actions` array.
   If `proposalId` is `""`/absent, mark check 5 ⚠️ ("no proposalId recorded — resolve
   from on-chain Governor events or ask the deployer").
5. Working set: `[{name, address, recordedArgs, proposalId, network, deployScript}]`.

## Step 2 — Run the checks

Checks 2/3/4 are per-address and independent — fan them out with parallel `Task`
sub-agents (one per deployed contract) when there are several; otherwise run inline.
Each check yields: status (✅ pass / ⚠️ needs-human / ❌ fail), one-line evidence, a
details block, and a confidence (High/Med/Low). Absence of evidence is ⚠️/❌, never ✅.

**1 — All deployed contracts listed in the PR description**
- Compare the Step-1 deployed name+address set against the PR body.
- ✅ every deployed contract (name and address) appears; ❌ a deployed contract is
  missing; ⚠️ names present but addresses missing/ambiguous.

**2 — Verified on-chain code (and dependencies) matches the codebase**
- For each deployed **implementation** address, from `contracts/`:
  `sol2uml diff <address> .,node_modules --network <net> --apiKey "$ETHERSCAN_API_KEY"`
  This downloads the explorer-verified source for the address and diffs it (and its
  dependencies) against the local checkout.
- ✅ sol2uml reports no differences (every file identical); ❌ any file differs — quote
  the differing files/lines. For `*Proxy` addresses run the same diff against the proxy
  source; expect the standard proxy to match.
- Confidence High when the diff is clean/empty.

**3 — Constructor arguments are correct**
- Read the args passed to `deployWithConfirmation("<Name>", [args])` in the deploy file.
- Compare them to the recorded `deployments/<network>/<Name>.json` `.args` AND to the
  on-chain "Constructor Arguments" on the explorer (Etherscan contract page, or decode
  the tail of the creation tx input). They must match positionally.
- ✅ all args match; ❌ any positional mismatch (show deploy-file value vs on-chain).
  Proxies typically have no constructor args — note `[]`.

**4 — The initialize / interaction tx matches the deploy script**
- If the deploy script performs a post-deploy call — typically a proxy
  `initialize(...)`/`_initialize(...)` (often `withConfirmation(cProxy.connect(...).initialize(...))`
  or a proxy `*Proxy` deploy followed by initialize) — locate the corresponding on-chain
  tx (explorer tx list for the proxy address, or the proxy's deployment receipt) and
  confirm the **arguments match the deploy file**.
- ✅ the initialize tx args match the script; ⚠️ the script has no init/interaction call
  (nothing to check); ❌ args differ (show the diff).

**5 — Governance proposal matches the deploy script**
- `npx hardhat proposal --id <proposalId> --network <net>` prints the on-chain proposal:
  executed state + `getActions` (targets, signatures, calldatas).
- Compare against the deploy script's `actions` array: same number of actions, same
  target addresses (resolve each `action.contract` → address), same `signature` strings,
  and decode each calldata to confirm the `args` match.
- ✅ identical; ❌ any divergence in count/target/signature/args (show the unified diff).
  Also report that `executed == true` for a post-execution PR.

**6 — Smoke tests after fork execution** — SKIPPED (per project decision). Mark N/A.

## Step 3 — Synthesize

Verdict = **VERIFIED** only if checks 2,3,4,5 are ✅ (check 1 may be ⚠️ if the sole gap
is documentation; check 4 may be ⚠️ if there is genuinely no init/interaction call).
Any ❌ in 2–5, or an unresolved ⚠️, → **BLOCKERS FOUND**. Emit the report:

```
# Deployment PR Verification — #<PR> (<title>)
Verified against: <branch>@<short-sha>
Deploy script(s): <list>   |   Network: <net>   |   Proposal: <proposalId>
Verdict: <VERIFIED | BLOCKERS FOUND>

- [<✅|⚠️|❌>] 1. All deployed contracts listed in PR description — <evidence> (conf)
- [<✅|⚠️|❌>] 2. Verified code (+deps) matches codebase (sol2uml diff) — <evidence> (conf)
- [<✅|⚠️|❌>] 3. Constructor args correct — <evidence> (conf)
- [<✅|⚠️|❌>] 4. Initialize/interaction tx matches deploy script — <evidence> (conf)
- [<✅|⚠️|❌>] 5. Governance proposal matches deploy script — <evidence> (conf)
- [⏭️] 6. Smoke tests — skipped (N/A)

## Details
### 2. sol2uml diff   <per-address: address, clean/diff, differing files>
### 3. Constructor args   <per-address: deploy-file args vs on-chain args>
### 4. Initialize tx   <tx hash, decoded args vs deploy-file args>
### 5. Proposal diff   <on-chain getActions vs script actions, or "identical">

## Human still owes (manual)
- Off-chain Safe/multisig follow-ups noted in the deploy script (e.g. enableModule).
- That the PR's stated intent matches the on-chain effect (judgment).
- Anything marked ⚠️ above.
```

## Notes / common false positives

- For `sol2uml diff`, run from `contracts/` and source `.env` first so `$ETHERSCAN_API_KEY`
  is set; use `--network` matching the deploy folder (base→`base`, sonic→`sonic`, etc.).
- A **proxy address will not match an implementation's source** — diff a `*Proxy` against
  the proxy contract, not the impl.
- A clean `sol2uml diff` (no file differences) is the pass signal for check 2; treat any
  reported file difference as ❌ pending human review, not a warning.
- If `proposalId` is empty, do not fabricate one — mark checks 5 ⚠️ and ask the deployer.
- If a helper command errors/rate-limits, retry once, then mark that check ⚠️ "tool
  error" with the stderr tail and continue the others. Never silently pass.

## Do NOT

- Never send transactions, never re-run the deployment, never edit files. Explorer +
  read-only RPC only.
- Never declare VERIFIED while any of checks 2–5 is ❌ or an unresolved ⚠️.
