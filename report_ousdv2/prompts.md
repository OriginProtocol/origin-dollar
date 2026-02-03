## Pre-prompt

### First

I have a new project that I'm working on with my team, we are improving OUSD and we are now on phase two where we call multichain yield distribution, this means that when users mint OUSD on mainnet with USDC, we are able to distribute USDC across multiple chains where native USDC is present. 
We have the contracts ready for that but I want you to ideate possible solutions for phase 3, where we expand the presence of ousd across multiple chains.
I was thinking about using codex with high reasoning to learn the codebase, generate diagrams of the contracts and flow of funds using the contracts of phase 2 to after discuss possible paths for phase 3. What's the best approach for me to follow to get the best results?



### After...

Can you make me the prompt of the first step?

Can you make me the prompt of the second step?

...

## Prompts

### Prompt 1

You are an expert Solidity engineer + protocol auditor.

Context:
We are in “Phase 2: multichain yield distribution” for OUSD.
The Phase 2 contracts are NOT on master yet. They live across TWO separate git branches that are not merged.
Your job is to build a ground-truth technical map of Phase 2 from the code, without guessing.

Hard rules:
- Read code first. No assumptions.
- Every non-trivial claim must be backed by an explicit code reference:
  - contract + function name, AND
  - file path (and line numbers if available in your environment).
- If you cannot find evidence, write “UNKNOWN” and list exactly what file/function you expected to find.
- Treat anything involving cross-chain messaging, ownership/admin, and accounting as security-critical.
- Output must reconcile BOTH branches and highlight inconsistencies.

Step 0 — Prepare the workspace
1) Identify the repo root and the Solidity build system (Foundry/Hardhat/etc).
2) List the two branches relevant to Phase 2 (if you can’t infer, read `git branch -a` output). The names of the branches are:shah/cross-chain-strategy-cctpv2 and clement/simplify-ousd 
3) For EACH branch:
   - check it out
   - build/compile if possible
   - run tests if present (optional if too slow, but try)

Step 1 — Index Phase 2 surface area (per branch)
For each branch, produce:
A) Contract inventory table:
   - Contract name
   - File path
   - Responsibilities (1–2 sentences)
   - Key external/public entrypoints (functions)
   - External dependencies (interfaces, libraries, bridges/messengers)
B) Roles & permissions matrix:
   - Identify all roles (owner, governor, guardian, strategist, relayer, keeper, timelock, multisig)
   - For each privileged function, list:
     - function signature
     - access control mechanism (onlyOwner / roles / custom modifier)
     - who is expected to call it
C) Flow-of-funds map (Phase 2):
   - Write the lifecycle narrative:
     1) Mainnet mint (USDC in) → OUSD out
     2) Allocation decision (how much to each chain)
     3) Cross-chain dispatch (who sends, which messenger, payload format)
     4) On-destination-chain handling (who receives USDC, where it’s deployed)
     5) Yield harvesting / rebalancing
     6) Reporting back to hub/mainnet (if applicable)
     7) How yield becomes distributable to OUSD holders (accounting / rebase / pricePerShare / etc)
   - For each step, include:
     - contract.function() references
     - state variables touched (names)
     - events emitted

Step 2 — Cross-branch reconciliation (the most important part)
Create a “Reconciliation Report” that includes:
1) What exists in both branches (same contract/function, same semantics)
2) What exists only in Branch A vs only in Branch B
3) Naming / interface mismatches (function names, event names, payload structs)
4) Accounting model differences:
   - how assets under management are tracked
   - how remote chain assets are represented (bookkeeping)
   - how fees are applied (if any)
5) Trust boundary differences:
   - messenger/bridge assumptions
   - who can spoof reports
   - who can move funds
6) A minimal merge plan suggestion:
   - the smallest set of changes needed to merge safely
   - tests you’d require before merge

