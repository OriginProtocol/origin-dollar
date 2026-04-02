import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const VAULT = "0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93";
const abi = parseAbi(["function rebase() external"]);

action({
  name: "otoken-oethb-rebase",
  description: "Rebase OETHb vault on Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const tx = await signer.sendTransaction({
      to: VAULT,
      data: encodeFunctionData({ abi, functionName: "rebase" }),
      gasLimit: 300000,
    });
    log.info(`rebase tx: ${tx.hash}`);
    await tx.wait();
  },
});
