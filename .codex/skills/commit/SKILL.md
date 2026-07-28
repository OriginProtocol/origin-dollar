---
name: commit
description: Handle git commits with auto-staging, targeted pre-commit formatting, and Conventional Commit messages. Use when the user says commit it, commit this, commit changes, save my changes, or similar git commit requests.
---

# Commit

Automate the full commit workflow: inspect changes, format only affected files, stage tracked and untracked files individually, generate a Conventional Commit message, and create the commit. The user asked for a commit because they want the commit created, not a plan.

## Workflow

### 1. Check git state

Run `git status`.

Stop and tell the user if the repo is mid-merge, rebase, or cherry-pick. If there are no tracked or untracked changes, say `Nothing to commit` and stop.

### 2. Inspect changes

Run these in parallel:

- `git diff`
- `git diff --cached`
- `git status --porcelain`
- `git log --oneline -5`

Untracked files shown as `??` are often part of the current task and should normally be included.

### 3. Run targeted formatting

Collect candidate files with:

- `git diff --name-only`
- `git diff --name-only --cached`
- `git ls-files --others --exclude-standard`

Only run formatters for changed files.

If any `.sol` files under `contracts/tests/` changed:

```bash
forge fmt <those-files>
```

If any `.sol` files not under `contracts/tests/` changed:

```bash
npx prettier --write --plugin=prettier-plugin-solidity <those-files>
```

If files under `src/js/` or JS config files changed:

```bash
yarn lint --fix
yarn prettier --write <changed-js-files>
```

Do not format the whole repository. If formatting fails and cannot be auto-fixed, report the issue and stop unless the user explicitly wants to proceed.

### 4. Stage files

Stage files individually. Do not use `git add -A` or `git add .`.

Include:

- modified tracked files
- new untracked files
- files updated by formatters

Skip and warn on likely secrets:

- `.env` and `.env.*`
- names containing `credential` or `secret`
- `*.pem`, `*.p12`, `*.pfx`
- `*.key` private keys

### 5. Generate commit message

Base the message on the staged diff from `git diff --cached`.

Format:

```text
type(scope): description
```

Types:

- `feat`
- `fix`
- `refactor`
- `perf`
- `test`
- `docs`
- `chore`

Suggested scopes in this repo:

- `lido`
- `etherfi`
- `ethena`
- `origin`
- `arm`
- `deploy`
- `js`
- `cap`
- `zapper`
- `market`
- `pendle`
- `sonic`
- `skill`

If the change spans multiple unrelated areas, omit the scope. Use imperative mood, lowercase, no trailing period, and keep the subject under 72 characters.

### 6. Commit

Always run `git commit` unless an earlier safety stop applied. Do not stop after staging and do not ask for confirmation if the user already requested a commit.

Check the original user request for:

- whether a co-author trailer was requested
- whether a push was requested

Create the commit with `git commit -m ...`. Afterward run `git status` to confirm success and report:

```text
Committed <short-hash>: type(scope): description
```

### 7. Push only if requested

If the user explicitly asked to push, run `git push` or `git push -u origin <branch>` when needed. Otherwise do not push and do not ask.

## Safety rules

- Never amend unless the user explicitly asks
- Never force push
- Never use `--no-verify`
- If hooks fail, fix the issue, re-stage, and create a new commit
- If there is nothing to commit, stop
