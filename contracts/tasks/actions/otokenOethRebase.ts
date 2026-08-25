import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOethRebase",
  description: "Rebase OETH on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const oethVaultProxy = await getContract("OETHVaultProxy");
    const oethVault = await getContractAt("IVault", oethVaultProxy.address);
    const oethVaultWithSigner = oethVault.connect(signer);

    log.info("Estimating gas for OETH rebase");
    const gas = await oethVaultWithSigner.estimateGas.rebase();
    const gasLimit = gas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const tx = await oethVaultWithSigner.rebase({ gasLimit });
    await logTxDetails(tx, `rebase (gasLimit: ${gasLimit.toString()})`);
  },
});
