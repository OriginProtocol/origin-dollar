import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const VAULT_PROXY_DEPLOYMENT = "OETHBaseVaultProxy";

action({
  name: "otokenOethbRebase",
  description: "Rebase OETHb vault on Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const vaultProxy = await getContract(VAULT_PROXY_DEPLOYMENT);
    const vault = await getContractAt("IVault", vaultProxy.address);

    log.info(`Calling rebase on ${VAULT_PROXY_DEPLOYMENT} at ${vault.address}`);
    const tx = await vault.connect(signer).rebase();
    await logTxDetails(tx, "rebase");
  },
});
