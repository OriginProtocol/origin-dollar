const { deploymentWithProposal, withConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "039_wrapped_ousd", forceDeploy: false },
  async ({ deployWithConfirmation, getTxOpts, ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy the new implementation.
    const dWrappedOusdImpl = await deployWithConfirmation("WrappedOusd", [
      cOUSDProxy.address,
      "Wrapped OUSD",
      "WOUSD",
    ]);

    // 2. Deploy the new proxy
    await deployWithConfirmation("WrappedOUSDProxy");
    const cWrappedOUSDProxy = await ethers.getContract("WrappedOUSDProxy");
    const cWrappedOUSD = await ethers.getContractAt(
      "WrappedOusd",
      cWrappedOUSDProxy.address
    );

    // 3. Configure Proxy
    await withConfirmation(
      cWrappedOUSDProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](dWrappedOusdImpl.address, deployerAddr, [], await getTxOpts())
    );

    // 3. Initialize Wrapped OUSD
    await withConfirmation(
      cWrappedOUSD.connect(sDeployer)["initialize()"](await getTxOpts())
    );

    // 4. Assign ownership
    await withConfirmation(
      cWrappedOUSD
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
          contract: cWrappedOUSD,
          signature: "claimGovernance()",
        },
      ],
    };
  }
);
