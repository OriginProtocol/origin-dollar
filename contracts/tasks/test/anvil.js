const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { JsonRpcProvider } = require("@ethersproject/providers");
const { Wallet } = require("ethers");

describe("canonical Anvil node", function () {
  this.timeout(30000);
  let child;
  let startupOutput = "";
  const port = 18545;
  const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`);

  before(async function () {
    child = spawn("./anvil.sh", ["base"], {
      cwd: process.cwd(),
      env: { ...process.env, ANVIL_NO_FORK: "true", PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => (startupOutput += chunk));
    child.stderr.on("data", (chunk) => (startupOutput += chunk));
    const deadline = Date.now() + 20000;
    while (!startupOutput.includes("Anvil ready") && Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(startupOutput);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!startupOutput.includes("Anvil ready")) throw new Error(startupOutput);
  });

  after(async function () {
    if (child?.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  });

  it("keeps the selected real chain id and supports simulation RPCs", async function () {
    assert.equal((await provider.getNetwork()).chainId, 8453);
    const snapshot = await provider.send("evm_snapshot", []);
    await provider.send("evm_mine", []);
    assert.equal(await provider.send("evm_revert", [snapshot]), true);

    const account = "0x000000000000000000000000000000000000bEEF";
    await provider.send("anvil_impersonateAccount", [account]);
    await provider.send("anvil_setBalance", [account, "0x56bc75e2d63100000"]);
    await provider.send("anvil_setCode", [account, "0x00"]);
    assert.equal(await provider.getCode(account), "0x00");
  });

  it("does not print development secrets", function () {
    assert.doesNotMatch(startupOutput, /Private Keys|Mnemonic:/);
  });

  it("accepts a transaction signed with the retained local mnemonic", async function () {
    const wallet = Wallet.fromMnemonic(
      "replace hover unaware super where filter stone fine garlic address matrix basic"
    ).connect(provider);
    const transaction = await wallet.sendTransaction({
      to: "0x000000000000000000000000000000000000dEaD",
      value: 1,
    });
    assert.equal((await transaction.wait()).status, 1);
  });
});
