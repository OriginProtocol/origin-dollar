import { ethers } from "ethers";

import { action } from "../lib/action";

const OETH_DRIPPER = "0xe3B3b4Fc77505EcfAACf6dD21619a8Cc12fcc501";
const OUSD_VAULT = "0xe75d77b1865ae93c7eaa3040b038d7aa7bc02f70";

const abi = [
  "function rebase() external",
  "function collectAndRebase() external",
];

const GAS_MULTIPLIER = 1.1;

action({
  name: "otoken-ousd-oeth-rebase",
  description:
    "Rebase both OETH (collectAndRebase) and OUSD (rebase) on mainnet",
  chains: [1],
  run: async ({ signer, log }) => {
    const oethDripper = new ethers.Contract(OETH_DRIPPER, abi, signer);
    const ousdVault = new ethers.Contract(OUSD_VAULT, abi, signer);

    // OETH collectAndRebase with gas estimation + 10% buffer
    log.info("Estimating gas for OETH collectAndRebase");
    const oethGas = await oethDripper.estimateGas.collectAndRebase();
    const oethGasLimit = oethGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const oethTx = await oethDripper.collectAndRebase({
      gasLimit: oethGasLimit,
    });
    log.info(
      `OETH collectAndRebase tx: ${oethTx.hash} (gasLimit: ${oethGasLimit})`
    );
    await oethTx.wait();

    // OUSD rebase with gas estimation + 10% buffer
    log.info("Estimating gas for OUSD rebase");
    const ousdGas = await ousdVault.estimateGas.rebase();
    const ousdGasLimit = ousdGas.mul(Math.floor(GAS_MULTIPLIER * 100)).div(100);
    const ousdTx = await ousdVault.rebase({ gasLimit: ousdGasLimit });
    log.info(`OUSD rebase tx: ${ousdTx.hash} (gasLimit: ${ousdGasLimit})`);
    await ousdTx.wait();
  },
});
