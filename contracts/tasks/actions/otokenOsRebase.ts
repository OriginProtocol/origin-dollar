import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOsRebase",
  description: "Collect OS dripper and rebase OS on Sonic",
  chains: [146],
  run: async ({ signer, log }) => {
    const osDripperProxy = await getContract("OSonicDripperProxy");
    const oSonicVaultProxy = await getContract("OSonicVaultProxy");
    const osDripper = await getContractAt("IDripper", osDripperProxy.address);
    const oSonicVault = await getContractAt("IVault", oSonicVaultProxy.address);

    const osDripperWithSigner = osDripper.connect(signer);
    const oSonicVaultWithSigner = oSonicVault.connect(signer);

    // OS collect with gas estimation + 10% buffer
    log.info("Estimating gas for OS collect");
    const osCollectGas = await osDripperWithSigner.estimateGas.collect();
    const osCollectGasLimit = osCollectGas
      .mul(Math.floor(GAS_MULTIPLIER * 100))
      .div(100);
    const osCollectTx = await osDripperWithSigner.collect({
      gasLimit: osCollectGasLimit,
    });
    await logTxDetails(
      osCollectTx,
      `collect (gasLimit: ${osCollectGasLimit.toString()})`
    );

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
