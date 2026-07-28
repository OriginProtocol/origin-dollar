const { expect } = require("chai");
const { BigNumber, ethers } = require("ethers");

const {
  CHECKER_ABI,
  VAULT_ABI,
  buildBatchCalls,
  calculateDerivedValues,
  getVaultConfig,
  parseMoves,
  resolveCheckerValues,
  runSimulation,
} = require("../../tasks/lib/vaultStrategyMoves");
const {
  findIdenticalProposal,
  signSafeTransactionHash,
  validateNonceSelection,
} = require("../../tasks/lib/safeProposal");

const strategyA = "0x0000000000000000000000000000000000000011";
const strategyB = "0x0000000000000000000000000000000000000022";
const vaultAddress = "0x0000000000000000000000000000000000000033";
const checkerAddress = "0x0000000000000000000000000000000000000044";
const asset = "0x0000000000000000000000000000000000000055";
const oToken = "0x0000000000000000000000000000000000000066";
const safeAddress = "0x0000000000000000000000000000000000000077";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };
const { defaultAbiCoder } = ethers.utils;

const ok = (returnData = "0x") => ({
  status: "0x1",
  returnData,
  gasUsed: "0x5208",
});
const reverted = (reason) => ({
  status: "0x0",
  gasUsed: "0x5208",
  returnData: `0x08c379a0${defaultAbiCoder
    .encode(["string"], [reason])
    .slice(2)}`,
});
const uint = (value) => defaultAbiCoder.encode(["uint256"], [value]);
const snapshotOf = (vaultValue, totalSupply) =>
  defaultAbiCoder.encode(
    ["uint256", "uint256", "uint256"],
    [vaultValue, totalSupply, 1]
  );

// Each entry is one eth_simulateV1 response: either the array of per-call
// results, or a function that throws to model an RPC-level failure.
const stubProvider = (responses) => {
  const requests = [];
  return {
    requests,
    send: async (method, params) => {
      requests.push({ method, params });
      const next = responses.shift();
      if (typeof next === "function") return next();
      return [{ calls: next }];
    },
  };
};

const oneMove = [
  {
    kind: "withdraw",
    strategyIdentifier: "StrategyA",
    strategy: strategyA,
    amount: "3",
    amountUnits: ethers.utils.parseUnits("3", 6),
  },
];

const simulationArgs = (provider) => ({
  config: getVaultConfig("OUSD", 1),
  provider,
  blockNumber: 123,
  safeAddress,
  vaultAddress,
  checkerAddress,
  asset,
  oToken,
  moves: oneMove,
  log: silentLog,
});

