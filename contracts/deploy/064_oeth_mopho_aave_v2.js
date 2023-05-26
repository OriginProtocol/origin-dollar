const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  {
    deployName: "064_oeth_morpho_aave_v2",
    forceDeploy: false,
    // proposalId: ,
  },
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
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dOETHMorphoAaveStrategyProxy = await deployWithConfirmation(
      "OETHMorphoAaveStrategyProxy"
    );
    const cOETHMorphoAaveStrategyProxy = await ethers.getContractAt(
      "OETHMorphoAaveStrategyProxy",
      dOETHMorphoAaveStrategyProxy.address
    );

    // 2. Reuse old OUSD impl
    const cMorphoAaveStrategyImpl = await ethers.getContract(
      "MorphoAaveStrategy"
    );
    const cMorphoAaveStrategy = await ethers.getContractAt(
      "MorphoAaveStrategy",
      cOETHMorphoAaveStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cOETHMorphoAaveStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          cMorphoAaveStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 4. Init and configure new Morpho strategy
    const initFunction = "initialize(address,address[],address[],address[])";
    await withConfirmation(
      cMorphoAaveStrategy.connect(sDeployer)[initFunction](
        cVaultProxy.address,
        [], // reward token addresses
        [assetAddresses.WETH], // asset token addresses
        [assetAddresses.aWETH], // platform tokens addresses
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cMorphoAaveStrategy
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.OldTimelock, await getTxOpts())
    );

    console.log(
      "OUSD Morpho Aave strategy address: ",
      cMorphoAaveStrategy.address
    );
    // Governance Actions
    // ----------------
    return {
      name: "Deploy new OUSD Morpho Aave strategy",
      governorAddr: addresses.mainnet.OldTimelock,
      actions: [
        // 1. Accept governance of new MorphoAaveStrategy
        {
          contract: cMorphoAaveStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new Morpho strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMorphoAaveStrategy.address],
        },
      ],
    };
  }
);
