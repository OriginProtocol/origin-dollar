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
