import type { ethers } from "ethers";

/**
 * Standalone (hardhat-free) action framework. Same authoring API as before —
 * action({ name, description, chains, params, run }) with an ethers `signer` in
 * the run context — but actions self-register into an in-process registry
 * instead of hardhat tasks, and the `params:(t)=>{...}` builder is served by a
 * lightweight shim so existing action bodies need no change. Dispatched by
 * tasks/run.ts; catalogued by dump-actions-catalog.ts.
 */

export interface Logger {
  info(msg: unknown, ...rest: unknown[]): void;
  warn(msg: unknown, ...rest: unknown[]): void;
  error(msg: unknown, ...rest: unknown[]): void;
}

export interface ActionContext {
  signer: ethers.Signer;
  chainId: number;
  networkName: string;
  log: Logger;
  args: Record<string, any>;
}

export type ParamType = "string" | "int" | "float" | "boolean";

export interface ParamSpec {
  name: string;
  description: string;
  type: ParamType;
  isOptional: boolean;
  isFlag: boolean;
  hasDefault: boolean;
  defaultValue: string | number | boolean | null;
}

// hardhat-compatible `types` markers — only `.name` is ever read. Lets action
// files do `import { types } from "../lib/action"` instead of "hardhat/config".
export const types = {
  string: { name: "string" as const },
  int: { name: "int" as const },
  float: { name: "float" as const },
  boolean: { name: "boolean" as const },
  // Aliases hardhat exposes that some actions may reference.
  json: { name: "string" as const },
  bigint: { name: "string" as const },
};

type TypeMarker = { name: string };

/**
 * Mirrors the subset of hardhat's ConfigurableTaskDefinition param builder that
 * action files use, so `params:(t)=>{ t.addParam(...) }` blocks are unchanged.
 */
export class ParamBuilder {
  readonly params: ParamSpec[] = [];

  private add(
    name: string,
    description: string | undefined,
    defaultValue: unknown,
    type: TypeMarker | undefined,
    isOptional: boolean,
    isFlag: boolean
  ): this {
    if (this.params.some((p) => p.name === name)) return this;
    const t = (type?.name ?? "string") as ParamType;
    this.params.push({
      name,
      description: description ?? "",
      type: t === "int" || t === "float" || t === "boolean" ? t : "string",
      isOptional,
      isFlag,
      hasDefault: defaultValue !== undefined,
      defaultValue:
        defaultValue === undefined
          ? null
          : (defaultValue as ParamSpec["defaultValue"]),
    });
    return this;
  }

  addParam(
    name: string,
    description?: string,
    defaultValue?: unknown,
    type?: TypeMarker
  ): this {
    return this.add(
      name,
      description,
      defaultValue,
      type,
      defaultValue !== undefined,
      false
    );
  }

  addOptionalParam(
    name: string,
    description?: string,
    defaultValue?: unknown,
    type?: TypeMarker
  ): this {
    return this.add(name, description, defaultValue, type, true, false);
  }

  addFlag(name: string, description?: string): this {
    return this.add(name, description, false, types.boolean, true, true);
  }
}

export interface ActionConfig {
  name: string;
  description: string;
  chains?: number[];
  params?: (t: ParamBuilder) => void;
  run: (ctx: ActionContext) => Promise<void>;
}

export interface RegisteredAction {
  config: ActionConfig;
  params: ParamSpec[];
}

export const registry = new Map<string, RegisteredAction>();

export function action(config: ActionConfig): void {
  if (registry.has(config.name)) {
    throw new Error(`Duplicate Talos action name: ${config.name}`);
  }
  const builder = new ParamBuilder();
  if (config.params) config.params(builder);
  registry.set(config.name, { config, params: builder.params });
}
