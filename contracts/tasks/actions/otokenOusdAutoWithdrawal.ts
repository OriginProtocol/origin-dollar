/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const MODULE_DEPLOYMENT = "AutoWithdrawalModule";

action({
  name: "otokenOusdAutoWithdrawal",
  description: "Auto-process OUSD withdrawals",
  chains: [1],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const autoWithdrawalModule = await ethers.getContract(MODULE_DEPLOYMENT);
    log.info(
      `Calling fundWithdrawals on ${MODULE_DEPLOYMENT} at ${autoWithdrawalModule.address}`
    );
    const tx = await autoWithdrawalModule.connect(signer).fundWithdrawals({
      gasLimit: 4000000,
    });
    await logTxDetails(tx, `fundWithdrawals on ${MODULE_DEPLOYMENT}`);
  },
});
