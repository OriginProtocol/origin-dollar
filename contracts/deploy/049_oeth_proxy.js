const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "049_oeth_proxy", forceDeploy: false },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
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
      cOethProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dOETHImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 5. Transfer governance
    await withConfirmation(
      cOethProxy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy empty OETH proxy",
      actions: [
        // 1. Accept governance of OETH proxy
        {
          contract: cOethProxy,
          signature: "claimGovernance()",
          args: [],
        },
      ],
    };
  }
);
