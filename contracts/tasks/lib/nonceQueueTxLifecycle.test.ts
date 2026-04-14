import { BigNumber } from "ethers";

import { submitNonceQueuedTransaction } from "./nonceQueueTxLifecycle";

type EnvOverrides = Record<string, string | undefined>;

function makeResponse(hash: string, raw?: string): any {
  return {
    hash,
    raw,
    rawTransaction: raw,
    wait: async () => ({ status: 1, transactionHash: hash }),
  };
}

async function withEnv<T>(overrides: EnvOverrides, fn: () => Promise<T>) {
  const previousValues: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previousValues[key] = process.env[key];
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function testReplacementPath() {
  console.log("--- Lifecycle Test 1: Replacement path fee bump ---");

  const sentTxs: any[] = [];
  let sendCount = 0;
  const signerSendTransaction = async (tx: any) => {
    sentTxs.push(tx);
    if (sendCount === 0) {
      sendCount++;
      return makeResponse("0xinitial", "0xraw-initial");
    }
    sendCount++;
    return makeResponse("0xreplacement", "0xraw-replacement");
  };

  let receiptChecks = 0;
  const provider: any = {
    async getTransactionReceipt(hash: string) {
      receiptChecks++;
      if (hash === "0xreplacement" && receiptChecks >= 4) {
        return { status: 1, transactionHash: "0xreplacement" };
      }
      return null;
    },
    async getFeeData() {
      return {
        maxFeePerGas: BigNumber.from(400),
        maxPriorityFeePerGas: BigNumber.from(5),
      };
    },
    async sendTransaction() {
      throw new Error("rebroadcast disabled in this test");
    },
  };

  const result = await withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "20",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "1",
      NONCE_QUEUE_MAX_REPLACEMENTS: "2",
      NONCE_QUEUE_FEE_BUMP_PCT: "20",
    },
    () =>
      submitNonceQueuedTransaction({
        sendTransaction: signerSendTransaction as any,
        provider,
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
          maxFeePerGas: BigNumber.from(100),
          maxPriorityFeePerGas: BigNumber.from(2),
        } as any,
        nonce: 7,
        signerAddress: "0xaaaa",
        chainId: 1,
      })
  );

  if (result.hash !== "0xreplacement") {
    throw new Error(`Expected replacement hash, got ${result.hash}`);
  }
  if (sentTxs.length < 2) {
    throw new Error(`Expected at least 2 submissions, got ${sentTxs.length}`);
  }
  if (sentTxs[1].nonce !== 7) {
    throw new Error(`Expected replacement nonce=7, got ${sentTxs[1].nonce}`);
  }
  if (!BigNumber.from(sentTxs[1].maxFeePerGas).gt(sentTxs[0].maxFeePerGas)) {
    throw new Error("Expected replacement maxFeePerGas to increase");
  }
  if (
    !BigNumber.from(sentTxs[1].maxPriorityFeePerGas).gte(
      sentTxs[0].maxPriorityFeePerGas
    )
  ) {
    throw new Error("Expected replacement maxPriorityFeePerGas to increase");
  }

  console.log("PASS: replacement submitted with same nonce and higher fees\n");
}

async function testTimeoutPath() {
  console.log("--- Lifecycle Test 2: Confirmation timeout path ---");

  const signerSendTransaction = async () => makeResponse("0xtimeout");
  const provider: any = {
    async getTransactionReceipt() {
      return null;
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction() {
      return makeResponse("0xnever");
    },
  };

  let timeoutError: Error | undefined;
  await withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "2",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    async () => {
      try {
        await submitNonceQueuedTransaction({
          sendTransaction: signerSendTransaction as any,
          provider,
          transaction: {
            to: "0x0000000000000000000000000000000000000001",
            data: "0x",
          } as any,
          nonce: 11,
          signerAddress: "0xbbbb",
          chainId: 1,
        });
      } catch (err: any) {
        timeoutError = err;
      }
    }
  );

  if (!timeoutError) {
    throw new Error("Expected timeout error but transaction did not fail");
  }
  if (!timeoutError.message.includes("after 2s")) {
    throw new Error(`Unexpected timeout error message: ${timeoutError.message}`);
  }

  console.log("PASS: confirmation timeout errors as expected\n");
}

async function testRebroadcastPath() {
  console.log("--- Lifecycle Test 3: Rebroadcast duplicate handling ---");

  const signerSendTransaction = async () =>
    makeResponse("0xrebroadcast", "0xraw-rebroadcast");

  let rebroadcastAttempts = 0;
  let receiptChecks = 0;
  const provider: any = {
    async getTransactionReceipt(hash: string) {
      receiptChecks++;
      if (hash === "0xrebroadcast" && receiptChecks >= 3) {
        return { status: 1, transactionHash: "0xrebroadcast" };
      }
      return null;
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction() {
      rebroadcastAttempts++;
      throw new Error("already known");
    },
  };

  const result = await withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "10",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "1",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    () =>
      submitNonceQueuedTransaction({
        sendTransaction: signerSendTransaction as any,
        provider,
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
        } as any,
        nonce: 12,
        signerAddress: "0xcccc",
        chainId: 1,
      })
  );

  if (result.hash !== "0xrebroadcast") {
    throw new Error(`Expected original hash, got ${result.hash}`);
  }
  if (rebroadcastAttempts < 1) {
    throw new Error("Expected at least one rebroadcast attempt");
  }

  console.log("PASS: rebroadcast duplicate errors are handled\n");
}

async function test() {
  await testReplacementPath();
  await testTimeoutPath();
  await testRebroadcastPath();
  console.log("All nonceQueueTxLifecycle tests passed!");
}

test().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
