const { deploymentWithProposal, log } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "037_dripper", forceDeploy: false },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy Dripper
    const dDripperImpl = await deployWithConfirmation("Dripper", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);
    const cDripperImpl = await ethers.getContract("Dripper");

    // 2. Deploy Proxy
    const dConvexStrategyProxy = await deployWithConfirmation("DripperProxy");
    const cDripperProxy = await ethers.getContract("DripperProxy");
    const cDripper = await ethers.getContractAt(
      "Dripper",
      cDripperProxy.address
    );

    // 3. Configure Proxy
    await withConfirmation(
      cDripperProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          cDripperImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 4. Configure Dripper to one week
    await withConfirmation(
      cDripper.connect(sDeployer).setDripDuration(7 * 24 * 60 * 60)
    );

    // 5. Transfer governance
    await withConfirmation(
      cDripper
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Add dripper",
      actions: [
        // 1. Accept governance
        {
          contract: cDripper,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Change harvester to point at dripper
        // TODO
      ],
    };
  }
);
