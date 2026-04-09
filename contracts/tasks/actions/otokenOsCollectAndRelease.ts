/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const OS_VAULT_PROXY_DEPLOYMENT = "OSonicVaultProxy";
const OS_HARVESTER_PROXY_DEPLOYMENT = "OSonicHarvesterProxy";
const STRATEGY_PROXY_DEPLOYMENT = "SonicSwapXAMOStrategyProxy";

action({
  name: "otokenOsCollectAndRelease",
  description: "Rebase OS vault and harvest on Sonic",
  chains: [146],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const vaultProxy = await ethers.getContract(OS_VAULT_PROXY_DEPLOYMENT);
    const vault = await ethers.getContractAt("IVault", vaultProxy.address);

    const harvesterProxy = await ethers.getContract(
      OS_HARVESTER_PROXY_DEPLOYMENT
    );
    const harvester = await ethers.getContractAt(
      "OSonicHarvester",
      harvesterProxy.address
    );
    const strategyProxy = await ethers.getContract(STRATEGY_PROXY_DEPLOYMENT);

    log.info(
      `Calling rebase on ${OS_VAULT_PROXY_DEPLOYMENT} at ${vault.address}`
    );
    const rebaseTx = await vault.connect(signer).rebase({ gasLimit: 400000 });
    await logTxDetails(rebaseTx, "rebase");

    log.info(
      `Calling harvestAndTransfer on ${OS_HARVESTER_PROXY_DEPLOYMENT} at ${harvester.address} for strategy ${strategyProxy.address}`
    );
    const harvestTx = await harvester
      .connect(signer)
      ["harvestAndTransfer(address)"](strategyProxy.address, {
        gasLimit: 400000,
      });
    await logTxDetails(harvestTx, "harvestAndTransfer");
  },
});
