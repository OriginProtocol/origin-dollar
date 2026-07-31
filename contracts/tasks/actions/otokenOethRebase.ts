import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOethRebase",
  description: "Collect OETH dripper and rebase OETH on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const oethDripperProxy = await getContract("OETHFixedRateDripperProxy");
    const oethVaultProxy = await getContract("OETHVaultProxy");
    const oethDripper = await getContractAt(
      "IDripper",
      oethDripperProxy.address
    );
    const oethVault = await getContractAt("IVault", oethVaultProxy.address);

    const oethDripperWithSigner = oethDripper.connect(signer);
    const oethVaultWithSigner = oethVault.connect(signer);

    // OETH collect with gas estimation + 10% buffer
    log.info("Estimating gas for OETH collect");
    const oethCollectGas = await oethDripperWithSigner.estimateGas.collect();
    const oethCollectGasLimit = oethCollectGas
      .mul(Math.floor(GAS_MULTIPLIER * 100))
      .div(100);
    const oethCollectTx = await oethDripperWithSigner.collect({
      gasLimit: oethCollectGasLimit,
    });
    await logTxDetails(
      oethCollectTx,
      `collect (gasLimit: ${oethCollectGasLimit.toString()})`
    );

    // OETH rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OETH rebase");
    const oethRebaseGas = await oethVaultWithSigner.estimateGas.rebase();
    const oethRebaseGasLimit = oethRebaseGas
      .mul(Math.floor(GAS_MULTIPLIER * 100))
      .div(100);
    const oethRebaseTx = await oethVaultWithSigner.rebase({
      gasLimit: oethRebaseGasLimit,
    });
    await logTxDetails(
      oethRebaseTx,
      `rebase (gasLimit: ${oethRebaseGasLimit.toString()})`
    );
  },
});
