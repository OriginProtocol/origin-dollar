/**
 * Registration target for the `task()` / `subtask()` declarations in
 * tasks/tasks.js. It records the declarations with Hardhat's semantics so
 * tasks.js stays the single source of truth for the `pnpm ops` catalogue: an
 * override (`task("x")` after `subtask("x")`) inherits the parent's
 * description and params, `addParam` is optional as soon as it carries a
 * default, and `default` is only present when one was declared.
 */
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

export type TaskAction = (
  args: Record<string, unknown>,
  context: unknown,
  runSuper: () => Promise<unknown>
) => Promise<unknown>;

export type TaskEntry = {
  description: string;
  params: CommandParam[];
  action?: TaskAction;
  superAction?: TaskAction;
};

type TaskType = { name: string };

const entries = new Map<string, TaskEntry>();

export const types: Record<string, TaskType> = Object.fromEntries(
  ["string", "int", "float", "boolean", "json", "any"].map((name) => [
    name,
    { name },
  ])
);

function makeDefinition(name: string, description?: string) {
  const prior = entries.get(name);
  const entry: TaskEntry = prior
    ? {
        description: description ?? prior.description,
        params: [...prior.params],
        superAction: prior.action ?? prior.superAction,
      }
    : { description: description ?? "", params: [] };
  entries.set(name, entry);
  const paramDefinitions: Record<string, CommandParam> = {};
  for (const param of entry.params) paramDefinitions[param.name] = param;
  const record = (
    param: Omit<CommandParam, "type" | "default">,
    type: TaskType | undefined,
    defaultValue: unknown
  ) => {
    const spec: CommandParam = {
      ...param,
      type: (type?.name ?? "string") as ParamType,
    };
    if (defaultValue !== undefined) spec.default = defaultValue;
    if (paramDefinitions[spec.name])
      throw new Error(`Param '${spec.name}' declared twice on '${name}'`);
    paramDefinitions[spec.name] = spec;
    entry.params.push(spec);
    return definition;
  };
  const definition = {
    paramDefinitions,
    addParam(
      paramName: string,
      paramDescription = "",
      defaultValue?: unknown,
      type?: TaskType,
      isOptional = defaultValue !== undefined
    ) {
      return record(
        {
          name: paramName,
          description: paramDescription,
          optional: isOptional,
          flag: false,
          variadic: false,
        },
        type,
        defaultValue
      );
    },
    addOptionalParam(
      paramName: string,
      paramDescription = "",
      defaultValue?: unknown,
      type?: TaskType
    ) {
      return record(
        {
          name: paramName,
          description: paramDescription,
          optional: true,
          flag: false,
          variadic: false,
        },
        type,
        defaultValue
      );
    },
    addFlag(paramName: string, paramDescription = "") {
      return record(
        {
          name: paramName,
          description: paramDescription,
          optional: true,
          flag: true,
          variadic: false,
        },
        types.boolean,
        false
      );
    },
    addVariadicPositionalParam(
      paramName: string,
      paramDescription = "",
      defaultValue?: unknown,
      type?: TaskType,
      isOptional = defaultValue !== undefined
    ) {
      return record(
        {
          name: paramName,
          description: paramDescription,
          optional: isOptional,
          flag: false,
          variadic: true,
        },
        type,
        defaultValue
      );
    },
    addOptionalVariadicPositionalParam(
      paramName: string,
      paramDescription = "",
      defaultValue?: unknown,
      type?: TaskType
    ) {
      return record(
        {
          name: paramName,
          description: paramDescription,
          optional: true,
          flag: false,
          variadic: true,
        },
        type,
        defaultValue
      );
    },
    setAction(action: TaskAction) {
      entry.action = action;
      return definition;
    },
  };
  return definition;
}

export const task = (name: string, description?: string) =>
  makeDefinition(name, description);
export const subtask = (name: string, description?: string) =>
  makeDefinition(name, description);

/** Every declared task, in declaration order. */
export function registeredTasks(): Map<string, TaskEntry> {
  return entries;
}
