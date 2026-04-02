import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const CROSS_CHAIN_CONTROLLER = "0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e";
const abi = parseAbi(["function sendBalanceUpdate() external"]);

action({
  name: "hyperevm-crossChainBalanceUpdate",
  description: "Send cross-chain balance update from HyperEVM",
  chains: [999],
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
