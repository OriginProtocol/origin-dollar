const { expect } = require("chai");
const { BigNumber, ethers } = require("ethers");
const {
  REPEG_ABI,
  REPEG_PROFILES,
  getRepegProfile,
  parseSellPrice,
  parseTriggerPrice,
  sizeRepeg,
  deriveRepegValues,
  encodeRepeg,
  runCurveAmoRepeg,
} = require("../lib/curveAmoRepeg");
const { simulateCalls } = require("../lib/simulation");

const { parseEther, defaultAbiCoder, id } = ethers.utils;
const unit = parseEther("1");
const addr = (n) =>
  ethers.utils.getAddress(`0x${n.toString(16).padStart(40, "0")}`);
const addresses = {
  module: addr(1),
  vault: addr(2),
  amo: addr(3),
  checker: addr(4),
  token: addr(5),
};
const safe = addr(6),
  operator = addr(7),
  gauge = addr(8);
const encode = (type, value) => defaultAbiCoder.encode([type], [value]);
const uint = (value) => encode("uint256", value);
const ok = (returnData = "0x") => ({
  status: "0x1",
  returnData,
  gasUsed: "0x10000",
});
const fail = (reason) => ({
  status: "0x0",
  returnData: `0x08c379a0${encode("string", reason).slice(2)}`,
  gasUsed: "0x10000",
});
const moduleAbi = new ethers.utils.Interface(REPEG_ABI);
const viewAbi = new ethers.utils.Interface([
  "function oToken() view returns(address)",
  "function strategistAddr() view returns(address)",
  "function rebasePaused() view returns(bool)",
  "function rebase()",
  "function totalValue() view returns(uint256)",
  "function vaultAddress() view returns(address)",
  "function curvePool() view returns(address)",
  "function gauge() view returns(address)",
  "function vault() view returns(address)",
  "function ousd() view returns(address)",
  "function takeSnapshot()",
  "function snapshots(address) view returns(uint256,uint256,uint256)",
  "function decimals() view returns(uint8)",
  "function totalSupply() view returns(uint256)",
  "function balanceOf(address) view returns(uint256)",
  "function coins(uint256) view returns(address)",
  "function get_dy(int128,int128,uint256) view returns(uint256)",
  "function isModuleEnabled(address) view returns(bool)",
  "function removeAndBurnOTokens(uint256)",
]);
const logger = { info: () => {}, warn: () => {}, error: () => {} };
async function rejects(fn, fragment) {
  try {
    await fn();
  } catch (error) {
    expect(error.message).to.contain(fragment);
    return;
  }
  throw new Error(`Expected rejection containing ${fragment}`);
}
function fixture(asset = "OUSD", options = {}) {
  const profile = REPEG_PROFILES.find((p) => p.asset === asset);
  const requests = [],
    sent = [],
    plans = [],
    messages = [],
    infoMessages = [],
    moduleReads = [];
  const initialValue = parseEther("1000000");
  let nonce = BigNumber.from(0),
    preflights = 0;
  const quoteScale = BigNumber.from(10).pow(profile.quoteDecimals - 6);
  const base = BigNumber.from(options.base ?? 999600).mul(quoteScale);
  const quote = (lp, startingQuote = base) =>
    startingQuote.add(lp.mul(quoteScale).div(unit));
  const block = { number: 100, hash: `0x${"ab".repeat(32)}`, timestamp: 10000 };
  const provider = {
    getNetwork: async () => ({ chainId: profile.chainId }),
    getCode: async () => (options.undeployedModule ? "0x" : "0x1234"),
    getBlock: async (ref) => ({
      ...block,
      ...(ref === "latest"
        ? {}
        : options.reorg
        ? { hash: `0x${"cd".repeat(32)}` }
        : {}),
    }),
    call: async (tx) => {
      if (tx.to.toLowerCase() === addresses.module.toLowerCase()) {
        moduleReads.push(tx);
        if (options.undeployedModule) return "0x";
        const p = moduleAbi.parseTransaction(tx),
          name = p.name;
        const bindings = {
          vault: addresses.vault,
          amo: addresses.amo,
          checker: addresses.checker,
          safeContract: safe,
        };
        if (bindings[name]) return encode("address", bindings[name]);
        if (name === "maxProfitVariance" || name === "maxVaultChangeVariance")
          return uint(parseEther(options.cap ?? "1"));
        if (name === "nonce") return uint(nonce);
        if (name === "hasRole") {
          expect(p.args[0]).to.equal(id("OPERATOR_ROLE"));
          expect(p.args[1]).to.equal(operator);
          return encode("bool", options.authorized !== false);
        }
      }
      const p = viewAbi.parseTransaction(tx),
        name = p.name;
      const bindings = {
        oToken: addresses.token,
        strategistAddr: safe,
        vaultAddress: addresses.vault,
        curvePool: profile.pool,
        gauge,
        vault: addresses.vault,
        ousd: addresses.token,
      };
      if (bindings[name]) return encode("address", bindings[name]);
      if (name === "isModuleEnabled")
        return encode("bool", options.enabled !== false);
      if (name === "rebasePaused") return encode("bool", !!options.paused);
      if (name === "decimals")
        return encode(
          "uint8",
          tx.to.toLowerCase() === addresses.token.toLowerCase()
            ? 18
            : profile.quoteDecimals
        );
      if (name === "balanceOf")
        return uint(parseEther(options.staked ?? "1000"));
      if (name === "coins")
        return encode(
          "address",
          p.args[0].toNumber() === profile.tokenIndex
            ? addresses.token
            : profile.quoteAsset
        );
      if (name === "get_dy") {
        expect(p.args[0].toNumber()).to.equal(profile.tokenIndex);
        expect(p.args[1].toNumber()).to.equal(profile.quoteIndex);
        expect(p.args[2].eq(unit)).to.equal(true);
        return uint(base);
      }
      throw new Error(`Unimplemented read ${name}`);
    },
    send: async (method, params) => {
      requests.push({ method, params });
      if (options.unsupported)
        throw Object.assign(new Error("method not found"), { code: -32601 });
      expect(method).to.equal("eth_simulateV1");
      expect(params[1]).to.equal("0x64");
      const blockState = params[0].blockStateCalls[0];
      const finalPreflight = blockState.calls.some(
        (tx) => tx.to.toLowerCase() === addresses.module.toLowerCase()
      );
      let lp = BigNumber.from(0);
      const freshBase = options.freshBases?.[preflights] ?? options.freshBase;
      let startingQuote =
        finalPreflight && freshBase !== undefined
          ? BigNumber.from(freshBase).mul(quoteScale)
          : base;
      const results = blockState.calls.map((tx) => {
        if (tx.to.toLowerCase() === addresses.module.toLowerCase()) {
          expect(blockState).not.to.have.property("stateOverrides");
          expect(tx.from).to.equal(operator);
          const p = moduleAbi.parseTransaction(tx);
          plans.push(p.args);
          preflights++;
          if (options.moveNonce && preflights === 1) {
            nonce = nonce.add(1);
            return fail("Request nonce mismatch");
          }
          if (options.finalFailure) return fail("Safe call failed");
          if (!p.args[5].eq(nonce)) return fail("Request nonce mismatch");
          lp = p.args[0];
          expect(p.args[1].eq(lp.div(1000))).to.equal(true);
          expect(p.args[2].lt(p.args[1])).to.equal(true);
          expect(p.args[3].eq(lp.mul(-1).add(lp.div(1000)))).to.equal(true);
          expect(p.args[6].toNumber()).to.equal(10300);
          if (options.finalBelowTarget) lp = BigNumber.from(0);
          return ok();
        }
        const p = viewAbi.parseTransaction(tx),
          name = p.name;
        if (name === "rebase" || name === "takeSnapshot") {
          expect(tx.from).to.equal(safe);
          if (name === "rebase" && options.rebasedBase !== undefined) {
            startingQuote = BigNumber.from(options.rebasedBase).mul(quoteScale);
          }
          return ok();
        }
        if (name === "get_dy") return ok(uint(quote(lp, startingQuote)));
        if (name === "removeAndBurnOTokens") {
          if (options.burnFailure) return fail(options.burnFailure);
          if (p.args[0].gt(parseEther("250")))
            return fail("OTokens overshot peg");
          lp = p.args[0];
          return ok();
        }
        if (name === "snapshots")
          return ok(
            defaultAbiCoder.encode(
              ["uint256", "uint256", "uint256"],
              [initialValue, initialValue, 10000]
            )
          );
        if (name === "totalValue")
          return ok(uint(initialValue.sub(lp).add(lp.div(1000))));
        if (name === "totalSupply") return ok(uint(initialValue.sub(lp)));
        throw new Error(`Unimplemented simulated call ${name}`);
      });
      return [{ calls: results }];
    },
  };
  const signer = {
    _isSigner: true,
    resolveName: async (address) => address,
    provider,
    getAddress: async () => operator,
    sendTransaction: async (tx) => {
      sent.push(tx);
      return {
        hash: `0x${"12".repeat(32)}`,
        wait: async () => ({ status: 1, logs: [] }),
      };
    },
  };
  const run = (args = {}) =>
    runCurveAmoRepeg({
      signer,
      chainId: profile.chainId,
      asset,
      sellPrice: "0.9998",
      dryrun: true,
      resolveAddresses: () => addresses,
      log: {
        ...logger,
        info: (m) => infoMessages.push(m),
        warn: (m) => messages.push(m),
      },
      ...args,
    });
  return {
    run,
    requests,
    sent,
    plans,
    messages,
    infoMessages,
    moduleReads,
    provider,
    profile,
  };
}

