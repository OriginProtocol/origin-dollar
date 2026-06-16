import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOsRebase",
  description: "Rebase OS on Sonic",
  chains: [146],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const oSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const oSonicVault = await ethers.getContractAt(
      "IVault",
      oSonicVaultProxy.address
    );
    const oSonicVaultWithSigner = oSonicVault.connect(signer);

    // OS rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OS rebase");
    const osRebaseGas = await oSonicVaultWithSigner.estimateGas.rebase();
    const osRebaseGasLimit = osRebaseGas
      .mul(Math.floor(GAS_MULTIPLIER * 100))
      .div(100);
    const osRebaseTx = await oSonicVaultWithSigner.rebase({
      gasLimit: osRebaseGasLimit,
    });
    await logTxDetails(
      osRebaseTx,
      `rebase (gasLimit: ${osRebaseGasLimit.toString()})`
    );
  },
});
