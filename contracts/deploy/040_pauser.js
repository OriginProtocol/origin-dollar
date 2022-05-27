const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "040_pauser", forceDeploy: false },
  async ({ deployWithConfirmation, getTxOpts, ethers, withConfirmation }) => {
    const { deployerAddr, governorAddr, strategistAddr } =
      await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Deployer Actions
    // ----------------

    // 1. Deploy the pauser implementation.
    const dPauserImpl = await deployWithConfirmation("Pauser");

    // 2. Deploy the pauser proxy
    await deployWithConfirmation("PauserProxy");
    const cPauserProxy = await ethers.getContract("PauserProxy");
    const cPauser = await ethers.getContractAt("Pauser", cPauserProxy.address);

    // 3. Configure Proxy
    await withConfirmation(
      cPauserProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dPauserImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 4. Initialize Pauser with vault as pausable and 12 hours time
    const expiryDuration = 12 * 60 * 60; // 12 hours in seconds
    await withConfirmation(
      cPauser
        .connect(sDeployer)
        ["initialize(address,uint256)"](
          cVaultProxy.address,
          expiryDuration,
          await getTxOpts()
        )
    );

    // 5. Set Strategist address.
    await withConfirmation(
      cPauser.connect(sDeployer).setStrategistAddr(strategistAddr)
    );

    // 6. Assign ownership
    await withConfirmation(
      cPauser
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------

    return {
      name: "Claim Pauser governance and setup vault for pauser",
      actions: [
        // 1. Claim governance
        {
          contract: cPauser,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Setup vault for pauser
        {
          contract: cVault,
          signature: "setPauser(address)",
          args: [cPauser.address],
        },
      ],
    };
  }
);
