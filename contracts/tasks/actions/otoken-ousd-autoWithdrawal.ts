import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const VAULT = "0x90d588fc0eC3DB9c4b417dB4537fE08e063D2ae5";
const abi = parseAbi(["function autoWithdraw() external"]);

action({
  name: "otoken-ousd-autoWithdrawal",
  description: "Auto-process OUSD withdrawals",
  chains: [1],
  run: async ({ signer, log }) => {
    const tx = await signer.sendTransaction({
      to: VAULT,
      data: encodeFunctionData({ abi, functionName: "autoWithdraw" }),
      gasLimit: 4000000,
    });
    log.info(`autoWithdraw tx: ${tx.hash}`);
    await tx.wait();
  },
});
