const { deploymentWithProposal, withConfirmation } = require("../utils/deploy");

// Deploy new staking implimentation contract with fix
// Upgrade to using it

module.exports = deploymentWithProposal(
  { deployName: "039_wrapped_ousd", forceDeploy: true },
  async ({ deployWithConfirmation, getTxOpts, ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy the new implementation.
    const dWrappedOusd = await deployWithConfirmation("WrappedOusd", [
      cOUSDProxy.address,
      "Wrapped OUSD",
      "WOUSD",
    ]);
    const cWousd = await ethers.getContract("WrappedOusd");

    // 2. Assign ownership
    await withConfirmation(
      cWousd
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------

    return {
      name: "Claim WOUSD Governance",
      actions: [
        // 1. Claim governance
        {
          contract: cWousd,
          signature: "claimGovernance()",
        },
      ],
    };
  }
);
