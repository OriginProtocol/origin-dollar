const { deployOnBaseWithEOA } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { getTxOpts } = require("../../utils/tx");

module.exports = deployOnBaseWithEOA(
  {
    deployName: "001_woeth_on_base",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy Proxy
    await deployWithConfirmation("BridgedBaseWOETHProxy", []);
    const cWOETHProxy = await ethers.getContract("BridgedBaseWOETHProxy");
    console.log("BridgedBaseWOETHProxy address:", cWOETHProxy.address);

    // Deploy Bridged WOETH Token implementation
    await deployWithConfirmation("BridgedWOETH", []);
    const cWOETHImpl = await ethers.getContract("BridgedWOETH");
    console.log("BridgedWOETH address:", cWOETHImpl.address);

    // Build implementation initialization tx data
    const initData = cWOETHImpl.interface.encodeFunctionData(
      "initialize()",
      []
    );

    // Initialize the proxy
    // prettier-ignore
    await withConfirmation(
      cWOETHProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          cWOETHImpl.address,
          deployerAddr, // Pretend Deployer is Governor for now
          initData,
          await getTxOpts()
        )
    );
    console.log("Initialized BridgedBaseWOETHProxy");
  }
);
