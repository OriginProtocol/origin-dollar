const { parseUnits, formatUnits } = require("ethers");
const { deploymentWithGovernanceProposal, log } = require("../utils/deploy");

/* The 059 harvest change proposal has timed out. This just re-submits it.
 */
module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "060_harvest_crv_limit_2",
    forceDeploy: false,
    proposalId:
      "19517057494793169051021794342486874975141107655269915104229644719251875808935",
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
      name: "Update OUSD Harvester config for CRV - again\n\
\n\
The OUSD Harvester is currently failing as there is not enough liquidity in the SushiSwap CRV/ETH pool to swap 26,476 CRV to ETH and then ETH to USDT. The harvester will revert the swap if there is more than 3% slippage which is the case for 26,476 CRV. \n\
\n\
This proposal limits the amount of CRV that can be liquidated by the Harvester at one time to 4,000 CRV. That is a small enough amount to be under the 3% slippage requirement. \n\
\n\
The other Harvester config change is changing the harvester rewards for liquidating CRV from 1% to 2%. 2% is enough to cover costs when the gas price is 40 Gwei.\n\
\n\
Code PR: #1492",
      actions: [
        // 1. Update CRV config with new 5k CRV limit
        {
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
