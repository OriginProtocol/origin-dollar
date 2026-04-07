import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const HARVESTER = "0x0CbEAcf86232fC04050cD679d860516F7254c22E";
const STRATEGIES = [
  "0x9cfcaf81600155e01c63e4d2993a8a81a8205829",
  "0xf611cc500eee7e4e4763a05fe623e2363c86d2af",
] as const;

const abi = parseAbi([
  "function harvestAndTransfer(address[] strategies) external",
]);

action({
  name: "otokenOethbHarvest",
  description: "Harvest strategies on Base OETHb",
  chains: [8453],
  run: async ({ signer, log }) => {
    const tx = await signer.sendTransaction({
      to: HARVESTER,
      data: encodeFunctionData({
        abi,
        functionName: "harvestAndTransfer",
        args: [[...STRATEGIES]],
      }),
      gasLimit: 800000,
    });
    log.info(`harvestAndTransfer tx: ${tx.hash}`);
    await tx.wait();
  },
});
