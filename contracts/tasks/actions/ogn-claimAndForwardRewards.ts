import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const MODULE_ADDRESSES = [
  "0x15228dAE3B228175fBD9639d049265eFb08e60b6",
  "0x8e32A930CcFE108DC560eC9e630BA6b5f7E179c9",
  "0x460e4a0B14bD3F1e12f0c2194830c0204E5Bb147",
  "0xFbBb82c4F3B6f479DE1451C04A76ea80da4ff010",
  "0xAE67b612bD859378b7d0f6314E7Ee39ad4c6aBE6",
  "0x046750A8106461d9826a8Ab32890B23753A5245e",
] as const;

const abi = parseAbi(["function claimAndForward() external"]);

action({
  name: "ogn-claimAndForwardRewards",
  description: "Claim and forward OGN rewards from all modules",
  chains: [1],
  run: async ({ signer, log }) => {
    for (const moduleAddress of MODULE_ADDRESSES) {
      log.info(`Calling claimAndForward on ${moduleAddress}`);
      const tx = await signer.sendTransaction({
        to: moduleAddress,
        data: encodeFunctionData({ abi, functionName: "claimAndForward" }),
        gasLimit: 500000,
      });
      log.info(`claimAndForward tx: ${tx.hash}`);
      await tx.wait();
    }
  },
});
