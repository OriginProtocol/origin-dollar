import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOusdRebase",
  description: "Allocate idle OUSD assets and rebase OUSD on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const vaultProxy = await getContract("VaultProxy");
    const ousdVault = await getContractAt("IVault", vaultProxy.address);
    const ousdVaultWithSigner = ousdVault.connect(signer);

    log.info("Estimating gas for OUSD allocation");
    const allocateGas = await ousdVaultWithSigner.estimateGas.allocate();
    const allocateGasLimit = allocateGas
      .mul(Math.floor(GAS_MULTIPLIER * 100))
      .div(100);
    const allocateTx = await ousdVaultWithSigner.allocate({
      gasLimit: allocateGasLimit,
    });
    await logTxDetails(
      allocateTx,
      `allocate (gasLimit: ${allocateGasLimit.toString()})`
    );

    // OUSD rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OUSD rebase");
    const ousdGas = await ousdVaultWithSigner.estimateGas.rebase();
    const ousdGasLimit = ousdGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const ousdTx = await ousdVaultWithSigner.rebase({ gasLimit: ousdGasLimit });
    await logTxDetails(ousdTx, `rebase (gasLimit: ${ousdGasLimit.toString()})`);
  },
});
