const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  { deployName: "049_oeth_proxy", forceDeploy: false, forceSkip: true },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New OETH proxy
    const dOethProxy = await deployWithConfirmation("OETHProxy");
    const cOethProxy = await ethers.getContractAt(
      "OETHProxy",
      dOethProxy.address
    );

    // 2. Deploy new implementation
    const dOETHImpl = await deployWithConfirmation("OETH");

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cOethProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](dOETHImpl.address, deployerAddr, [], await getTxOpts())
    );

    // 5. Transfer governance
    await withConfirmation(
      cOethProxy
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Guardian, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy an empty OETH proxy",
      actions: [],
    };
  }
);
