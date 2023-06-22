const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  {
    deployName: "064_oeth_morpho_aave_v2",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: 52,
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr } = await getNamedAccounts();
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

    // 3. Construct initialize call data to init and configure the new Morpho strategy
    const initData = cMorphoAaveStrategyImpl.interface.encodeFunctionData(
      "initialize(address,address[],address[],address[])",
      [
        cVaultProxy.address,
        [], // reward token addresses
        [assetAddresses.WETH], // asset token addresses
        [assetAddresses.aWETH], // platform tokens addresses
      ]
    );

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cOETHMorphoAaveStrategyProxy.connect(sDeployer)[initFunction](
        cMorphoAaveStrategyImpl.address,
        addresses.mainnet.OldTimelock, // governor
        initData, // data for call to the initialize function on the Morpho strategy
        await getTxOpts()
      )
    );

    console.log(
      "OETH Morpho Aave strategy address: ",
      cMorphoAaveStrategy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new OETH Morpho Aave strategy",
      governorAddr: addresses.mainnet.OldTimelock,
      actions: [
        // 1. Add new Morpho strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMorphoAaveStrategy.address],
        },
      ],
    };
  }
);
