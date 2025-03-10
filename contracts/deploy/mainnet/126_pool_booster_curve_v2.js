const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "126_pool_booster_curve",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ withConfirmation }) => {
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Contracts & Addresses
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    console.log(`\n\nDeployer address: ${deployerAddr}`);

    const cOETH = await ethers.getContractAt(
      "OETH",
      addresses.mainnet.OETHProxy
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterCentralRegistry on Mainnet
    // ---
    // ---------------------------------------------------------------------------------------------------------
    // --- Deploy Proxy
    await deployWithConfirmation("PoolBoostCentralRegistryProxy", []);
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    // --- Deploy Implementation
    const dPoolBoostCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // --- Initialize Proxy
    // prettier-ignore
    await withConfirmation(
      cPoolBoostCentralRegistryProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dPoolBoostCentralRegistry.address,
          addresses.mainnet.Timelock,
          "0x"
        )
    );
    console.log(
      "Initialized PoolBoostCentralRegistry proxy and implementation"
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterFactoryCurveMainnet impl on Mainnet
    // ---
    // ---------------------------------------------------------------------------------------------------------
    // --- Deploy Implementation
    console.log("cOETH.address", cOETH.address);
    console.log(
      "cPoolBoostCentralRegistry.address",
      cPoolBoostCentralRegistry.address
    );

    const dPoolBoosterFactoryCurveMainnetImpl = await deployWithConfirmation(
      "PoolBoosterFactoryCurveMainnet",
      [
        cOETH.address,
        cPoolBoostCentralRegistry.address,
        42161,
        addresses.mainnet.Timelock,
      ]
    );

    let cPoolBoosterFactoryCurveMainnetImpl = await ethers.getContractAt(
      "PoolBoosterFactoryCurveMainnet",
      dPoolBoosterFactoryCurveMainnetImpl.address
    );

    // --- Deploy Beacon Implementation
    const dPoolBoosterCurveMainnetBeacon = await deployWithConfirmation(
      "PoolBoosterCurveMainnet",
      []
    );

    // This action should have been done by the 2/8 MS using `CreateX::create2()`
    const dPoolBoosterFactoryCurveMainnetProxy = await deployWithConfirmation(
      "PoolBoosterFactoryCurveMainnetProxy",
      []
    );
    const cPoolBoosterFactoryCurveMainnetProxy = await ethers.getContractAt(
      "PoolBoosterFactoryCurveMainnetProxy",
      dPoolBoosterFactoryCurveMainnetProxy.address
    );

    const initData =
      cPoolBoosterFactoryCurveMainnetImpl.interface.encodeFunctionData(
        "initialize(address,address,address)",
        [
          addresses.multichainStrategist,
          addresses.mainnet.CampaignRemoteManager,
          addresses.votemarket,
        ]
      );

    // Initialize Proxy
    // prettier-ignore
    await withConfirmation(
      cPoolBoosterFactoryCurveMainnetProxy
        .connect(sDeployer)["initialize(address,address,address,bytes)"](
          dPoolBoosterFactoryCurveMainnetImpl.address, dPoolBoosterCurveMainnetBeacon.address, addresses.mainnet.Timelock, initData
        )
    );

    const cPoolBoosterFactoryCurveMainnet = await ethers.getContractAt(
      "PoolBoosterFactoryCurveMainnet",
      cPoolBoosterFactoryCurveMainnetProxy.address
    );

    return {
      name: "Approve PoolBoosterFactoryCurveMainnet on PoolBoostCentralRegistry",
      actions: [
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [cPoolBoosterFactoryCurveMainnet.address],
        },
      ],
    };
  }
);
