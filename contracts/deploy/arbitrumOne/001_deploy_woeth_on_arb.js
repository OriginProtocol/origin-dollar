const { deployOnArb } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { getTxOpts } = require("../../utils/tx");

module.exports = deployOnArb(
  {
    deployName: "001_deploy_woeth_on_arb",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy Proxy
    await deployWithConfirmation(
      "BridgedWOETHProxy",
      [],
      undefined,
      undefined,
      undefined,
      20000000
    );
    const cWOETHProxy = await ethers.getContract("BridgedWOETHProxy");
    console.log("BridgedWOETHProxy address:", cWOETHProxy.address);

    // Deploy Bridged WOETH Token implementation
    await deployWithConfirmation(
      "BridgedWOETH",
      [],
      undefined,
      undefined,
      undefined,
      20000000
    );
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
    console.log("Initialized BridgedWOETHProxy");
  }
);
