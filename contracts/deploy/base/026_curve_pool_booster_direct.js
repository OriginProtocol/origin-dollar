const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");

module.exports = deployOnBase(
  {
    deployName: "026_curve_pool_booster_direct",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");

    // Deploy Proxy
    await deployWithConfirmation("CurvePoolBoosterL2Proxy");
    const cCurvePoolBoosterL2Proxy = await ethers.getContract(
      "CurvePoolBoosterL2Proxy"
    );

    // Deploy Implementation
    const dCurvePoolBoosterL2 = await deployWithConfirmation(
      "CurvePoolBoosterL2",
      [
        cOETHbProxy.address,
        addresses.base.OETHb_WETH.gauge,
        addresses.votemarket,
      ]
    );

    const cCurvePoolBoosterL2 = await ethers.getContractAt(
      "CurvePoolBoosterL2",
      cCurvePoolBoosterL2Proxy.address
    );

    const initData = cCurvePoolBoosterL2.interface.encodeFunctionData(
      "initialize(address,uint16,address)",
      [
        addresses.base.multichainStrategist,
        0,
        addresses.base.multichainStrategist,
      ]
    );

    // Initialize Proxy
    // prettier-ignore
    await withConfirmation(
      cCurvePoolBoosterL2Proxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dCurvePoolBoosterL2.address,
          addresses.base.timelock,
          initData
        )
    );

    return {};
  }
);