Step 3 — Security notes (not a full audit, but real issues)
List:
- Top 10 risk areas discovered (ranked by severity)
- Missing checks / missing invariants / suspicious upgrade patterns
- Any “funds can move without X” or “reporting can be forged if Y”
- Any liveness risks (stuck funds if bridge down, etc)

Output format (exact):
1) Branch A report
2) Branch B report
3) Reconciliation Report
4) Security Notes
5) Open Questions (only things marked UNKNOWN)

Start now by:
- printing the two branch names you will analyze
- listing the Phase 2 related directories/files you plan to inspect first

### Prompt 2

You are an expert Solidity engineer + technical writer.

Goal:
Generate a human-readable Phase 2 documentation report + Mermaid diagrams from the codebase analysis already performed.
All outputs MUST be written under: `report_ousdv2/`

Hard rules:
- Do not invent details. If something is uncertain, label it as UNKNOWN and list the evidence you couldn’t find.
- Every important claim must be backed by a code reference (file + contract/function; add line numbers when available).
- Reflect that Phase 2 contracts currently exist across TWO unmerged branches.
- Write docs that are useful to engineers, reviewers, and auditors.

Inputs you must use:
- The repo code itself.
- The “Step 1” findings you produced (contract inventory, roles matrix, flow-of-funds, reconciliation).
If “Step 1” output isn’t available in your context, re-derive it quickly but keep scope limited to what’s needed for documentation.

Output structure (create these files exactly):

report_ousdv2/
  README.md
  summary/
    executive_summary.md
    key_invariants.md
    open_questions.md
  branches/
    branch_A/
      overview.md
      contracts.md
      permissions.md
      flows.md
      diagrams/
        architecture.mmd
        sequence_mint_allocate.mmd
        sequence_harvest_report.mmd
        sequence_failure_recovery.mmd
        accounting.mmd
    branch_B/
      overview.md
      contracts.md
      permissions.md
      flows.md
      diagrams/
        architecture.mmd
        sequence_mint_allocate.mmd
        sequence_harvest_report.mmd
        sequence_failure_recovery.mmd
        accounting.mmd
  reconciliation/
    reconciliation_report.md
    merge_notes.md
  security/
    risk_register.md
    trust_boundaries.md
  appendix/
    glossary.md
    references.md

Doc requirements (what to write)

1) report_ousdv2/README.md
- What this report is
- How it was generated (branches, commit hashes)
- How to read it
- Quick links to summary + branch reports + reconciliation

2) summary/executive_summary.md
- 1-page summary of Phase 2 design and why it exists
- “What’s implemented today” vs “What differs between branches”
- Explicitly list critical assumptions (bridges/messengers, keepers, admin)

3) summary/key_invariants.md
- Bullet list of invariants and what enforces them (code refs)
Examples:
- Conservation-ish properties (totalAssets, accounting)
- Authorization invariants (who can move funds, who can report)
- Liveness invariants (what happens if a chain is down)

4) branches/branch_*/(overview/contracts/permissions/flows).md
- overview.md: narrative description + components
- contracts.md: contract inventory (table) + responsibilities + key functions
- permissions.md: roles & permissions matrix, highlight admin flows
- flows.md: flow-of-funds detailed narrative (steps, events, state variables)

