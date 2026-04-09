/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const OETHP_VAULT_PROXY_DEPLOYMENT = "OETHPlumeVaultProxy";

action({
  name: "otokenOethpAddWithdrawalQueueLiquidity",
  description: "Add liquidity to Plume OETH withdrawal queue",
  chains: [98866],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const vaultProxy = await ethers.getContract(OETHP_VAULT_PROXY_DEPLOYMENT);
    const vault = await ethers.getContractAt("IVault", vaultProxy.address);

    log.info(
      `Calling addWithdrawalQueueLiquidity on ${OETHP_VAULT_PROXY_DEPLOYMENT} at ${vault.address}`
    );
    const tx = await vault
      .connect(signer)
      .addWithdrawalQueueLiquidity({ gasLimit: 400000 });
    await logTxDetails(tx, "addWithdrawalQueueLiquidity");
  },
});
