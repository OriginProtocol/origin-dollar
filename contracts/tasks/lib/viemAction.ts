import type { Account, Address, PublicClient, WalletClient } from "viem";
import type { ResolveArgs, ResolvedContract } from "./resolveContract";
import type { SendTx, WriteContract } from "./sendTx";

export interface Logger {
  info(msg: unknown, ...rest: unknown[]): void;
  warn(msg: unknown, ...rest: unknown[]): void;
  error(msg: unknown, ...rest: unknown[]): void;
}

export interface ActionContext {
  publicClient: PublicClient;
  walletClient: WalletClient;
  /** viem LocalAccount (KMS / private key) or plain address (impersonation). */
  account: Account | Address;
  chainId: number;
  networkName: string;
  log: Logger;
  args: Record<string, unknown>;
  /** Send a raw `{ to, data, value?, gas? }` tx through the nonce queue. */
  sendTx: SendTx;
  /** Encode + send a contract write through the same nonce-queue path. */
  writeContract: WriteContract;
  /** Resolve a viem contract (address = deployed truth, abi = curated interface). */
  resolveContract: (args: ResolveArgs) => ResolvedContract;
}

export type ParamType = "string" | "int" | "float" | "boolean";

export interface ParamSpec {
  name: string;
  description?: string;
  type: ParamType;
  optional?: boolean;
  /** A boolean flag (`--dryrun`) rather than a value param. */
  flag?: boolean;
  default?: string | number | boolean;
}

export interface ActionConfig {
  name: string;
  description: string;
  /** Chain ids the action supports. Omit / empty => any supported chain. */
  chains?: number[];
  params?: ParamSpec[];
  run: (ctx: ActionContext) => Promise<void>;
}

/**
 * In-process registry of viem Talos actions. Replaces hardhat task
 * registration. Populated by side-effect imports of the action files (see
 * `tasks/actions-viem/index.ts`), consumed by `run.ts` (dispatch) and
 * `dumpCatalog.ts` (admin catalog).
 */
export const registry = new Map<string, ActionConfig>();

export function action(config: ActionConfig): void {
  if (registry.has(config.name)) {
    throw new Error(`Duplicate Talos action name: ${config.name}`);
  }
  registry.set(config.name, config);
}
