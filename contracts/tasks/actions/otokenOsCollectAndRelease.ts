import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const OS_VAULT_PROXY_DEPLOYMENT = "OSonicVaultProxy";
const OS_HARVESTER_PROXY_DEPLOYMENT = "OSonicHarvesterProxy";
const STRATEGY_PROXY_DEPLOYMENT = "SonicSwapXAMOStrategyProxy";

action({
  name: "otokenOsCollectAndRelease",
  description: "Rebase OS vault and harvest on Sonic",
  chains: [146],
  run: async ({ signer, log }) => {
    const vaultProxy = await getContract(OS_VAULT_PROXY_DEPLOYMENT);
    const vault = await getContractAt("IVault", vaultProxy.address);

    const harvesterProxy = await getContract(OS_HARVESTER_PROXY_DEPLOYMENT);
    const harvester = await getContractAt(
      "OSonicHarvester",
      harvesterProxy.address
    );
    const strategyProxy = await getContract(STRATEGY_PROXY_DEPLOYMENT);

    log.info(
      `Calling rebase on ${OS_VAULT_PROXY_DEPLOYMENT} at ${vault.address}`
    );
    const rebaseTx = await vault.connect(signer).rebase({ gasLimit: 400000 });
    await logTxDetails(rebaseTx, "rebase");

    log.info(
      `Calling harvestAndTransfer on ${OS_HARVESTER_PROXY_DEPLOYMENT} at ${harvester.address} for strategy ${strategyProxy.address}`
    );
    const connectedHarvester = harvester.connect(signer);
    const harvestTx = await connectedHarvester["harvestAndTransfer(address)"](
      strategyProxy.address,
      { gasLimit: 400000 }
    );
    await logTxDetails(harvestTx, "harvestAndTransfer");
  },
});
