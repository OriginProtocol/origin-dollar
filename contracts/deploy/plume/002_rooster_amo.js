const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "002_rooster_amo",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.getSigner(deployerAddr);
    

    return {
      // No Governance actions for now
      actions: [],
    };
  }
);