5) reconciliation/*
- reconciliation_report.md: what matches, what differs, interface mismatches, accounting mismatches
- merge_notes.md: minimal safe merge plan + required tests

6) security/*
- risk_register.md: ranked risks w/ severity, impact, likelihood, mitigation, code refs
- trust_boundaries.md: identify all trust boundaries (messenger, oracle/reporting, admin keys, keepers)

7) appendix/*
- glossary.md: define project-specific terms used in docs
- references.md: list code references used heavily (paths/contracts), plus branch names + commit hashes

Mermaid diagram requirements
- Use Mermaid syntax in `.mmd` files only (no embedded markdown diagrams).
- Keep diagrams readable:
  - Use subgraphs for “Mainnet” and each “Destination Chain”
  - Separate “Actors” (EOA, multisig, keeper, relayer) from “Contracts”
  - Label trust boundaries explicitly (e.g., “Cross-chain messenger”)
- Each diagram file must have a short comment header describing what it shows and any UNKNOWN items.

Create these diagrams per branch:
A) architecture.mmd
- actors + contracts + external systems + messaging paths
B) sequence_mint_allocate.mmd
- user mint → allocation decision → dispatch to chains
C) sequence_harvest_report.mmd
- yield accrual → harvest → accounting update / report to hub → distribution effect
D) sequence_failure_recovery.mmd
- a bridge/messenger outage OR destination chain downtime
- show safe-mode / guardian / pause paths (if present), or mark UNKNOWN
E) accounting.mmd
- state variables and relationships: totalAssets, per-chain balances, pending, fees, etc.
- show how reported balances affect OUSD accounting

Branch handling
- Identify the two relevant branches automatically (or read them from your earlier output).
- For each branch, record:
  - branch name
  - commit hash
  - build system
  - whether compilation/tests succeeded
- If you cannot checkout branches (environment limitation), document that explicitly and proceed using what you can access, marking gaps as UNKNOWN.

Final step
After writing all files, print a concise “Report Index” to stdout:
- list generated files
- highlight the top 5 risks and the top 5 reconciliation diffs (with links/paths)

Now execute:
1) Create `report_ousdv2/` and all subfolders.
2) Populate every file listed above with actual content based on the code.
3) Generate Mermaid diagrams into the correct `diagrams/` directories.

### Prompt 3

You are an expert DeFi protocol architect + Solidity engineer + threat modeler.

Context:
We completed Phase 2 (multichain yield distribution). We already have extensive documentation under `report_ousdv2/` describing Phase 2, including branch differences and diagrams.

Goal:
Create a Phase 3 “decision package” that proposes concrete ways to expand OUSD presence across multiple chains, grounded in Phase 2 reality. Do NOT rewrite Phase 2 docs; summarize only what is necessary to justify Phase 3 choices.

Hard rules:
- Stay grounded in Phase 2 docs and code. No guessing.
- Every important claim about Phase 2 constraints must cite the relevant report file path and/or code reference.
- For each Phase 3 option, clearly state new trust assumptions and what changes in blast radius.
- Optimize for security + operational simplicity first, growth second (but still include a liquidity/UX plan).
- Output everything under `report_ousdv2/phase3/`.

Inputs you must use:
- All markdown files under `report_ousdv2/` (Phase 2 report)
- Mermaid diagrams under `report_ousdv2/**/diagrams/*.mmd`
- The repo codebase when you need to validate feasibility

Deliverables (create these files exactly):

report_ousdv2/phase3/
  README.md
  phase2_constraints.md
  design_goals.md
  option_matrix.md
  options/
    option_1_canonical_bridged.md
    option_2_hub_spoke_lockbox.md
    option_3_burn_mint_messaging.md
    option_4_liquidity_only_expansion.md
  recommendation.md
  migration_plan.md
  security_and_risk.md
  required_changes/
    contracts_to_add.md
    contracts_to_modify.md
    interface_changes.md
  diagrams/
    phase3_architecture_option_1.mmd
    phase3_architecture_option_2.mmd
    phase3_architecture_option_3.mmd
    phase3_architecture_option_4.mmd
    phase3_sequence_happy_path.mmd
    phase3_sequence_failure_recovery.mmd
  open_questions.md

Step 1 — Extract Phase 2 constraints (no design yet)
Read the existing report and create `phase2_constraints.md` with:
- Canonical accounting model summary (what is the hub of truth?)
- How Phase 2 moves funds cross-chain (messenger/bridge model)
- How yields are recognized and distributed to OUSD holders
- Roles/admin model and emergency controls
- Operational requirements (keepers, permissions, reporting cadence, dependencies)
- Explicit invariants we must not break
Cite sources: `report_ousdv2/<path>.md` and code refs when needed.

Step 2 — Define Phase 3 goals & non-goals
Create `design_goals.md` with:
- Goals (e.g., chain coverage, UX, integration friendliness, liquidity depth, resilience)
- Non-goals (e.g., “no per-chain independent accounting unless X”, “no reliance on unsafe messengers”, etc.)
- Success metrics (TVL by chain, peg, redemption UX, operational burden)

Step 3 — Propose Phase 3 options (4 options)
Create 4 options, each MUST include:

A) One-paragraph description
B) What changes vs Phase 2 (contracts, flows, ops)
C) Trust assumptions + threat model delta
D) Accounting model (supply semantics, backing, reconciliation)
E) Liquidity + distribution plan (how OUSD gets deep liquidity on target chains)
F) UX (mint, redeem, bridge, latency, fees)
G) Operational load (keepers, rebalancing, incident response)
H) Blast radius analysis (what can fail and impact whom)
I) Implementation sketch (concrete contract/module list; reuse Phase 2 components where possible)
J) Test/monitoring requirements

Use these option templates (names are fixed):
1) Canonical bridged OUSD (single supply on mainnet; bridged representations)
2) Hub-and-spoke lockbox (mint/burn per chain but backed by hub accounting)
3) Burn-mint messaging (cross-chain supply moves via messaging; OFT-like semantics)
4) Liquidity-only expansion (keep canonical OUSD; focus on local liquidity + integrations; no new mint path)

Step 4 — Option comparison matrix
Create `option_matrix.md` as a table scoring each option (1–5) on:
- Security
- Accounting complexity
- Cross-chain dependency risk
- UX
- Liquidity fragmentation risk
- Implementation effort
- Operational burden
Include short justification bullets for each score.

Step 5 — Recommendation and migration plan
- `recommendation.md`: pick 1 option as primary + 1 as fallback.
  - Must cite Phase 2 constraints that drove the choice.
  - Must include “why not the others” (real reasons).
- `migration_plan.md`: phased rollout (M0/M1/M2):
  - MVP that minimizes new trust assumptions
  - Testnet/devnet plan
  - Rollout gates + kill switches
  - Backward compatibility and upgrade plan

Step 6 — Required contract/interface changes
Write:
- `required_changes/contracts_to_add.md`
- `required_changes/contracts_to_modify.md`
- `required_changes/interface_changes.md`
Each item must reference existing Phase 2 contracts/functions that will be extended or reused.

Step 7 — Phase 3 diagrams (Mermaid)
Generate Mermaid `.mmd` diagrams:
- One architecture diagram per option (show actors, chains, contracts, trust boundaries)
- A single “happy path” sequence diagram for the recommended option
- A single “failure + recovery” sequence diagram (bridge down, chain down, reporter compromised)
Keep diagrams readable with subgraphs per chain and explicit trust boundaries.

Step 8 — Security & risk
Create `security_and_risk.md`:
- Top risks per option
- New attack surfaces introduced in Phase 3
- Controls required (auth, proofs, rate limits, circuit breakers, reconciliation checks)
- Monitoring signals to detect anomalies early

Step 9 — Open questions
Create `open_questions.md` listing UNKNOWN items and what evidence/tests are needed.

Execution instructions:
- Create the directories/files exactly as specified.
- Populate them with high-quality content grounded in the existing `report_ousdv2/` docs and code.
- End by printing a short index of generated Phase 3 files and the recommended option.

### Prompt 4

I like option 2 because I want to allow mint and async withdrawals on every chain. It's important to have this functionality because we need the token to be rebased, the yield-forwarding functionality, and AMO to push deep liquidity. 
I also want to allow users from Base to go to SEI, but we should keep accounting on Ethereum.
The vault on Ethereum should be the only vault that has access to deposit USDC on the strategies (morpho); all the other deployments should send USDC to the Ethereum vault or deposit on a local AMO.
More importantly, this design needs to be super simple and very security-focused.

Can you create option 5 with all these requirements?