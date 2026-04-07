import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const OS_VAULT = "0xa3c0eca00d2b76b4d1f170b0ab3fdea16c180186";
const OS_HARVESTER = "0x7B0383b31C7662E3f6B6E9C743Bc87b93C1f4498";
const SONIC_STAKING_STRATEGY = "0xbe19cc5654e30daf04ad3b5e06213d70f4e882ee";

const vaultAbi = parseAbi(["function rebase() external"]);
const harvesterAbi = parseAbi([
  "function harvestAndTransfer(address strategy) external",
]);

action({
  name: "otokenOsCollectAndRelease",
  description: "Rebase OS vault and harvest on Sonic",
  chains: [146],
  run: async ({ signer, log }) => {
    // Rebase the vault
    const rebaseTx = await signer.sendTransaction({
      to: OS_VAULT,
      data: encodeFunctionData({ abi: vaultAbi, functionName: "rebase" }),
      gasLimit: 400000,
    });
    log.info(`rebase tx: ${rebaseTx.hash}`);
    await rebaseTx.wait();

    // Harvest and transfer
    const harvestTx = await signer.sendTransaction({
      to: OS_HARVESTER,
      data: encodeFunctionData({
        abi: harvesterAbi,
        functionName: "harvestAndTransfer",
        args: [SONIC_STAKING_STRATEGY],
      }),
      gasLimit: 400000,
    });
    log.info(`harvestAndTransfer tx: ${harvestTx.hash}`);
    await harvestTx.wait();
  },
});
