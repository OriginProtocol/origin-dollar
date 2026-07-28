import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const SONIC_STAKING_STRATEGY_PROXY_DEPLOYMENT = "SonicStakingStrategyProxy";
const VALIDATOR_IDS = [15n, 16n, 17n, 18n, 45n];

action({
  name: "otokenOsSonicRestakeRewards",
  description: "Restake rewards for Sonic validators",
  chains: [146],
  run: async ({ signer, log }) => {
    const strategyProxy = await getContract(
      SONIC_STAKING_STRATEGY_PROXY_DEPLOYMENT
    );
    const strategy = await getContractAt(
      "SonicStakingStrategy",
      strategyProxy.address
    );

    log.info(`Restaking rewards for validators: ${VALIDATOR_IDS.join(", ")}`);
    const tx = await strategy
      .connect(signer)
      .restakeRewards(VALIDATOR_IDS, { gasLimit: 300000 });
    await logTxDetails(tx, "restakeRewards");
  },
});
