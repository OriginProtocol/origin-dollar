const { isFork } = require("../../test/helpers");
const { deployOnArb } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnArb(
  {
    deployName: "002_upgrade_woeth_on_arb",
  },
  async ({ ethers }) => {
    const cWOETHProxy = await ethers.getContract("BridgedWOETHProxy");

    // Deploy Bridged WOETH Token implementation
    await deployWithConfirmation("BridgedWOETH", []);

    const cWOETHImpl = await ethers.getContract("BridgedWOETH");
    console.log("BridgedWOETH address:", cWOETHImpl.address);

    if (isFork) {
      console.log("Simulating upgrade on fork");

      const governorAddr = await cWOETHProxy.governor();
      const sGovernor = await impersonateAndFund(governorAddr);

      await cWOETHProxy.connect(sGovernor).upgradeTo(cWOETHImpl.address);
    }
  }
);
