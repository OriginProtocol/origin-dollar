/**
 * Pins the `pnpm ops` catalogue derived from the task declarations in
 * tasks/tasks.js. A diff here means a command, param, type, default or
 * description changed; regenerate the snapshot with:
 *
 *   TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -e '
 *     const { commands } = require("./tasks/commands");
 *     const out = commands.map(({ name, description, params, destination }) =>
 *       ({ name, description, params, destination }));
 *     require("node:fs").writeFileSync(
 *       "tasks/test/fixtures/ops-command-catalog.json",
 *       JSON.stringify(out, null, 2) + "\n");'
 */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

describe("standalone ops command catalogue", function () {
  this.timeout(120000);

  const fixture = JSON.parse(
    readFileSync(
      join(__dirname, "fixtures", "ops-command-catalog.json"),
      "utf8"
    )
  );
  const { commands, hasTaskAction } = require("../commands");

  it("matches the pinned snapshot of the tasks.js declarations", function () {
    assert.deepEqual(
      commands.map(({ name, description, params, destination }) => ({
        name,
        description,
        params,
        destination,
      })),
      fixture
    );
  });

  it("registers every task and subtask declared in tasks.js", function () {
    const registrations = readFileSync(
      join(__dirname, "..", "tasks.js"),
      "utf8"
    );
    const declaredNames = new Set(
      [...registrations.matchAll(/\b(?:task|subtask)\(\s*["']([^"']+)/g)].map(
        (match) => match[1]
      )
    );
    assert.deepEqual(
      commands.map(({ name }) => name).sort(),
      [...declaredNames].sort()
    );
    assert.equal(
      new Set(commands.map(({ name }) => name)).size,
      commands.length
    );
  });

  it("binds every command to a live handler", function () {
    for (const { name, handler } of commands) {
      assert.equal(typeof handler, "function", name);
      assert.equal(hasTaskAction(name), true, `no action for '${name}'`);
    }
  });

  it("records Hardhat's param semantics", function () {
    const byName = new Map(commands.map((command) => [command.name, command]));
    const allowance = byName.get("allowance");
    // relayerId is injected by the task decorator ahead of the declared params
    // and is not re-added when the task overrides its subtask.
    assert.deepEqual(
      allowance.params.map(({ name }) => name),
      ["relayerId", "symbol", "spender", "owner", "block"]
    );
    assert.deepEqual(
      allowance.params.find(({ name }) => name === "symbol"),
      {
        name: "symbol",
        description: "Symbol of the token. eg OETH, WETH, USDC or OGV",
        type: "string",
        optional: false,
        flag: false,
        variadic: false,
      }
    );
    assert.equal(
      allowance.params.find(({ name }) => name === "owner").optional,
      true
    );
    // addParam with a default is optional and carries the default.
    const mint = byName.get("mint");
    const min = mint.params.find(({ name }) => name === "min");
    assert.equal(min.optional, true);
    assert.equal(min.default, 0);
    assert.equal(min.type, "float");
  });
});
