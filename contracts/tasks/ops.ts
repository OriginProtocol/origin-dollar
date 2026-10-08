#!/usr/bin/env tsx
import "dotenv/config";
import { commandByName, commands } from "./commands";
import {
  camelToKebab,
  coerceParams,
  createCommandContext,
  parseCli,
  type CommandDefinition,
} from "./lib/command";
import { initNetwork, setSigner } from "./lib/network";
import { getOptionalSigner } from "./lib/signer";

function usage(): string {
  return (
    "usage: pnpm ops <command> --network <network> [options]\n" +
    "       pnpm ops <command> --help\n\n" +
    commands
      .map(({ name, description }) => `  ${name.padEnd(31)} ${description}`)
      .join("\n")
  );
}

export function commandUsage(command: CommandDefinition): string {
  const lines = [
    `usage: pnpm ops ${command.name} --network <network>` +
      (command.params.length ? " [options]" : ""),
    "",
    command.description,
  ];
  if (command.params.length) {
    lines.push("", "options:");
    for (const param of command.params) {
      const option = `--${camelToKebab(param.name)}`;
      const value = param.flag ? "" : ` <${param.type}>`;
      const status = param.flag
        ? "flag"
        : Object.prototype.hasOwnProperty.call(param, "default")
        ? `default: ${JSON.stringify(param.default)}`
        : param.optional
        ? "optional"
        : "required";
      lines.push(
        `  ${`${option}${value}`.padEnd(31)} ${param.description} (${status})`
      );
    }
  }
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const { name, network, flags } = parseCli(argv);
  if (!name || name === "help") {
    console.log(usage());
    return;
  }
  const command = commandByName.get(name);
  if (!command) throw new Error(`Unknown command '${name}'\n\n${usage()}`);
  if (flags.help === true) {
    console.log(commandUsage(command));
    return;
  }
  if (!network) throw new Error("--network is required");
  const args = coerceParams(command.params, flags);
  initNetwork(network);
  const signer = await getOptionalSigner({
    taskName: command.name,
    relayerId: typeof args.relayerId === "string" ? args.relayerId : undefined,
  });
  if (signer) setSigner(signer);
  await command.handler(args, createCommandContext());
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
