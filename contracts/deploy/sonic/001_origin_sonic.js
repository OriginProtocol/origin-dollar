const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnSonic(
  {
    deployName: "001_origin_sonic",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const { governorAddr, deployerAddr } = await getNamedAccounts();
    console.log(`Admin 5/8: ${governorAddr}`);
    console.log(`Deployer: ${deployerAddr}`);

    // Timelock with 60 second delay
    await deployWithConfirmation("Timelock", [governorAddr, 60]);
    const cTimelock = await ethers.getContract("Timelock");
    console.log(`Deployed Timelock to ${cTimelock.address}`);
  }
);
