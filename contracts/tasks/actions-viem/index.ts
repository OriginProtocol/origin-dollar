/**
 * Registry index for migrated viem Talos actions. Each import self-registers
 * its action into the in-process registry (see tasks/lib/viemAction.ts).
 *
 * Actions are migrated off hardhat one at a time; add each here as it lands.
 * The legacy hardhat actions in tasks/actions/ remain the source of truth for
 * scheduled runs until an action's schedule command is switched to
 * `tsx tasks/run.ts <name>` (see migrations/seed_schedules.sql).
 */
import "./permissionedRebase";
import "./otokenAddWithdrawalQueueLiquidity";