describe("Talos vault strategy moves", () => {
  it("parses mixed movements without changing their order", () => {
    expect(
      parseMoves(
        "withdraw:StrategyA:5.25;deposit:StrategyB:2;withdrawAll:StrategyA"
      )
    ).to.deep.equal([
      {
        kind: "withdraw",
        strategyIdentifier: "StrategyA",
        amount: "5.25",
      },
      {
        kind: "deposit",
        strategyIdentifier: "StrategyB",
        amount: "2",
      },
      { kind: "withdrawAll", strategyIdentifier: "StrategyA" },
    ]);
  });

  for (const moves of [
    "deposit:StrategyA:0",
    "withdraw:StrategyA:-1",
    "deposit:StrategyA:1e6",
    "withdrawAll:StrategyA:1",
    "unknown:StrategyA:1",
    "deposit::1",
  ]) {
    it(`rejects invalid movement syntax: ${moves}`, () => {
      expect(() => parseMoves(moves)).to.throw();
    });
  }

  it("enforces vault and chain combinations", () => {
    expect(getVaultConfig("ousd", 1).vaultDeployment).to.equal("VaultProxy");
    expect(getVaultConfig("SuperOETH", 8453).vaultDeployment).to.equal(
      "OETHBaseVaultProxy"
    );
    expect(() => getVaultConfig("SuperOETH", 1)).to.throw(
      "expected chain 8453"
    );
  });

  it("derives signed vault change, supply change, and profit", () => {
    const values = calculateDerivedValues(
      BigNumber.from(1000),
      BigNumber.from(900),
      BigNumber.from(800),
      BigNumber.from(950)
    );
    expect(values.vaultChange.toString()).to.equal("-200");
    expect(values.supplyChange.toString()).to.equal("50");
    expect(values.profit.toString()).to.equal("-250");
  });

  it("uses derived expected values and OUSD variance defaults", () => {
    const values = resolveCheckerValues({
      config: getVaultConfig("OUSD", 1),
      derived: {
        profit: ethers.utils.parseUnits("-7", 18),
        vaultChange: ethers.utils.parseUnits("20", 18),
        supplyChange: ethers.utils.parseUnits("27", 18),
      },
      skipFork: false,
    });
    expect(ethers.utils.formatUnits(values.expectedProfit, 18)).to.equal(
      "-7.0"
    );
    expect(ethers.utils.formatUnits(values.expectedVaultChange, 18)).to.equal(
      "20.0"
    );
    expect(ethers.utils.formatUnits(values.profitVariance, 18)).to.equal(
      "100.0"
    );
    expect(ethers.utils.formatUnits(values.vaultChangeVariance, 18)).to.equal(
      "100.0"
    );
  });

  it("uses SuperOETH variance defaults and independent expected overrides", () => {
    const values = resolveCheckerValues({
      config: getVaultConfig("SuperOETH", 8453),
      derived: {
        profit: BigNumber.from(1),
        vaultChange: BigNumber.from(2),
        supplyChange: BigNumber.from(1),
      },
      expectedProfit: "3.5",
      skipFork: false,
    });
    expect(ethers.utils.formatUnits(values.expectedProfit, 18)).to.equal("3.5");
    expect(values.expectedVaultChange.toString()).to.equal("2");
    expect(ethers.utils.formatUnits(values.profitVariance, 18)).to.equal("1.0");
    expect(ethers.utils.formatUnits(values.vaultChangeVariance, 18)).to.equal(
      "10.0"
    );
  });

  it("requires both expected values when the fork is skipped", () => {
    const config = getVaultConfig("OETH", 1);
    expect(() =>
      resolveCheckerValues({ config, expectedProfit: "0", skipFork: true })
    ).to.throw("--expected-vault-change is required");
    expect(() =>
      resolveCheckerValues({
        config,
        expectedVaultChange: "0",
        skipFork: true,
      })
    ).to.throw("--expected-profit is required");

    const values = resolveCheckerValues({
      config,
      expectedProfit: "0",
      expectedVaultChange: "0",
      skipFork: true,
    });
    expect(values.expectedProfit.isZero()).to.equal(true);
    expect(values.expectedVaultChange.isZero()).to.equal(true);
  });

  it("builds rebase, snapshot, ordered moves, and checkDelta", () => {
    const checkerValues = resolveCheckerValues({
      config: getVaultConfig("OETH", 1),
      expectedProfit: "0",
      expectedVaultChange: "0",
      skipFork: true,
    });
    const calls = buildBatchCalls({
      vaultAddress,
      checkerAddress,
      asset,
      moves: [
        {
          kind: "withdraw",
          strategyIdentifier: "StrategyA",
          strategy: strategyA,
          amount: "3",
          amountUnits: ethers.utils.parseEther("3"),
        },
        {
          kind: "deposit",
          strategyIdentifier: "StrategyB",
          strategy: strategyB,
          amount: "2",
          amountUnits: ethers.utils.parseEther("2"),
        },
        {
          kind: "withdrawAll",
          strategyIdentifier: "StrategyA",
          strategy: strategyA,
        },
      ],
      checkerValues,
    });
    expect(calls.map((call) => call.description)).to.deep.equal([
      "vault.rebase()",
      "valueChecker.takeSnapshot()",
      "withdraw:StrategyA:3",
      "deposit:StrategyB:2",
      "withdrawAll:StrategyA",
      "valueChecker.checkDelta(...)",
    ]);

    const vaultInterface = new ethers.utils.Interface(VAULT_ABI);
    const checkerInterface = new ethers.utils.Interface(CHECKER_ABI);
    expect(
      vaultInterface.parseTransaction({ data: calls[0].data }).name
    ).to.equal("rebase");
    expect(
      checkerInterface.parseTransaction({ data: calls[1].data }).name
    ).to.equal("takeSnapshot");
    expect(
      vaultInterface.parseTransaction({ data: calls[2].data }).name
    ).to.equal("withdrawFromStrategy");
    expect(
      vaultInterface.parseTransaction({ data: calls[3].data }).name
    ).to.equal("depositToStrategy");
    expect(
      vaultInterface.parseTransaction({ data: calls[4].data }).name
    ).to.equal("withdrawAllFromStrategy");
    expect(
      checkerInterface.parseTransaction({ data: calls[5].data }).name
    ).to.equal("checkDelta");
  });

  it("finds an identical unexecuted same-nonce proposal", () => {
    const transaction = {
      data: {
        to: vaultAddress,
        value: "0",
        data: "0x1234",
        operation: 1,
      },
    };
    const existing = [
      {
        to: vaultAddress,
        value: "0",
        data: "0x1234",
        operation: 1,
        isExecuted: false,
        safeTxHash: "0xabc",
      },
    ];
    expect(findIdenticalProposal(existing, transaction).safeTxHash).to.equal(
      "0xabc"
    );
    existing[0].isExecuted = true;
    expect(findIdenticalProposal(existing, transaction)).to.equal(undefined);
  });

  it("defaults to the next Safe nonce and permits an unexecuted replacement", () => {
    const warnings = [];
    const log = { warn: (message) => warnings.push(message) };
    expect(
      validateNonceSelection({
        onchainNonce: 10,
        nextAvailableNonce: 12,
        existing: [],
        log,
      }).nonce
    ).to.equal(12);

    const replacement = validateNonceSelection({
      requestedNonce: 10,
      onchainNonce: 10,
      nextAvailableNonce: 12,
      existing: [{ nonce: "10", isExecuted: false, safeTxHash: "0xpending" }],
      log,
    });
    expect(replacement.nonce).to.equal(10);
    expect(replacement.existing).to.have.length(1);
    expect(warnings[0]).to.contain("0xpending");
  });

  it("rejects consumed or explicitly executed Safe nonces", () => {
    const log = { warn: () => undefined };
    expect(() =>
      validateNonceSelection({
        requestedNonce: 9,
        onchainNonce: 10,
        nextAvailableNonce: 12,
        existing: [],
        log,
      })
    ).to.throw("already been consumed");
    expect(() =>
      validateNonceSelection({
        requestedNonce: 10,
        onchainNonce: 10,
        nextAvailableNonce: 12,
        existing: [
          {
            nonce: "10",
            isExecuted: true,
            safeTxHash: "0xexecuted",
            transactionHash: "0xonchain",
          },
        ],
        log,
      })
    ).to.throw("already executed in 0xonchain");
  });

  it("derives checker values from the simulation and pins both passes to one block", async () => {
    const provider = stubProvider([
      // derive pass: rebase, takeSnapshot, snapshots, move, totalValue, totalSupply
      [
        ok(),
        ok(),
        ok(
          snapshotOf(
            ethers.utils.parseUnits("1000", 18),
            ethers.utils.parseUnits("990", 18)
          )
        ),
        ok(),
        ok(uint(ethers.utils.parseUnits("1002", 18))),
        ok(uint(ethers.utils.parseUnits("990", 18))),
      ],
      // validation pass: rebase, takeSnapshot, move, checkDelta
      [ok(), ok(), ok(), ok()],
    ]);

    const { derived, checkerValues } = await runSimulation(
      simulationArgs(provider)
    );

    expect(ethers.utils.formatUnits(derived.vaultChange, 18)).to.equal("2.0");
    expect(derived.supplyChange.isZero()).to.equal(true);
    expect(ethers.utils.formatUnits(derived.profit, 18)).to.equal("2.0");
    expect(ethers.utils.formatUnits(checkerValues.expectedProfit, 18)).to.equal(
      "2.0"
    );

    expect(provider.requests).to.have.length(2);
    provider.requests.forEach((request) => {
      expect(request.method).to.equal("eth_simulateV1");
      expect(request.params[1]).to.equal("0x7b");
      expect(request.params[0].validation).to.equal(false);
      expect(
        request.params[0].blockStateCalls[0].calls.every(
          (call) => call.from === safeAddress
        )
      ).to.equal(true);
    });
  });

  it("attributes a reverted simulation step to its batch description", async () => {
    const provider = stubProvider([
      [
        ok(),
        ok(),
        ok(snapshotOf(1, 1)),
        reverted("Not enough assets available"),
        ok(uint(1)),
        ok(uint(1)),
      ],
    ]);

    let error;
    try {
      await runSimulation(simulationArgs(provider));
    } catch (err) {
      error = err;
    }
    expect(error, "expected the simulation to throw").to.not.equal(undefined);
    expect(error.message).to.contain("step 4 of 6");
    expect(error.message).to.contain("withdraw:StrategyA:3");
    expect(error.message).to.contain("Not enough assets available");
  });

  it("explains how to proceed when the RPC cannot simulate", async () => {
    const provider = stubProvider([
      () => {
        const err = new Error("the method eth_simulateV1 does not exist");
        err.error = { code: -32601, message: "Method not found" };
        throw err;
      },
    ]);

    let error;
    try {
      await runSimulation(simulationArgs(provider));
    } catch (err) {
      error = err;
    }
    expect(error, "expected the simulation to throw").to.not.equal(undefined);
    expect(error.message).to.contain("does not support eth_simulateV1");
    expect(error.message).to.contain("--skip-fork");
    expect(error.message).to.contain("--expected-profit");
  });

  it("normalizes an ethers signMessage signature for Safe eth_sign", async () => {
    const wallet = ethers.Wallet.createRandom();
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("safe hash"));
    const signature = await signSafeTransactionHash(wallet, hash);
    const safeV = Number(`0x${signature.slice(-2)}`);
    expect([31, 32]).to.include(safeV);

    const ethersSignature = `${signature.slice(0, -2)}${(safeV - 4)
      .toString(16)
      .padStart(2, "0")}`;
    expect(
      ethers.utils.verifyMessage(ethers.utils.arrayify(hash), ethersSignature)
    ).to.equal(wallet.address);
  });
});
