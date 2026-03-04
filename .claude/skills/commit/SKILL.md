---
description: "Handles git commits with auto-staging, pre-commit formatting, and Conventional Commit messages. Use this skill whenever the user says commit it, commit this, commit changes, commit, or any phrase requesting a git commit. Also trigger when the user asks to save my changes or push this in a git context."
user_invocable: true
---

# Commit It

Automates the full commit workflow: inspect changes, format code, stage files, generate a Conventional Commit message, and commit. Designed to be fast — the user said "commit it" because they want it done, not to answer a bunch of questions.

## Instructions

### 1. Check Git State

First, make sure the repo is in a clean state for committing:

```bash
git status
```

If the repo is in the middle of a merge, rebase, or cherry-pick, inform the user and stop. These need to be resolved manually.

If there are no changes (nothing modified, nothing untracked), tell the user "Nothing to commit" and stop.

### 2. Inspect Changes

Run in parallel to understand what changed:
- `git diff` (unstaged changes to tracked files)
- `git diff --cached` (already staged changes)
- `git status --porcelain` (all changes including untracked files — look for `??` lines)
- `git log --oneline -5` (recent commits for style reference)

**Important:** Untracked files (`??` in `git status`) are often newly created files from the current session. They MUST be included in the commit alongside modified files.

### 3. Pre-Commit Formatting

Only run formatters relevant to the files that actually changed. Collect the full list of files to commit:

```bash
# Modified tracked files (staged + unstaged)
git diff --name-only
git diff --name-only --cached
# Untracked files (newly created)
git ls-files --others --exclude-standard
```

**If any `.sol` files under `contracts/tests/` changed:**
```bash
forge fmt <those-files>
```

**If any `.sol` files NOT under `contracts/tests/` changed:**
```bash
npx prettier --write --plugin=prettier-plugin-solidity <those-files>
```

**If any files under `src/js/` or JS config files changed:**
```bash
yarn lint --fix
yarn prettier --write <changed-js-files>
```

Do NOT run formatters on the entire project — only pass the specific changed files.

If formatting fails and can't auto-fix, tell the user what's wrong and ask whether to proceed anyway.

### 4. Stage Files

Stage ALL modified and untracked files individually. This includes:
- Modified tracked files (`M` in git status)
- Newly created untracked files (`??` in git status)

Do NOT use `git add -A` or `git add .`.

**Skip files that look like secrets:**
- `.env`, `.env.*` (environment files)
- Files with `credential` or `secret` in the name
- `*.pem`, `*.p12`, `*.pfx` (certificates)
- `*.key` files (private keys — but NOT files that merely contain "key" in the name like `keyManager.sol`)

If any sensitive files are detected, warn the user and list them.

Also re-stage any files that were modified by the formatters in step 3.

### 5. Generate Commit Message

Analyze the staged diff (`git diff --cached`) and generate a Conventional Commit message.

**Format:** `type(scope): description`

**Types:**
- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `perf` — performance or gas optimization
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — tooling, config, dependencies, CI

**Scope** — derived from the primary area of change:
- `lido` / `etherfi` / `ethena` / `origin` — ARM-specific
- `arm` — core AbstractARM
- `deploy` — deployment scripts
- `js` — JavaScript automation/actions
- `cap` — CapManager
- `zapper` — Zapper contracts
- `market` — market adapters (Morpho, Silo)
- `pendle` — Pendle integration
- `sonic` — Sonic chain specific
- `skill` — Claude Code skills

If changes span multiple areas, use the most significant one. For mixed changes, omit the scope.

**Description:** imperative mood, lowercase, no period. Under 72 characters. Focus on "why" not "what".

For substantial changes, add a body with bullet points after a blank line.

**Examples:**
```
feat(ethena): add parallel cooldown support for sUSDe unstaking
fix(arm): prevent rounding error in withdrawal queue processing
refactor(deploy): extract shared deployment logic into DeployManager
test(lido): add fork tests for stETH discount scenarios
chore: update soldeer dependencies
perf(arm): reduce SLOAD count in swap path
docs(skill): add commit automation skill
```

### 6. Confirm and Commit

Before asking anything, check the user's original message for preferences they already stated:
- **Co-Authored-By**: Look for "with co-author", "add trailer", "include co-author", etc. Default: no trailer.
- **Push**: Look for "and push", "push it", "push too", etc. Default: don't push.

If both preferences are clear from the prompt, present the commit message and proceed without asking:

> Here's the commit message:
> ```
> type(scope): description
> ```
> Committing with Co-Authored-By trailer and pushing as requested.

If preferences are NOT clear, present the message and ask only about what's unspecified:

> Here's the commit message:
> ```
> type(scope): description
> ```
> Push after commit?

Defaults: no trailer, don't push.

Create the commit using a HEREDOC:

**Without trailer (default):**
```bash
git commit -m "$(cat <<'EOF'
type(scope): description
EOF
)"
```

**With trailer:**
```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Run `git status` after to verify success.

### 7. Push (Only If Requested)

If the user asked to push (either in the original prompt or in step 6), use `git push` (or `git push -u origin <branch>` if no upstream is set).

If they didn't ask to push, don't ask again — the commit is done.

## Safety Rules

- NEVER amend existing commits unless explicitly asked
- NEVER force push
- NEVER skip hooks (no `--no-verify`)
- If a pre-commit hook fails, fix the issue, re-stage, and create a NEW commit (do not amend)
- If there are no changes to commit, inform the user and stop
