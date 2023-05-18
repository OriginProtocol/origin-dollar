const { parseUnits, formatUnits } = require("ethers").utils;
const { deploymentWithGovernanceProposal, log } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "056_harvest_crv_limit",
    forceDeploy: false,
  },
  async ({ assetAddresses, ethers }) => {
    // Current contracts
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    const oldCrvTokenConfig = await cHarvester.rewardTokenConfigs(
      assetAddresses.CRV
    );
    log(
      `Old CRV swap limit: ${formatUnits(
        oldCrvTokenConfig.liquidationLimit,
        18
      )} CRV`
    );

    const crvSwapLimit = "4000";
    const newCrvSwapLimit = parseUnits(crvSwapLimit, 18);
    log(`New CRV swap limit: ${crvSwapLimit} CRV`);

    // Governance Actions
    // ----------------
    return {
      name: "Update OUSD Harvester config for CRV",
      actions: [
        // 1. Update CRV config with new 5k CRV limit
        {
          name: "Update OUSD Harvester config for CRV",
          contract: cHarvester,
          signature:
            "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
          args: [
            assetAddresses.CRV,
            oldCrvTokenConfig.allowedSlippageBps,
            200, // harvestRewardBps - increased from 1% to 2%
            oldCrvTokenConfig.uniswapV2CompatibleAddr,
            newCrvSwapLimit,
            oldCrvTokenConfig.doSwapRewardToken,
          ],
        },
      ],
    };
  }
);
