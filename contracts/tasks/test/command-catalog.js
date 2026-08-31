const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

describe("standalone ops command catalogue", function () {
  this.timeout(120000);

  it("preserves every public operational command with a live destination", function () {
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, "fixtures", "ops-command-catalog.json"),
        "utf8"
      )
    );
    const { commands } = require("../commands");
    const registrations = readFileSync(
      join(__dirname, "..", "tasks.js"),
      "utf8"
    );
    const registeredNames = new Set(
      [...registrations.matchAll(/\b(?:task|subtask)\(\s*["']([^"']+)/g)].map(
        (match) => match[1]
      )
    );
    registeredNames.add("accounts");

    assert.equal(fixture.length, 75);
    assert.deepEqual(
      [...registeredNames].sort(),
      fixture.map(({ name }) => name).sort()
    );
    assert.deepEqual(
      commands.map(({ name, description, params, destination }) => ({
        name,
        description,
        params,
        destination,
      })),
      fixture
    );
    assert.equal(new Set(commands.map(({ name }) => name)).size, 75);
    assert.equal(
      commands.some(({ name }) => name === "accounts"),
      true
    );
    assert.equal(
      commands.some(({ destination }) => destination === "deleted"),
      false
    );
    assert.equal(
      commands.every(({ handler }) => typeof handler === "function"),
      true
    );
  });
});
