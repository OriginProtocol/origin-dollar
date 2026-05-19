import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOusdOethRebase",
  description: "Collect OETH and rebase OUSD on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const oethDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );
    const vaultProxy = await ethers.getContract("VaultProxy");
    const oethVaultProxy = await ethers.getContract("OETHVaultProxy");
    const oethDripper = await ethers.getContractAt(
      "IDripper",
      oethDripperProxy.address
    );
    const ousdVault = await ethers.getContractAt("IVault", vaultProxy.address);
    const oethVault = await ethers.getContractAt("IVault", oethVaultProxy.address);

    const oethDripperWithSigner = oethDripper.connect(signer);
    const ousdVaultWithSigner = ousdVault.connect(signer);
    const oethVaultWithSigner = oethVault.connect(signer);

    // OETH collect with gas estimation + 10% buffer
    log.info("Estimating gas for OETH collect");
    const oethCollectGas = await oethDripperWithSigner.estimateGas.collect();
    const oethCollectGasLimit = oethCollectGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
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
    const oethRebaseGasLimit = oethRebaseGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const oethRebaseTx = await oethVaultWithSigner.rebase({ gasLimit: oethRebaseGasLimit });
    await logTxDetails(oethRebaseTx, `rebase (gasLimit: ${oethRebaseGasLimit.toString()})`);

    // OUSD rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OUSD rebase");
    const ousdGas = await ousdVaultWithSigner.estimateGas.rebase();
    const ousdGasLimit = ousdGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const ousdTx = await ousdVaultWithSigner.rebase({ gasLimit: ousdGasLimit });
    await logTxDetails(ousdTx, `rebase (gasLimit: ${ousdGasLimit.toString()})`);
  },
});
