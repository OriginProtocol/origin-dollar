import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const GAS_MULTIPLIER = 1.1;

action({
  name: "otokenOusdOethRebase",
  description:
    "Rebase both OETH (collectAndRebase) and OUSD (rebase) on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const oethDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );
    const vaultProxy = await ethers.getContract("VaultProxy");
    const oethDripper = await ethers.getContractAt(
      "IDripper",
      oethDripperProxy.address
    );
    const ousdVault = await ethers.getContractAt("IVault", vaultProxy.address);

    const oethDripperWithSigner = oethDripper.connect(signer);
    const ousdVaultWithSigner = ousdVault.connect(signer);

    // OETH collectAndRebase with gas estimation + 10% buffer
    log.info("Estimating gas for OETH collectAndRebase");
    const oethGas = await oethDripperWithSigner.estimateGas.collectAndRebase();
    const oethGasLimit = oethGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const oethTx = await oethDripperWithSigner.collectAndRebase({
      gasLimit: oethGasLimit,
    });
    await logTxDetails(
      oethTx,
      `collectAndRebase (gasLimit: ${oethGasLimit.toString()})`
    );

    // OUSD rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OUSD rebase");
    const ousdGas = await ousdVaultWithSigner.estimateGas.rebase();
    const ousdGasLimit = ousdGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const ousdTx = await ousdVaultWithSigner.rebase({ gasLimit: ousdGasLimit });
    await logTxDetails(ousdTx, `rebase (gasLimit: ${ousdGasLimit.toString()})`);
  },
});
