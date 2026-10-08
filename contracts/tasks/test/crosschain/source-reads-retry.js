const { expect } = require("chai");
const { ethers } = require("ethers");

const {
  withRetry,
  fetchTxHashesFromCctpTransactions,
} = require("../../../tasks/crossChain");

// The relay actions scan the source chain with eth_blockNumber + eth_getLogs
// over a bare ethers JsonRpcProvider. The load-balanced providers behind it
// return transient errors (dRPC 500 "Temporary internal error", 408 timeouts,
// 400 "Unknown block" from a node behind the tip), so those reads retry.
describe("Unit: CCTP relay source-chain read retries", () => {
  describe("withRetry", () => {
    it("returns the result once the call succeeds", async () => {
      let calls = 0;
      const result = await withRetry(
        async () => {
          calls += 1;
          if (calls < 3) throw new Error("Temporary internal error");
          return "ok";
        },
        { label: "test", attempts: 5, baseDelayMs: 1 }
      );
      expect(result).to.equal("ok");
      expect(calls).to.equal(3);
    });

    it("rethrows the last error after the final attempt", async () => {
      let calls = 0;
      let thrown;
      try {
        await withRetry(
          async () => {
            calls += 1;
            throw new Error(`fail ${calls}`);
          },
          { label: "test", attempts: 3, baseDelayMs: 1 }
        );
      } catch (error) {
        thrown = error;
      }
      expect(thrown.message).to.equal("fail 3");
      expect(calls).to.equal(3);
    });
  });

  describe("fetchTxHashesFromCctpTransactions", () => {
    const address = "0x0000000000000000000000000000000000000001";
    const config = {
      cctpIntegrationContractSource: {
        address,
        interface: new ethers.utils.Interface([
          "event TokensBridged(uint256 amount)",
          "event MessageTransmitted(bytes message)",
        ]),
      },
    };
    const latestBlock = 45411379;
    const blockLookback = 10000;
    const txHash = `0x${"ab".repeat(32)}`;

    // eth_blockNumber answered from one node, the first eth_getLogs routed to a
    // node that has not seen that block yet (dRPC "Unknown block"), then fine.
    it("recovers from a transient eth_getLogs error and scans the full range", async () => {
      const getLogsCalls = [];
      const provider = {
        getBlockNumber: async () => latestBlock,
        getLogs: async (filter) => {
          getLogsCalls.push(filter);
          if (getLogsCalls.length === 1) {
            throw new Error("bad response (status=400, body=Unknown block)");
          }
          return [{ transactionHash: txHash }];
        },
      };

      const { allTxHashes } = await fetchTxHashesFromCctpTransactions({
        config,
        blockLookback,
        sourceChainProvider: provider,
      });

      expect(allTxHashes).to.deep.equal([txHash]);
      // 2 events, +1 retried call
      expect(getLogsCalls).to.have.length(3);
      for (const filter of getLogsCalls) {
        expect(filter.address).to.equal(address);
        expect(filter.fromBlock).to.equal(latestBlock - blockLookback);
        expect(filter.toBlock).to.equal(latestBlock);
      }
    }).timeout(5000);
  });
});
