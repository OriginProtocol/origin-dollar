export type TaskAction = (
  args: Record<string, unknown>,
  context: unknown,
  runSuper: () => Promise<unknown>
) => Promise<unknown>;

export type TaskEntry = {
  action?: TaskAction;
  superAction?: TaskAction;
};

const entries = new Map<string, TaskEntry>();

export const types = Object.fromEntries(
  ["string", "int", "float", "boolean", "json", "any"].map((name) => [
    name,
    { name },
  ])
);

function makeDefinition(name: string) {
  const prior = entries.get(name);
  const entry: TaskEntry = prior
    ? { action: undefined, superAction: prior.action ?? prior.superAction }
    : {};
  entries.set(name, entry);
  const definition = {
    paramDefinitions: {} as Record<string, unknown>,
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
    setAction(action: TaskAction) {
      entry.action = action;
      return definition;
    },
  };
  return definition;
}

export const task = (name: string) => makeDefinition(name);
export const subtask = (name: string) => makeDefinition(name);

export function registeredTasks(): Map<string, TaskEntry> {
  return entries;
}
