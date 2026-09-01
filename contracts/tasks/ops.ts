#!/usr/bin/env tsx
import "dotenv/config";
import { commandByName, commands } from "./commands";
import { coerceParams, createCommandContext, parseCli } from "./lib/command";
import { initNetwork, setSigner } from "./lib/network";
import { getOptionalSigner } from "./lib/signer";

function usage(): string {
  return (
    "usage: pnpm ops <command> --network <network> [options]\n\n" +
    commands
      .map(({ name, description }) => `  ${name.padEnd(31)} ${description}`)
      .join("\n")
  );
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const { name, network, flags } = parseCli(argv);
  if (!name || name === "help" || flags.help === true) {
    console.log(usage());
    return;
  }
  const command = commandByName.get(name);
  if (!command) throw new Error(`Unknown command '${name}'\n\n${usage()}`);
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
