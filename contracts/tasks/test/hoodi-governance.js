const { expect } = require("chai");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const RELAYER = "0x000000000000000000000000000000000000cafe";
const BOOTSTRAP = "0x00000000000000000000000000000000000a11ce";

function loadAction() {
  const governors = new Map();
  const claims = [];
  const token = { address: "token" };
  const vault = {
    address: "vault",
    strategistAddr: async () => RELAYER,
    oToken: async () => token.address,
  };
  const strategy = {
    address: "strategy",
    validatorRegistrator: async () => RELAYER,
    vaultAddress: async () => vault.address,
  };
  const byName = {
    OETHProxy: token,
    OETHVaultProxy: vault,
    CompoundingStakingStrategyProxy: strategy,
  };
  let action;
  const source = fs.readFileSync(
    path.join(__dirname, "../actions/claimHoodiGovernance.ts"),
    "utf8"
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  class Contract {
    constructor(address) {
      this.address = address;
    }
    async governor() {
      return governors.get(this.address) || BOOTSTRAP;
    }
    async claimGovernance() {
      claims.push(this.address);
      governors.set(this.address, RELAYER);
      return { wait: async () => {} };
    }
  }
  vm.runInNewContext(js, {
    exports: {},
    require: (name) => {
      if (name === "ethers") return { ethers: { Contract } };
      if (name === "../lib/action")
        return {
          action: (a) => {
            action = a;
          },
        };
      if (name === "../lib/contracts")
        return {
          getContract: async (n) => byName[n],
          getContractAt: async (_, addr) =>
            Object.values(byName).find((c) => c.address === addr),
        };
      throw new Error(name);
    },
  });
  return { action, governors, claims, vault, strategy };
}

const context = {
  signer: { getAddress: async () => RELAYER },
  log: { info() {} },
};

describe("Fresh Hoodi governance handoff", () => {
  it("claims all three fresh proxies and can be retried", async () => {
    const { action, claims } = loadAction();
    expect(action.chains).to.deep.equal([560048]);
    await action.run(context);
    await action.run(context);
    expect(claims).to.deep.equal(["token", "vault", "strategy"]);
  });
  it("resumes after a previously completed token claim", async () => {
    const { action, claims, governors } = loadAction();
    governors.set("token", RELAYER);
    await action.run(context);
    expect(claims).to.deep.equal(["vault", "strategy"]);
  });
  it("rejects mismatched roles before sending transactions", async () => {
    const { action, claims, vault } = loadAction();
    vault.strategistAddr = async () => BOOTSTRAP;
    let error;
    try {
      await action.run(context);
    } catch (e) {
      error = e;
    }
    expect(error.message).to.include("not configured for this relayer");
    expect(claims).to.deep.equal([]);
  });
  it("rejects a different vault token before sending transactions", async () => {
    const { action, claims, vault } = loadAction();
    vault.oToken = async () => "old-token";
    let error;
    try {
      await action.run(context);
    } catch (e) {
      error = e;
    }
    expect(error.message).to.include("token/vault mismatch");
    expect(claims).to.deep.equal([]);
  });
});
