/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

// Vault proxy deployment name(s) per chain id. addWithdrawalQueueLiquidity is
// permissionless and a no-op when the withdrawal queue has no shortfall, so it
// is safe to call on every OToken vault on the network. Mainnet has two vaults
// (OUSD + OETH); the L2s have one each.
const VAULT_DEPLOYMENTS_BY_CHAIN_ID: Record<number, string[]> = {
  1: ["VaultProxy", "OETHVaultProxy"], // mainnet: OUSD + OETH
  8453: ["OETHBaseVaultProxy"], // base: Super OETH
  146: ["OSonicVaultProxy"], // sonic: Origin Sonic
  98866: ["OETHPlumeVaultProxy"], // plume: Super OETH
};

action({
  name: "otokenAddWithdrawalQueueLiquidity",
  description:
    "Call addWithdrawalQueueLiquidity on every OToken vault on the current network",
  chains: Object.keys(VAULT_DEPLOYMENTS_BY_CHAIN_ID).map(Number),
  run: async ({ signer, chainId, networkName, log }) => {
    const ethers = hre.ethers;
    const deploymentNames = VAULT_DEPLOYMENTS_BY_CHAIN_ID[chainId];

    for (const deploymentName of deploymentNames) {
      const vaultProxy = await ethers.getContract(deploymentName);
      const vault = await ethers.getContractAt("IVault", vaultProxy.address);

      log.info(
        `Calling addWithdrawalQueueLiquidity on ${deploymentName} at ${vault.address} (${networkName})`
      );
      const tx = await vault
        .connect(signer)
        .addWithdrawalQueueLiquidity({ gasLimit: 400000 });
      await logTxDetails(tx, `addWithdrawalQueueLiquidity:${deploymentName}`);
    }
  },
});
