import {
  hasLegacyAction,
  legacyHandler,
  registeredCommands,
  type CommandDefinition,
} from "./lib/command";

type CatalogueEntry = Omit<CommandDefinition, "handler">;

/**
 * The catalogue is derived from the task declarations in tasks/tasks.js;
 * tasks/test/fixtures/ops-command-catalog.json pins it as a snapshot.
 */
export const commands: CommandDefinition[] = registeredCommands().map(
  (entry) => ({
    ...entry,
    destination: `ops:${entry.name}`,
    handler: legacyHandler(entry.name),
  })
);

export const commandByName = new Map(
  commands.map((command) => [command.name, command])
);

export { hasLegacyAction };
export type { CatalogueEntry };
