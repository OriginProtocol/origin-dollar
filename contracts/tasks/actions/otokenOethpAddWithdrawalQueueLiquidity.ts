import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const VAULT = "0xc8c8F8bEA5631A8AF26440AF32a55002138cB76a";
const abi = parseAbi(["function addWithdrawalQueueLiquidity() external"]);

action({
  name: "otokenOethpAddWithdrawalQueueLiquidity",
  description: "Add liquidity to Plume OETH withdrawal queue",
  chains: [1],
  run: async ({ signer, log }) => {
    const tx = await signer.sendTransaction({
      to: VAULT,
      data: encodeFunctionData({
        abi,
        functionName: "addWithdrawalQueueLiquidity",
      }),
      gasLimit: 400000,
    });
    log.info(`addWithdrawalQueueLiquidity tx: ${tx.hash}`);
    await tx.wait();
  },
});
