const { parseUnits, formatUnits } = require("ethers").utils;
const { deploymentWithProposal, log } = require("../utils/deploy");

/* The 059 harvest change proposal has timed out. This just re-submits it.
 */
module.exports = deploymentWithProposal(
  {
    deployName: "063_oeth_harvest_crv_limit",
    forceDeploy: false,
  },
  async ({ assetAddresses, ethers }) => {
    // Current contracts
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cOETHHarvesterProxy.address
    );

    const oldCrvTokenConfig = await cOETHHarvester.rewardTokenConfigs(
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
      name: "Update OETH Harvester config for CRV",
      actions: [
        // 1. Update CRV config with new 4k CRV limit
        {
          contract: cOETHHarvester,
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
