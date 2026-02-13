const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "175_deploy_pool_booster_merkl_factory",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const oethProxy = await ethers.getContract("OETHProxy");
    const oeth = await ethers.getContractAt("OETH", oethProxy.address);

    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );
    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // Get old factory from deployment artifacts
    const oldFactory = await ethers.getContract("PoolBoosterFactoryMerkl");

    // ---------------------------------------------------------------------------------------------------------
    // --- 1. Deploy PoolBoosterMerklV2 (implementation for beacon proxies)
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterMerklV2 = await deployWithConfirmation(
      "PoolBoosterMerklV2",
      []
    );
    console.log(
      `PoolBoosterMerklV2 deployed to ${dPoolBoosterMerklV2.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 2. Deploy GovernableBeacon pointing to PoolBoosterMerklV2
    // ---------------------------------------------------------------------------------------------------------
    const dGovernableBeacon = await deployWithConfirmation("GovernableBeacon", [
      dPoolBoosterMerklV2.address,
      addresses.mainnet.Timelock,
    ]);
    console.log(`GovernableBeacon deployed to ${dGovernableBeacon.address}`);

    // ---------------------------------------------------------------------------------------------------------
    // --- 3. Deploy PoolBoosterFactoryMerklProxy
    // ---------------------------------------------------------------------------------------------------------
    const dFactoryProxy = await deployWithConfirmation(
      "PoolBoosterFactoryMerklProxy",
      []
    );
    console.log(
      `PoolBoosterFactoryMerklProxy deployed to ${dFactoryProxy.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 4. Deploy PoolBoosterFactoryMerkl implementation (new initializable version)
    // ---------------------------------------------------------------------------------------------------------
    const dFactoryImpl = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [],
      undefined,
      true
    );
    console.log(
      `PoolBoosterFactoryMerkl impl deployed to ${dFactoryImpl.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 5. Initialize factory proxy
    // ---------------------------------------------------------------------------------------------------------
    const iFactory = new ethers.utils.Interface([
      "function initialize(address,address,address)",
    ]);
    const factoryInitData = iFactory.encodeFunctionData("initialize", [
      addresses.mainnet.Timelock,
      cPoolBoostCentralRegistryProxy.address,
      dGovernableBeacon.address,
    ]);

    const cFactoryProxy = await ethers.getContractAt(
      "PoolBoosterFactoryMerklProxy",
      dFactoryProxy.address
    );
    // The deployer initializes the proxy (sets impl + governor + calls initialize)
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = ethers.provider.getSigner(deployerAddr);
    await cFactoryProxy.connect(sDeployer)["initialize(address,address,bytes)"](
      dFactoryImpl.address,
      addresses.mainnet.Timelock,
      factoryInitData
    );
    console.log("Factory proxy initialized");

    // ---------------------------------------------------------------------------------------------------------
    // --- 6. Governance proposal
    // ---------------------------------------------------------------------------------------------------------
    // Encode initData for the first Pool Booster
    const iPoolBoosterMerklV2 = new ethers.utils.Interface([
      "function initialize(uint32,uint32,address,address,address,address,bytes)",
    ]);
    const initData = iPoolBoosterMerklV2.encodeFunctionData("initialize", [
      604800, // duration: 7 days
      45, // campaignType: concentrated liquidity
      oeth.address, // rewardToken
      addresses.mainnet.CampaignCreator, // merklDistributor
      addresses.mainnet.Guardian, // governor
      addresses.multichainStrategist, // strategist
      "0x", // campaignData: placeholder
    ]);

    const cNewFactory = await ethers.getContractAt(
      "PoolBoosterFactoryMerkl",
      dFactoryProxy.address
    );

    return {
      name: "Swap PoolBoosterFactoryMerkl and create Pool Booster",
      actions: [
        {
          // Remove old factory from central registry
          contract: cPoolBoostCentralRegistry,
          signature: "removeFactory(address)",
          args: [oldFactory.address],
        },
        {
          // Approve new factory proxy in central registry
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dFactoryProxy.address],
        },
        {
          // Create a new Pool Booster via the new factory
          contract: cNewFactory,
          signature: "createPoolBoosterMerkl(address,bytes,uint256)",
          args: [
            "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", // AMM pool
            initData,
            1, // salt
          ],
        },
      ],
    };
  }
);
