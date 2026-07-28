import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const HARVESTER_PROXY_DEPLOYMENT = "OETHBaseHarvesterProxy";
const STRATEGY_PROXY_DEPLOYMENTS = [
  "OETHBaseCurveAMOProxy",
  "AerodromeAMOStrategyProxy",
] as const;

action({
  name: "otokenOethbHarvest",
  description: "Harvest strategies on Base OETHb",
  chains: [8453],
  run: async ({ signer, log }) => {
    const harvesterProxy = await getContract(HARVESTER_PROXY_DEPLOYMENT);
    const harvester = await getContractAt(
      "SuperOETHHarvester",
      harvesterProxy.address
    );
    const strategies = await Promise.all(
      STRATEGY_PROXY_DEPLOYMENTS.map(async (deploymentName) => {
        const strategy = await getContract(deploymentName);
        return strategy.address;
      })
    );

    log.info(
      `Calling harvestAndTransfer on ${HARVESTER_PROXY_DEPLOYMENT} at ${harvester.address} for ${strategies.length} strategy(ies)`
    );
    const connectedHarvester = harvester.connect(signer);
    const tx = await connectedHarvester["harvestAndTransfer(address[])"](
      strategies,
      { gasLimit: 800000 }
    );
    await logTxDetails(tx, "harvestAndTransfer");
  },
});
