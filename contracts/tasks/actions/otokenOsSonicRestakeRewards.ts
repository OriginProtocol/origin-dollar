import { encodeFunctionData, parseAbi } from "viem";

import { action } from "../lib/action";

const SONIC_STAKING_STRATEGY = "0x596B0401479f6DfE1cAF8c12838311FeE742B95c";
const VALIDATOR_IDS = [15n, 16n, 17n, 18n, 45n];

const abi = parseAbi([
  "function restakeRewards(uint256[] validatorIds) external",
]);

action({
  name: "otokenOsSonicRestakeRewards",
  description: "Restake rewards for Sonic validators",
  chains: [146],
  run: async ({ signer, log }) => {
    log.info(`Restaking rewards for validators: ${VALIDATOR_IDS.join(", ")}`);
    const tx = await signer.sendTransaction({
      to: SONIC_STAKING_STRATEGY,
      data: encodeFunctionData({
        abi,
        functionName: "restakeRewards",
        args: [VALIDATOR_IDS],
      }),
      gasLimit: 300000,
    });
    log.info(`restakeRewards tx: ${tx.hash}`);
    await tx.wait();
  },
});
