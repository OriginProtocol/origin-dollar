const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const {
  deployOSWETHRoosterAmoPool,
  deployPlumeRoosterAMOStrategyImplementation
} = require("../deployActions");

module.exports = deployOnPlume(
  {
    deployName: "002_rooster_amo",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.getSigner(deployerAddr);
      
    // TODO: delete the pool creation contract once it is already live
    const poolAddress = await deployOSWETHRoosterAmoPool();
    console.log("OETHp / WETH pool deployed at ", poolAddress);
    deployPlumeRoosterAMOStrategyImplementation(poolAddress);

    return {
      // No Governance actions for now
      actions: [],
    };
  }
);
