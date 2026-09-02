import { ethers } from "ethers";
import * as contracts from "./contracts";
import * as deployments from "./deployments";
import { getChainId, getNetworkName, getProvider } from "./network";
import { rolesFor } from "./roles";

export type ParamType = "string" | "int" | "float" | "boolean" | "json";
export type CommandParam = {
  name: string;
  description: string;
  type: ParamType;
  optional: boolean;
  flag: boolean;
  variadic: boolean;
  default?: unknown;
};
export type CommandContext = {
  chainId: number;
  networkName: string;
  ethers: typeof ethers & {
    provider: ethers.providers.JsonRpcProvider;
    getContract: typeof contracts.getContract;
    getContractAt: typeof contracts.getContractAt;
    getContractFactory: typeof contracts.getContractFactory;
  };
  network: {
    name: string;
    config: { chainId: number };
    provider: ethers.providers.JsonRpcProvider;
  };
  deployments: typeof deployments;
  getNamedAccounts: () => Promise<Record<string, string>>;
};
export type CommandHandler = (
  args: Record<string, unknown>,
  context: CommandContext
) => Promise<unknown>;
export type CommandDefinition = {
  name: string;
  description: string;
  params: CommandParam[];
  destination: string;
  handler: CommandHandler;
};

export function kebabToCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}
export function camelToKebab(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

export function parseCli(argv: string[]): {
  name?: string;
  network?: string;
  flags: Record<string, string | boolean>;
} {
  const [name, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index++) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument '${token}'`);
    }
    const key = kebabToCamel(token.slice(2));
    const next = rest[index + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      index++;
    }
  }
  const network = typeof flags.network === "string" ? flags.network : undefined;
  delete flags.network;
  return { name, network, flags };
}

export function coerceParams(
  specs: CommandParam[],
  flags: Record<string, string | boolean>
): Record<string, unknown> {
  const known = new Set(specs.map(({ name }) => name));
  const unknown = Object.keys(flags).find((name) => !known.has(name));
  if (unknown) throw new Error(`Unknown option --${camelToKebab(unknown)}`);

  const result: Record<string, unknown> = {};
  for (const spec of specs) {
    const raw = flags[spec.name];
    if (raw === undefined) {
      if (Object.prototype.hasOwnProperty.call(spec, "default"))
        result[spec.name] = spec.default;
      else if (spec.flag) result[spec.name] = false;
      else if (!spec.optional)
        throw new Error(`--${camelToKebab(spec.name)} is required`);
      continue;
    }
    const option = `--${camelToKebab(spec.name)}`;
    if (raw === true && spec.type !== "boolean" && !spec.flag)
      throw new Error(`${option} requires a value`);
    if (spec.type === "int" || spec.type === "float") {
      const value = Number(raw);
      if (
        String(raw).trim() === "" ||
        !Number.isFinite(value) ||
        (spec.type === "int" && !Number.isInteger(value))
      )
        throw new Error(`${option} must be a valid ${spec.type}`);
      result[spec.name] = value;
    } else if (spec.type === "boolean") {
      if (![true, "true", "false"].includes(raw))
        throw new Error(`${option} must be true or false`);
      result[spec.name] = raw === true || raw === "true";
    } else result[spec.name] = String(raw);
  }
  return result;
}

export function createCommandContext(): CommandContext {
  const chainId = getChainId();
  const networkName = getNetworkName();
  const provider = getProvider();
  const ethersRuntime = Object.assign({}, ethers, contracts, { provider });
  return {
    chainId,
    networkName,
    ethers: ethersRuntime,
    network: { name: networkName, config: { chainId }, provider },
    deployments,
    getNamedAccounts: async () => rolesFor(chainId),
  };
}

type LegacyAction = (
  args: Record<string, unknown>,
  context: CommandContext,
  runSuper: () => Promise<unknown>
) => Promise<unknown>;
type LegacyEntry = { action?: LegacyAction; superAction?: LegacyAction };
let legacyActions: Map<string, LegacyEntry> | undefined;

/**
 * Temporary PR-A adapter: loads the existing task declarations through a tiny,
 * registration-only shim. It never imports or starts Hardhat; the captured
 * business handlers receive the explicit standalone CommandContext above.
 * tasks/tasks.js remains unchanged as the A/B oracle until PR B.
 */
function loadLegacyActions(): Map<string, LegacyEntry> {
  if (legacyActions) return legacyActions;
  const entries = new Map<string, LegacyEntry>();
  const types = Object.fromEntries(
    ["string", "int", "float", "boolean", "json", "any"].map((name) => [
      name,
      { name },
    ])
  );
  const makeDefinition = (name: string) => {
    const prior = entries.get(name);
    const entry: LegacyEntry = prior
      ? { action: undefined, superAction: prior.action ?? prior.superAction }
      : {};
    entries.set(name, entry);
    const definition: Record<string, unknown> = {
      paramDefinitions: {},
      addParam() {
        return definition;
      },
      addOptionalParam() {
        return definition;
      },
      addFlag() {
        return definition;
      },
      addVariadicParam() {
        return definition;
      },
      addOptionalVariadicParam() {
        return definition;
      },
      setAction(action: LegacyAction) {
        entry.action = action;
        return definition;
      },
    };
    return definition;
  };
  const registration = {
    task: (name: string) => makeDefinition(name),
    subtask: (name: string) => makeDefinition(name),
    types,
  };
  const moduleApi = require("node:module") as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleApi._load;
  moduleApi._load = (request, parent, isMain) =>
    request === "hardhat/config"
      ? registration
      : originalLoad(request, parent, isMain);
  try {
    require("../tasks.js");
  } finally {
    moduleApi._load = originalLoad;
  }
  legacyActions = entries;
  return entries;
}

export function legacyHandler(name: string): CommandHandler {
  return async (args, context) => {
    const entry = loadLegacyActions().get(name);
    if (!entry?.action) throw new Error(`No operational handler for '${name}'`);
    const run = (action: LegacyAction | undefined): Promise<unknown> => {
      if (!action) throw new Error(`No parent handler for '${name}'`);
      return action(args, context, () => run(entry.superAction));
    };
    const globals = globalThis as Record<string, unknown>;
    const values: Record<string, unknown> = {
      ethers: context.ethers,
      deployments: context.deployments,
      getNamedAccounts: context.getNamedAccounts,
      hre: context,
    };
    const previous = new Map(
      Object.keys(values).map((key) => [
        key,
        {
          existed: Object.prototype.hasOwnProperty.call(globals, key),
          value: globals[key],
        },
      ])
    );
    Object.assign(globals, values);
    try {
      return await run(entry.action);
    } finally {
      for (const [key, state] of previous) {
        if (state.existed) globals[key] = state.value;
        else delete globals[key];
      }
    }
  };
}
