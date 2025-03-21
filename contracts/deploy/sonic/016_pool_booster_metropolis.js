const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation,
} = require("../../utils/deploy.js");
// const { oethUnits } = require("../../test/helpers");

// 0x03A9896A464C515d13f2679df337bF95bc891fdA: Voter
// 0xd9db92613867FE0d290CE64Fe737E2F8B80CADc3: Rewarder Factory
// 0x161A72027D83DA46329ed64A4EDfd0B717b7f8a7: Rewarder Implem
module.exports = deployOnSonic(
  {
    deployName: "016_pool_booster_metropolis",
  },
  async ({ ethers }) => {
    //const { deployerAddr } = await getNamedAccounts();
    //const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOSonic = await ethers.getContractAt(
      "OSonic",
      addresses.sonic.OSonicProxy
    );

    const dPoolBoosterMetropolis = await deployWithConfirmation(
      "PoolBoosterMetropolis",
      [
        cOSonic.address,
        "0xd9db92613867FE0d290CE64Fe737E2F8B80CADc3",
        "0x3987a13d675c66570bc28c955685a9bca2dcf26e",
        "0x03A9896A464C515d13f2679df337bF95bc891fdA",
      ]
    );
    await ethers.getContractAt(
      "PoolBoosterMetropolis",
      dPoolBoosterMetropolis.address
    );

    return {
      actions: [],
    };
  }
);
