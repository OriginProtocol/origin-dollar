const { expect } = require("chai");

const governancePath = require.resolve("../governance");
const dependencyPaths = {
  taskHelpers: require.resolve("../../utils/hardhat-task-helpers"),
  signers: require.resolve("../../utils/signers"),
  time: require.resolve("../../utils/time.js"),
  tx: require.resolve("../../utils/tx"),
};

function loadGovernance(mocks) {
  const saved = new Map();

  for (const [name, modulePath] of Object.entries(dependencyPaths)) {
    saved.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports: mocks[name] || {},
    };
  }

  delete require.cache[governancePath];
  const governance = require(governancePath);

  return {
    governance,
    restore() {
      delete require.cache[governancePath];
      for (const [modulePath, cachedModule] of saved.entries()) {
        if (cachedModule) require.cache[modulePath] = cachedModule;
        else delete require.cache[modulePath];
      }
    },
  };
}

const confirmedTx = (receipts) => ({
  wait: async () => {
    receipts.push(true);
    return { status: 1 };
  },
});

describe("Governance tasks", () => {
  let originalGetNamedAccounts;
  let originalConsoleLog;

  beforeEach(() => {
    originalGetNamedAccounts = global.getNamedAccounts;
    originalConsoleLog = console.log;
    console.log = () => {};
  });

  afterEach(() => {
    global.getNamedAccounts = originalGetNamedAccounts;
    console.log = originalConsoleLog;
  });

  it("executes an already queued local proposal as the governor", async () => {
    const receipts = [];
    const governorSigner = { address: "governor" };
    const guardianSigner = { address: "guardian" };
    const executeCalls = [];
    const states = [1, 2];
    const governor = {
      address: "0x0000000000000000000000000000000000000001",
      state: async () => states.shift(),
      getActions: async () => [[], [], [], []],
      connect: (signer) => ({
        execute: async (proposalId) => {
          executeCalls.push({ proposalId, signer });
          return confirmedTx(receipts);
        },
      }),
    };
    const hre = {
      ethers: {
        provider: {
          getSigner: (address) =>
            address === "governor" ? governorSigner : guardianSigner,
        },
        getContract: async () => governor,
      },
    };
    global.getNamedAccounts = async () => ({
      governorAddr: "governor",
      guardianAddr: "guardian",
    });

    const loaded = loadGovernance({
      taskHelpers: { isFork: false, isMainnet: false },
    });
    try {
      await loaded.governance.execute({ id: "42" }, hre);
    } finally {
      loaded.restore();
    }

    expect(executeCalls).to.deep.equal([
      { proposalId: "42", signer: governorSigner },
    ]);
    expect(receipts).to.have.length(0);
  });

  it("queues and executes a fork proposal with an impersonated guardian", async () => {
    const guardian = { address: "guardian" };
    const impersonated = [];
    const txOptsCalls = [];
    const rpcCalls = [];
    const queueCalls = [];
    const executeCalls = [];
    const receipts = [];
    const governor = {
      connect: (signer) => ({
        queue: async (proposalId, txOpts) => {
          queueCalls.push({ proposalId, signer, txOpts });
          return confirmedTx(receipts);
        },
        execute: async (proposalId, txOpts) => {
          executeCalls.push({ proposalId, signer, txOpts });
          return confirmedTx(receipts);
        },
      }),
    };
    const hre = {
      getNamedAccounts: async () => ({ guardianAddr: "guardian" }),
      ethers: {
        provider: { getSigner: () => guardian },
        getContract: async () => governor,
      },
      network: {
        provider: {
          send: async (method, params) => rpcCalls.push({ method, params }),
        },
      },
    };

    const loaded = loadGovernance({
      taskHelpers: { isFork: true, isMainnet: false },
      signers: {
        impersonateAndFund: async (address) => impersonated.push(address),
      },
      tx: {
        getTxOpts: async (gasLimit) => {
          txOptsCalls.push(gasLimit);
          return gasLimit ? { gasLimit } : {};
        },
      },
    });
    try {
      await loaded.governance.executeOnFork(
        { id: "42", gaslimit: "500000" },
        hre
      );
    } finally {
      loaded.restore();
    }

    expect(impersonated).to.deep.equal(["guardian"]);
    expect(txOptsCalls).to.deep.equal([undefined, 500000]);
    expect(queueCalls).to.deep.equal([
      { proposalId: 42, signer: guardian, txOpts: {} },
    ]);
    expect(executeCalls).to.deep.equal([
      { proposalId: 42, signer: guardian, txOpts: { gasLimit: 500000 } },
    ]);
    expect(rpcCalls).to.deep.equal([
      { method: "evm_increaseTime", params: [259200] },
      { method: "evm_mine", params: undefined },
    ]);
    expect(receipts).to.have.length(2);
  });
});