describe("Curve AMO repegging", () => {
  it("registers decimal-string defaults and a dry-run switch in the Talos catalog", () => {
    require("../actions/ousdCurveAmoRepeg");
    const { registry } = require("../lib/action");
    const entry = registry.get("ousdCurveAmoRepeg");
    expect(entry.config.chains).to.deep.equal([1]);
    expect(entry.params.map((p) => p.name)).to.deep.equal([
      "sellPrice",
      "triggerPrice",
      "dryrun",
    ]);
    expect(registry.has("curveAmoRepeg")).to.equal(false);
    const price = entry.params.find((p) => p.name === "sellPrice");
    expect(price.type).to.equal("string");
    expect(price.defaultValue).to.equal("0.9998");
    const trigger = entry.params.find((p) => p.name === "triggerPrice");
    expect(trigger.type).to.equal("string");
    expect(trigger.defaultValue).to.equal("0.9997");
    expect(entry.params.find((p) => p.name === "dryrun").isFlag).to.equal(true);
  });
  it("keeps the public action OUSD-only even if an asset argument is supplied", async () => {
    require("../actions/ousdCurveAmoRepeg");
    const { registry } = require("../lib/action");
    const helper = require("../lib/curveAmoRepeg");
    const original = helper.runCurveAmoRepeg;
    const requests = [];
    helper.runCurveAmoRepeg = async (options) => {
      requests.push(options);
    };
    try {
      for (const asset of ["OETH", "SuperOETH"]) {
        await registry.get("ousdCurveAmoRepeg").config.run({
          signer: {},
          chainId: 1,
          networkName: "mainnet",
          log: logger,
          args: {
            asset,
            sellPrice: "0.9998",
            triggerPrice: "0.9996",
            dryrun: true,
          },
        });
      }
      expect(requests.map((request) => request.asset)).to.deep.equal([
        "OUSD",
        "OUSD",
      ]);
      expect(requests.map((request) => request.triggerPrice)).to.deep.equal([
        "0.9996",
        "0.9996",
      ]);
    } finally {
      helper.runCurveAmoRepeg = original;
    }
  });
  it("resolves only the profile supported on the requested chain", () => {
    expect(getRepegProfile("superoeth", 8453).tokenIndex).to.equal(1);
    expect(() => getRepegProfile("OETH", 8453)).to.throw("requires chain 1");
    expect(() => getRepegProfile("OS", 146)).to.throw("Unsupported asset");
  });
  it("parses prices exactly with quote-asset precision", () => {
    expect(parseSellPrice("0.9998", 6).toString()).to.equal("999800");
    expect(parseSellPrice("0.999800000000000001", 18).toString()).to.equal(
      "999800000000000001"
    );
  });
  for (const value of ["0", "1", "1.01", "-0.1", "1e-3", " 0.9", ".9", "NaN"])
    it(`rejects invalid target ${value}`, () =>
      expect(() => parseSellPrice(value, 6)).to.throw());
  it("rejects precision beyond USDC decimals", () =>
    expect(() => parseSellPrice("0.9998001", 6)).to.throw("at most 6"));
  it("parses trigger quotes exactly and allows a threshold equal to the target", () => {
    const target = parseSellPrice("0.9998", 6);
    expect(parseTriggerPrice("0.9997", 6, target).toString()).to.equal(
      "999700"
    );
    expect(parseTriggerPrice("0.9998", 6, target).eq(target)).to.equal(true);
    expect(
      parseTriggerPrice(
        "0.999700000000000001",
        18,
        parseSellPrice("0.9998", 18)
      ).toString()
    ).to.equal("999700000000000001");
  });
  for (const value of ["0", "-0.1", "1", "1e-3", "0.9997001", "0.999801"]) {
    it(`rejects invalid trigger ${value} with a trigger-specific error`, () => {
      expect(() =>
        parseTriggerPrice(value, 6, parseSellPrice("0.9998", 6))
      ).to.throw("triggerPrice");
    });
  }
  it("finds the first sufficient LP step below an overshoot boundary", async () => {
    const sized = await sizeRepeg(
      parseEther("1000"),
      BigNumber.from(100),
      async (lp) =>
        lp.gt(parseEther("200")) ? { overshot: true } : { quote: lp.div(unit) }
    );
    expect(sized.eq(parseEther("100"))).to.equal(true);
  });
  it("rejects targets beyond the staked LP balance", async () =>
    rejects(
      () =>
        sizeRepeg(parseEther("20"), BigNumber.from(100), async (lp) => ({
          quote: lp.div(unit),
        })),
      "staked LP balance"
    ));
  it("rejects targets requiring a peg overshoot", async () =>
    rejects(
      () =>
        sizeRepeg(parseEther("1000"), BigNumber.from(100), async (lp) =>
          lp.gte(parseEther("50"))
            ? { overshot: true }
            : { quote: lp.div(unit) }
        ),
      "overshooting"
    ));
  it("rejects LP dust below the sizing resolution", async () =>
    rejects(
      () =>
        sizeRepeg(BigNumber.from(1), BigNumber.from(100), async () => ({
          quote: BigNumber.from(0),
        })),
      "insufficient"
    ));
  it("bounds pathological searches", async () =>
    rejects(
      () =>
        sizeRepeg(BigNumber.from(2).pow(255), BigNumber.from(1), async () => ({
          quote: BigNumber.from(0),
        })),
      "search limit"
    ));
  it("derives strictly profitable checker bounds in vault units", () => {
    const v = deriveRepegValues(
      parseEther("1000"),
      parseEther("1000"),
      parseEther("900.1"),
      parseEther("900"),
      parseEther("1"),
      parseEther("0.0001")
    );
    expect(v.expectedProfit.eq(parseEther("0.1"))).to.equal(true);
    expect(v.profitVariance.eq(parseEther("0.1").sub(1))).to.equal(true);
    expect(v.vaultChangeVariance.eq(parseEther("0.0001"))).to.equal(true);
  });
  it("rejects zero simulated profit", () => {
    expect(() =>
      deriveRepegValues(unit, unit, unit.sub(10), unit.sub(10), unit, unit)
    ).to.throw("strictly positive profit");
  });
  it("accepts one wei of profit with zero variance", () => {
    const v = deriveRepegValues(
      unit,
      unit,
      unit.sub(9),
      unit.sub(10),
      unit,
      unit
    );
    expect(v.expectedProfit.toString()).to.equal("1");
    expect(v.profitVariance.isZero()).to.equal(true);
  });
  it("keeps the profit floor positive when profit exactly equals the cap", () => {
    const v = deriveRepegValues(
      unit,
      unit,
      unit.sub(90),
      unit.sub(100),
      BigNumber.from(10),
      unit
    );
    expect(v.expectedProfit.toString()).to.equal("10");
    expect(v.profitVariance.toString()).to.equal("9");
  });
  it("uses the full cap when profit exceeds it", () => {
    const v = deriveRepegValues(
      unit,
      unit,
      unit.sub(89),
      unit.sub(100),
      BigNumber.from(10),
      unit
    );
    expect(v.expectedProfit.toString()).to.equal("11");
    expect(v.profitVariance.toString()).to.equal("10");
  });
  it("rejects a loss or positive vault change", () => {
    expect(() =>
      deriveRepegValues(unit, unit, BigNumber.from(0), unit, unit, unit)
    ).to.throw("strictly positive profit");
    expect(() =>
      deriveRepegValues(unit, unit, unit.mul(2), unit, unit, unit)
    ).to.throw("increases");
  });
  for (const asset of ["OUSD", "OETH", "SuperOETH"])
    it(`sizes and validates ${asset} with correct quote direction and decimals`, async () => {
      const f = fixture(asset);
      await f.run();
      expect(f.plans).to.have.length(1);
      expect(f.plans[0][0].eq(parseEther("200"))).to.equal(true);
      expect(f.sent).to.have.length(0);
      expect(
        f.requests.every((r) => r.params[0].validation === false)
      ).to.equal(true);
      const final =
        f.requests[f.requests.length - 1].params[0].blockStateCalls[0];
      expect(final.calls[1].to).to.equal(addresses.module);
      expect(final).not.to.have.property("stateOverrides");
    });
  it("submits exactly the preflighted module payload", async () => {
    const f = fixture();
    const tx = await f.run({ dryrun: false });
    expect(tx.hash).to.match(/^0x/);
    expect(f.sent).to.have.length(1);
    const final =
      f.requests[f.requests.length - 1].params[0].blockStateCalls[0];
    expect(f.sent[0].data).to.equal(final.calls[1].data);
    expect(f.sent[0].to).to.equal(addresses.module);
  });
  for (const base of [999700, 999701, 999750]) {
    it(`does not trigger at a starting quote of ${base} raw USDC units`, async () => {
      const f = fixture("OUSD", { base });
      await f.run({ dryrun: false });
      expect(f.requests).to.have.length(0);
      expect(f.sent).to.have.length(0);
      expect(
        f.infoMessages.some((message) =>
          message.includes("trigger 0.9997 not breached")
        )
      ).to.equal(true);
      expect(
        f.infoMessages.some((message) =>
          message.includes("already meets 0.9998")
        )
      ).to.equal(false);
    });
  }
  it("triggers one raw USDC unit below the threshold and sizes to the higher target", async () => {
    const f = fixture("OUSD", { base: 999699 });
    await f.run({ dryrun: false });
    expect(f.plans[0][0].eq(parseEther("101"))).to.equal(true);
    expect(f.sent).to.have.length(1);
  });
  for (const rebasedBase of [999700, 999750]) {
    it(`skips when rebase recovers the quote to ${rebasedBase} raw USDC units`, async () => {
      const f = fixture("OUSD", { rebasedBase });
      await f.run({ dryrun: false });
      expect(f.requests).to.have.length(1);
      expect(f.plans).to.have.length(0);
      expect(f.sent).to.have.length(0);
    });
  }
  for (const freshBase of [999700, 999750]) {
    it(`skips when fresh preflight recovers the quote to ${freshBase} raw USDC units`, async () => {
      const f = fixture("OUSD", { freshBase, finalFailure: true });
      await f.run({ dryrun: false });
      expect(f.plans).to.have.length(1);
      expect(f.sent).to.have.length(0);
      expect(f.messages).to.have.length(0);
      expect(
        f.infoMessages.some((message) =>
          message.includes("at or above trigger 0.9997")
        )
      ).to.equal(true);
    });
  }
  it("uses a custom lower trigger for initial gating", async () => {
    const f = fixture("OUSD", { base: 999650 });
    await f.run({ triggerPrice: "0.9996", dryrun: false });
    expect(f.requests).to.have.length(0);
    expect(f.sent).to.have.length(0);
  });
  it("sends when a fresh quote remains one unit below a custom lower trigger", async () => {
    const f = fixture("OUSD", { base: 999590, freshBase: 999599 });
    await f.run({ triggerPrice: "0.9996", dryrun: false });
    expect(f.plans[0][0].eq(parseEther("210"))).to.equal(true);
    expect(f.sent).to.have.length(1);
  });
  it("preserves the custom trigger after a stale nonce recomputation", async () => {
    const f = fixture("OUSD", {
      base: 999590,
      freshBase: 999599,
      moveNonce: true,
    });
    await f.run({ triggerPrice: "0.9996", dryrun: false });
    expect(f.plans).to.have.length(2);
    expect(f.plans[1][5].toString()).to.equal("1");
    expect(f.sent).to.have.length(1);
  });
  it("rechecks the same custom trigger after nonce movement and skips recovered state", async () => {
    const f = fixture("OUSD", {
      base: 999590,
      freshBases: [999599, 999650],
      moveNonce: true,
    });
    await f.run({ triggerPrice: "0.9996", dryrun: false });
    expect(f.plans).to.have.length(2);
    expect(f.messages).to.have.length(1);
    expect(f.sent).to.have.length(0);
    expect(
      f.infoMessages.some((message) =>
        message.includes("at or above trigger 0.9996")
      )
    ).to.equal(true);
  });
  it("applies a custom trigger after simulated rebase", async () => {
    const f = fixture("OUSD", { base: 999590, rebasedBase: 999600 });
    await f.run({ triggerPrice: "0.9996", dryrun: false });
    expect(f.requests).to.have.length(1);
    expect(f.sent).to.have.length(0);
  });
  it("can trigger below the target itself when both prices are equal", async () => {
    const f = fixture("OUSD", { base: 999750 });
    await f.run({ triggerPrice: "0.9998", dryrun: false });
    expect(f.plans[0][0].eq(parseEther("50"))).to.equal(true);
    expect(f.sent).to.have.length(1);
  });
  it("rejects a trigger above the sell target before simulation", async () => {
    const f = fixture();
    await rejects(
      () => f.run({ triggerPrice: "0.9999" }),
      "triggerPrice must not exceed sellPrice"
    );
    expect(f.requests).to.have.length(0);
    expect(f.sent).to.have.length(0);
  });
  it("does nothing when already at target", async () => {
    const f = fixture("OUSD", { base: 999800 });
    await f.run({ dryrun: false });
    expect(f.requests).to.have.length(0);
    expect(f.sent).to.have.length(0);
  });
  it("recomputes once on nonce movement", async () => {
    const f = fixture("OUSD", { moveNonce: true });
    await f.run({ dryrun: false });
    expect(f.plans).to.have.length(2);
    expect(f.plans[1][5].toString()).to.equal("1");
    expect(f.sent).to.have.length(1);
    expect(f.messages).to.have.length(1);
  });
  it("never broadcasts after persistent module failure", async () => {
    const f = fixture("OUSD", { finalFailure: true });
    await rejects(() => f.run({ dryrun: false }), "Module preflight failed");
    expect(f.plans).to.have.length(2);
    expect(f.sent).to.have.length(0);
  });
  it("never broadcasts if moved state misses the target", async () => {
    const f = fixture("OUSD", { finalBelowTarget: true });
    await rejects(() => f.run({ dryrun: false }), "below its target");
    expect(f.sent).to.have.length(0);
  });
  it("rejects an undeployed module before any module ABI reads", async () => {
    const f = fixture("OUSD", { undeployedModule: true });
    try {
      await f.run({ dryrun: false });
      throw new Error("Expected undeployed module rejection");
    } catch (error) {
      expect(error.message).to.equal("Repegging module is not deployed");
    }
    expect(f.moduleReads).to.have.length(0);
    expect(f.requests).to.have.length(0);
    expect(f.sent).to.have.length(0);
  });
  it("fails closed for unsupported RPC simulation", async () => {
    const f = fixture("OUSD", { unsupported: true });
    await rejects(() => f.run(), "unsimulated execution is disabled");
    expect(f.sent).to.have.length(0);
  });
  it("does not treat arbitrary AMO reverts as an overshoot", async () => {
    const f = fixture("OUSD", { burnFailure: "Protocol insolvent" });
    await rejects(() => f.run(), "Protocol insolvent");
    expect(f.plans).to.have.length(0);
  });
  for (const [options, message] of [
    [{ authorized: false }, "operator role"],
    [{ enabled: false }, "not enabled"],
    [{ paused: true }, "rebase is paused"],
  ])
    it(`fails closed: ${message}`, async () => {
      const f = fixture("OUSD", options);
      await rejects(() => f.run(), message);
      expect(f.sent).to.have.length(0);
    });
  it("detects reorganization of the sizing block", async () => {
    const f = fixture("OUSD", { reorg: true });
    await rejects(() => f.run(), "reorganized");
    expect(f.sent).to.have.length(0);
  });
  it("rejects a provider reporting the wrong chain", async () => {
    const f = fixture();
    f.provider.getNetwork = async () => ({ chainId: 8453 });
    await rejects(() => f.run(), "RPC chain");
  });
  it("rejects malformed simulator responses", async () =>
    rejects(
      () =>
        simulateCalls({
          provider: { send: async () => [{ calls: [] }] },
          safeAddress: safe,
          blockTag: "0x1",
          calls: [
            {
              to: addresses.module,
              value: "0",
              data: "0x",
              description: "test",
            },
          ],
        }),
      "returned 0 results"
    ));
  it("encodes the nonce and deadline without floating-point conversions", () => {
    const nonce = BigNumber.from(2).pow(80),
      values = {
        expectedProfit: unit,
        profitVariance: unit.sub(1),
        expectedVaultChange: unit.mul(-10),
        vaultChangeVariance: unit,
      };
    const p = moduleAbi.parseTransaction({
      data: encodeRepeg({ lpTokens: unit, values, nonce, deadline: 10300 }),
    });
    expect(p.args[5].eq(nonce)).to.equal(true);
    expect(p.args[3].isNegative()).to.equal(true);
  });
});
