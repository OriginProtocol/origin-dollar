const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  { deployName: "050_woeth_proxy", forceDeploy: false, forceSkip: true },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New WOETH proxy
    const dWoethProxy = await deployWithConfirmation("WOETHProxy");
    const cWoethProxy = await ethers.getContractAt(
      "WOETHProxy",
      dWoethProxy.address
    );

    // 2. Deploy new implementation
    const dWOETHImpl = await deployWithConfirmation("WOETH");

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cWoethProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](dWOETHImpl.address, deployerAddr, [], await getTxOpts())
    );

    // 5. Transfer governance
    await withConfirmation(
      cWoethProxy
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Guardian, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy an empty WOETH proxy",
      actions: [],
    };
  }
);
