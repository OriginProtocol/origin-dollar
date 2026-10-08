import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const VAULT_PROXY_DEPLOYMENT = "OETHBaseVaultProxy";

action({
  name: "otokenOethbRebase",
  description: "Allocate idle SuperOETH assets and rebase OETHb on Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const vaultProxy = await getContract(VAULT_PROXY_DEPLOYMENT);
    const vault = await getContractAt("IVault", vaultProxy.address);
    const vaultWithSigner = vault.connect(signer);

    log.info(
      `Calling allocate on ${VAULT_PROXY_DEPLOYMENT} at ${vault.address}`
    );
    const allocateTx = await vaultWithSigner.allocate();
    await logTxDetails(allocateTx, "allocate");

    log.info(`Calling rebase on ${VAULT_PROXY_DEPLOYMENT} at ${vault.address}`);
    const tx = await vaultWithSigner.rebase();
    await logTxDetails(tx, "rebase");
  },
});
