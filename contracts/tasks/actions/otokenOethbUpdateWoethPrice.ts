import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const WOETH_ON_BASE = "0x80c864704DD06C3693ed5179190786EE38ACf835";
const abi = parseAbi(["function updateWOETHPrice() external"]);

action({
  name: "otokenOethbUpdateWoethPrice",
  description: "Update WOETH price on Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const tx = await signer.sendTransaction({
      to: WOETH_ON_BASE,
      data: encodeFunctionData({ abi, functionName: "updateWOETHPrice" }),
      gasLimit: 200000,
    });
    log.info(`updateWOETHPrice tx: ${tx.hash}`);
    await tx.wait();
  },
});
