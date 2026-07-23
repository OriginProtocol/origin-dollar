## Codex Instructions

- See [CLAUDE.md](/Users/nicholasaddison/Documents/Origin/workspaces/origin-dollar/CLAUDE.md) for repo commands, architecture, and workflow details.
- All smart contract work happens in `contracts/`. Run repo commands from `/Users/nicholasaddison/Documents/Origin/workspaces/origin-dollar/contracts`.
- After making code changes, run Prettier before finishing.
- For JS edits under `contracts/`, run `pnpm prettier:js`.
- For Solidity edits under `contracts/`, run `pnpm prettier:sol`.
- If both JS and Solidity files changed, run both commands.
- Prefer the smallest relevant verification after edits.
- Do not reformat or modify unrelated files just to satisfy style.
- Do not fix unrelated failing tests or lint issues unless explicitly asked.

## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.

### Available skills
- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations. (file: /Users/clement/.codex/skills/.system/skill-creator/SKILL.md)
- skill-installer: Install Codex skills into `$CODEX_HOME/skills` from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos). (file: /Users/clement/.codex/skills/.system/skill-installer/SKILL.md)
- commit: Handle git commits with auto-staging, targeted pre-commit formatting, and Conventional Commit messages. Use when the user asks to commit changes, save changes in git, or similar commit requests. (file: /Users/clement/Documents/Travail/Origin/2-SC/origin-dollar-foundry/.codex/skills/commit/SKILL.md)
- unit-test: Generate Foundry unit tests for a contract using this repository's conventions, structure, and naming. Use when the user asks for unit tests, Foundry tests, concrete tests, fuzz tests, or to port Hardhat tests into Foundry unit tests. (file: /Users/clement/Documents/Travail/Origin/2-SC/origin-dollar-foundry/.codex/skills/unit-test/SKILL.md)
- fork-test: Generate Foundry fork tests for contracts that need real on-chain integration coverage. Use when the user asks for fork tests, mainnet or chain fork coverage, integration tests against live protocol state, or to port Hardhat fork tests into Foundry. (file: /Users/clement/Documents/Travail/Origin/2-SC/origin-dollar-foundry/.codex/skills/fork-test/SKILL.md)

### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1. After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2. When `SKILL.md` references relative paths (e.g. `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3. If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4. If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5. If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
