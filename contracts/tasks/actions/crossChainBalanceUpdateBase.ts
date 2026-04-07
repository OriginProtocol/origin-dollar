import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const CROSS_CHAIN_CONTROLLER = "0xB1d624fc40824683e2bFBEfd19eB208DbBE00866";
const abi = parseAbi(["function sendBalanceUpdate() external"]);

action({
  name: "crossChainBalanceUpdateBase",
  description: "Send cross-chain balance update from Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const tx = await signer.sendTransaction({
      to: CROSS_CHAIN_CONTROLLER,
      data: encodeFunctionData({ abi, functionName: "sendBalanceUpdate" }),
      gasLimit: 1000000,
    });
    log.info(`sendBalanceUpdate tx: ${tx.hash}`);
    await tx.wait();
  },
});
