const { expect } = require("chai");

const {
  findLatestLog,
  isRangeLimitError,
  isTransientLogError,
  MAX_LOG_CHUNK,
} = require("../lib/logs");

// The three errors dRPC returned to ousdUsdeV4Rebalance in Oct 2026, shaped
// like ethers v5 wraps them.
const rpcError = (message, code) => {
  const err = new Error(
    `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":42,\\"error\\":{\\"code\\":${code},\\"message\\":\\"${message}\\"}}", code=SERVER_ERROR)`
  );
  err.code = "SERVER_ERROR";
  err.error = { code, message };
  return err;
};
const temporary = () => rpcError("Temporary internal error. Please retry", 19);
const rangeLimit = () =>
  rpcError(
    "query block range exceeds server limit, narrow your filter: 10000",
    -32602
  );
const beyondHead = () =>
  rpcError("block range extends beyond current head block", -32000);

// A fake getLogs: `events` maps block -> log; `failures` is consumed one
// error per call; `maxRange` rejects wider queries like a capped upstream.
function fakeQuery({ events = {}, failures = [], maxRange = Infinity } = {}) {
  const calls = [];
  const query = async (from, to) => {
    calls.push([from, to]);
    if (failures.length > 0) throw failures.shift()();
    if (to - from + 1 > maxRange) throw rangeLimit();
    return Object.keys(events)
      .map(Number)
      .filter((b) => b >= from && b <= to)
      .sort((a, b) => a - b)
      .map((b) => ({ blockNumber: b, minted: events[b] }));
  };
  return { query, calls };
}

const noSleep = async () => {};

describe("Unit: findLatestLog", () => {
  it("classifies the dRPC errors", () => {
    expect(isTransientLogError(temporary())).to.equal(true);
    expect(isRangeLimitError(temporary())).to.equal(false);
    expect(isRangeLimitError(rangeLimit())).to.equal(true);
    expect(isRangeLimitError(beyondHead())).to.equal(false);
    expect(isTransientLogError(beyondHead())).to.equal(true);
    expect(isTransientLogError(new Error("execution reverted"))).to.equal(
      false
    );
  });

  it("caps chunks so every query spans at most 10000 blocks", async () => {
    const { query, calls } = fakeQuery();
    const found = await findLatestLog({
      query,
      latest: 1000000,
      floor: 950000,
      chunk: 50000,
      sleep: noSleep,
    });
    expect(found).to.equal(undefined);
    expect(MAX_LOG_CHUNK).to.equal(9999);
    for (const [from, to] of calls) expect(to - from + 1).to.be.at.most(10000);
    // Contiguous, newest first, down to the floor.
    expect(calls[0]).to.deep.equal([999996, 1000000]);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i][1]).to.equal(calls[i - 1][0] - 1);
    }
    expect(calls[calls.length - 1][0]).to.equal(950000);
  });

  it("queries the head on its own and still finds an event there", async () => {
    const { query, calls } = fakeQuery({
      events: { 900000: BigInt(1), 999999: BigInt(2) },
    });
    const found = await findLatestLog({
      query,
      latest: 1000000,
      floor: 500000,
      sleep: noSleep,
    });
    expect(found.minted).to.equal(BigInt(2));
    expect(calls).to.deep.equal([[999996, 1000000]]);
  });

  it("returns the newest event of the first non-empty chunk", async () => {
    const { query } = fakeQuery({
      events: { 980000: BigInt(1), 985000: BigInt(2), 900000: BigInt(0) },
    });
    const found = await findLatestLog({
      query,
      latest: 1000000,
      floor: 500000,
      sleep: noSleep,
    });
    expect(found).to.deep.equal({ blockNumber: 985000, minted: BigInt(2) });
  });

  it("retries a transient error, then succeeds", async () => {
    const { query, calls } = fakeQuery({
      events: { 990000: BigInt(7) },
      failures: [temporary, beyondHead],
    });
    const waits = [];
    const found = await findLatestLog({
      query,
      latest: 1000000,
      floor: 500000,
      backoffMs: 100,
      sleep: async (ms) => waits.push(ms),
    });
    expect(found.minted).to.equal(BigInt(7));
    expect(waits).to.deep.equal([100, 200]);
    // Same head range three times, then the next chunk.
    expect(calls.slice(0, 3)).to.deep.equal([
      [999996, 1000000],
      [999996, 1000000],
      [999996, 1000000],
    ]);
  });

  it("halves the chunk on a range-limit error", async () => {
    const { query, calls } = fakeQuery({
      events: { 970000: BigInt(3) },
      maxRange: 2000,
    });
    const found = await findLatestLog({
      query,
      latest: 1000000,
      floor: 500000,
      attempts: 1,
      sleep: noSleep,
    });
    expect(found.minted).to.equal(BigInt(3));
    // 9999 -> 4999 -> 2499 -> 1249 blocks, all from the same `to`.
    expect(calls.slice(1, 5)).to.deep.equal([
      [989997, 999995],
      [994997, 999995],
      [997497, 999995],
      [998747, 999995],
    ]);
    for (const [from, to] of calls.slice(4)) {
      expect(to - from + 1).to.be.at.most(1249);
    }
  });

  it("throws once the retries are exhausted", async () => {
    const { query, calls } = fakeQuery({
      failures: [temporary, temporary, temporary, temporary],
    });
    let err;
    try {
      await findLatestLog({
        query,
        latest: 1000000,
        floor: 500000,
        attempts: 3,
        sleep: noSleep,
      });
    } catch (e) {
      err = e;
    }
    expect(err).to.be.an("error");
    expect(err.message).to.contain("Temporary internal error");
    expect(calls).to.have.length(3);
  });

  it("does not retry a non-transient error", async () => {
    const { query, calls } = fakeQuery({
      failures: [() => new Error("execution reverted")],
    });
    let err;
    try {
      await findLatestLog({
        query,
        latest: 1000000,
        floor: 500000,
        sleep: noSleep,
      });
    } catch (e) {
      err = e;
    }
    expect(err.message).to.equal("execution reverted");
    expect(calls).to.have.length(1);
  });
});
