const { deploymentWithProposal } = require("../utils/deploy");

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

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cCVX = await ethers.getContractAt(
      "OUSD", // Just need ERC20 methods
      assetAddresses.CVX
    );
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy Dripper
    await deployWithConfirmation("Dripper", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);
    const cDripperImpl = await ethers.getContract("Dripper");

    // 2. Deploy Proxy
    await deployWithConfirmation("DripperProxy");
    const cDripperProxy = await ethers.getContract("DripperProxy");
    const cDripper = await ethers.getContractAt(
      "Dripper",
      cDripperProxy.address
    );

    // 3. Configure Proxy
    await withConfirmation(
      cDripperProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](cDripperImpl.address, deployerAddr, [], await getTxOpts())
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
    const cvxToMove = await cCVX.balanceOf(cVaultAdmin.address);

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
        {
          contract: cHarvester,
          signature: "setRewardsProceedsAddress(address)",
          args: [cDripper.address],
        },
        // 3. Collect CVX from vault
        {
          contract: cVaultAdmin,
          signature: "transferToken(address,uint256)",
          args: [assetAddresses.CVX, cvxToMove],
        },
        // 4. Send to CVX to harvester
        {
          contract: cCVX,
          signature: "transfer(address,uint256)",
          args: [cHarvester.address, cvxToMove],
        },
        // 5. Configure harvester not sell all CVX at once, which
        // hits the slippage limit
        {
          contract: cHarvester,
          // tokenAddress, allowedSlippageBps, harvestRewardBps, uniswapV2CompatibleAddr, liquidationLimit, doSwapRewardToken
          signature:
            "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
          args: [
            assetAddresses.CVX,
            300,
            100,
            assetAddresses.sushiswapRouter,
            ethers.utils.parseUnits("2500", 18), // <-- Limit CVX per sale
            true,
          ],
        },
      ],
    };
  }
);
