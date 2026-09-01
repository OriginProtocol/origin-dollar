import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  legacyHandler,
  type CommandDefinition,
  type CommandParam,
} from "./lib/command";

type CatalogueEntry = Omit<CommandDefinition, "handler">;
const catalogue = JSON.parse(
  readFileSync(
    join(__dirname, "test", "fixtures", "ops-command-catalog.json"),
    "utf8"
  )
) as Array<{
  name: string;
  description: string;
  params: CommandParam[];
  destination: string;
}>;

export const commands: CommandDefinition[] = catalogue.map((entry) => ({
  ...entry,
  handler:
    entry.name === "accounts"
      ? async (_args, context) => {
          const accounts = await context.ethers.provider.listAccounts();
          for (const [index, address] of accounts.entries()) {
            const role =
              index === 0 ? " [Deployer]" : index === 1 ? " [Governor]" : "";
            console.log(`${address}${role}`);
          }
        }
      : legacyHandler(entry.name),
}));

export const commandByName = new Map(
  commands.map((command) => [command.name, command])
);

export type { CatalogueEntry };
