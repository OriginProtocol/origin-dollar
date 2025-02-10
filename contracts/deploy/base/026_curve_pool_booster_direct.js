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
    await deployWithConfirmation("CurvePoolBoosterDirectProxy");
    const cCurvePoolBoosterDirectProxy = await ethers.getContract(
      "CurvePoolBoosterDirectProxy"
    );

    // Deploy Implementation
    const dCurvePoolBoosterDirect = await deployWithConfirmation(
      "CurvePoolBoosterDirect",
      [
        cOETHbProxy.address,
        addresses.base.OETHbWETH.curveGauge,
        addresses.votemarket,
      ]
    );

    const cCurvePoolBoosterDirect = await ethers.getContractAt(
      "CurvePoolBoosterDirect",
      cCurvePoolBoosterDirectProxy.address
    );

    const initData = cCurvePoolBoosterDirect.interface.encodeFunctionData(
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
      cCurvePoolBoosterDirectProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dCurvePoolBoosterDirect.address,
          addresses.base.timelock,
          initData
        )
    );

    return {};
  }
);
