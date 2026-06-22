import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOusdRebase",
  description: "Rebase OUSD on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const vaultProxy = await ethers.getContract("VaultProxy");
    const ousdVault = await ethers.getContractAt("IVault", vaultProxy.address);
    const ousdVaultWithSigner = ousdVault.connect(signer);

    // OUSD rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OUSD rebase");
    const ousdGas = await ousdVaultWithSigner.estimateGas.rebase();
    const ousdGasLimit = ousdGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const ousdTx = await ousdVaultWithSigner.rebase({ gasLimit: ousdGasLimit });
    await logTxDetails(ousdTx, `rebase (gasLimit: ${ousdGasLimit.toString()})`);
  },
});
