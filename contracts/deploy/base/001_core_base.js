const addresses = require("../../utils/addresses.js");
const hre = require("hardhat");
const { BigNumber, utils } = require("ethers");
const {
  getAssetAddresses,
  isFork,
  fundAccount,
} = require("../../test/helpers.js");
const { deployOnBaseWithGuardian } = require("../../utils/delpoy-l2.js");

// 5/8 multisig
const guardianAddr = addresses.base.governor;

module.exports = deployOnBaseWithGuardian(
  { deployName: "001_core_base" },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    let actions = [];
    if (isFork) {
      await fundAccount(guardianAddr);
    }
    const coreActions = await deployCore({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    actions = actions.concat(coreActions);

    await deployDripper({ deployWithConfirmation, withConfirmation, ethers });

    const harvesterActions = await deployHarvester({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    actions = actions.concat(harvesterActions);

    // Governance Actions
    // ----------------
    return {
      name: "Deploy OETH Vault, Dripper and Harvester",
      actions,
    };
  }
);

/**
 * Deploy the core contracts (Vault and OETH).
 */
const deployCore = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr, strategistAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const assetAddresses = await getAssetAddresses(hre.deployments);
  console.log(
    `Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`
  );

  // Proxies
  await deployWithConfirmation("OETHVaultProxy");
  await deployWithConfirmation("OETHProxy");

  //await deployWithConfirmation("OETHOracleRouter");
  await deployWithConfirmation(
    "PriceFeedPair",
    [
      addresses.base.aeroUsdPriceFeed,
      addresses.base.ethUsdPriceFeed,
      false,
      true,
    ],
    "PriceFeedPair"
  );
  const priceFeedPair = await ethers.getContract("PriceFeedPair");
  const oracleContract = "BaseOETHOracleRouter";
  const contractName = "BaseOETHOracleRouter";
  const args = [priceFeedPair.address];

  await deployWithConfirmation(contractName, args, oracleContract);

  // Main contracts
  const dOETH = await deployWithConfirmation("OETH");
  /* We have wrapper contracts for all of the contracts that are shared between the
   * protocols. The reason for that is that we want separate deployment artifacts and
   * separate storage slot layouts for these shared contracts.
   */
  const dVault = await deployWithConfirmation("OETHVault", null, null, false);
  const dVaultCore = await deployWithConfirmation("OETHVaultCore", [
    assetAddresses.WETH,
  ]);
  const dVaultAdmin = await deployWithConfirmation("OETHVaultAdmin");

  // Get contract instances
  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);
  const cOETHOracleRouter = await ethers.getContract("BaseOETHOracleRouter");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

  await withConfirmation(
    cOETHProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dOETH.address, deployerAddr, [])
  );
  console.log("Initialized OETHProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dVault.address, deployerAddr, [])
  );
  console.log("Initialized OETHVaultProxy");

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .initialize(cOETHOracleRouter.address, cOETHProxy.address)
  );
  console.log("Initialized OETHVault");

  await withConfirmation(
    cVaultProxy.connect(sDeployer).upgradeTo(dVaultCore.address)
  );
  console.log("Upgraded OETHVaultCore implementation");

  await withConfirmation(
    cVault.connect(sDeployer).setAdminImpl(dVaultAdmin.address)
  );

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAutoAllocateThreshold(utils.parseUnits("25", 18))
  );

  await withConfirmation(cOETHOracleRouter.cacheDecimals(assetAddresses.AERO));

  await withConfirmation(
    cVault.connect(sDeployer).setRebaseThreshold(utils.parseUnits("5", 18))
  );

  await withConfirmation(
    cVault.connect(sDeployer).setStrategistAddr(strategistAddr)
  );

  await withConfirmation(
    cVault.connect(sDeployer).setTrusteeAddress(strategistAddr)
  );

  await withConfirmation(
    cVault.connect(sDeployer).setTrusteeFeeBps(0) // 0%
  );

  await withConfirmation(cVault.connect(sDeployer).unpauseCapital());

  await withConfirmation(
    // 0 stands for DECIMAL unit conversion
    cVault.connect(sDeployer).supportAsset(assetAddresses.WETH, 0)
  );

  console.log("Initialized OETHVaultAdmin implementation");

  await withConfirmation(
    cOETHProxy.connect(sDeployer).transferGovernance(guardianAddr)
  );
  await withConfirmation(
    cVaultProxy.connect(sDeployer).transferGovernance(guardianAddr)
  );

  console.log("Governance transfer initialized");

  // return actions to be executed by the Governor
  return [
    {
      // Claim Vault governance
      contract: cVaultProxy,
      signature: "claimGovernance()",
      args: [],
    },
    {
      // Claim OETH governance
      contract: cOETHProxy,
      signature: "claimGovernance()",
      args: [],
    },
    {
      // Upgrade OETH proxy
      contract: cOETHProxy,
      signature: "upgradeTo(address)",
      args: [dOETH.address],
    },
    {
      // Initialize OETH in the proxy storage slot space
      contract: cOETH,
      signature: "initialize(string,string,address,uint256)",
      // TODO: Verify name is ok
      args: [
        "OETH Base",
        "OETHbase",
        cVaultProxy.address,
        utils.parseUnits("1", 27).sub(BigNumber.from(1)),
      ],
    },
  ];
};

const deployDripper = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const assetAddresses = await getAssetAddresses(deployments);
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");

  // Deploy Dripper Impl
  const dDripper = await deployWithConfirmation("OETHDripper", [
    cVaultProxy.address,
    assetAddresses.WETH,
  ]);
  await deployWithConfirmation("OETHDripperProxy");
  // Deploy Dripper Proxy
  const cDripperProxy = await ethers.getContract("OETHDripperProxy");
  await withConfirmation(
    cDripperProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dDripper.address, guardianAddr, [])
  );
};

const deployHarvester = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cDripper = await ethers.getContract("OETHDripperProxy");

  const dOETHBaseHarvesterProxy = await deployWithConfirmation(
    "OETHBaseHarvesterProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cOETHBaseHarvesterProxy = await ethers.getContract(
    "OETHBaseHarvesterProxy"
  );

  const dOETHBaseHarvester = await deployWithConfirmation("OETHBaseHarvester", [
    cOETHVaultProxy.address,
    assetAddresses.WETH,
  ]);

  const cOETHBaseHarvester = await ethers.getContractAt(
    "OETHBaseHarvester",
    dOETHBaseHarvesterProxy.address
  );
  await withConfirmation(
    cOETHBaseHarvesterProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dOETHBaseHarvester.address, deployerAddr, [])
  );
  console.log("Initialized OETHBaseHarvesterProxy");

  await withConfirmation(
    cOETHBaseHarvesterProxy.connect(sDeployer).transferGovernance(guardianAddr)
  );

  console.log("Governance transfer initialized");

  const abiCoder = ethers.utils.defaultAbiCoder;
  const type = {
    type: "tuple[]",
    name: "Route",
    components: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "stable", type: "bool" },
      { name: "factory", type: "address" },
    ],
  };

  // data for encoding
  const routes = [
    {
      from: addresses.base.aeroTokenAddress,
      to: addresses.base.wethTokenAddress,
      stable: true,
      factory: addresses.base.aeroFactoryAddress,
    },
  ];
  const encodedRoute = abiCoder.encode([type], [routes]);

  return [
    {
      // Claim governance
      contract: cOETHBaseHarvesterProxy,
      signature: "claimGovernance()",
      args: [],
    },
    {
      // Set reward token config
      contract: cOETHBaseHarvester,
      signature:
        "setRewardTokenConfig(address,(uint16,uint16,address,bool,uint8,uint256),bytes)",
      args: [
        assetAddresses.AERO,
        {
          allowedSlippageBps: 800,
          harvestRewardBps: 100,
          swapPlatform: 0, // Aerodrome
          swapPlatformAddr: addresses.base.aeroRouterAddress,
          liquidationLimit: 0,
          doSwapRewardToken: true,
        },
        encodedRoute,
      ],
    },
    {
      // Set reward proceeds
      contract: cOETHBaseHarvester,
      signature: "setRewardProceedsAddress(address)",
      args: [cDripper.address],
    },
    {
      // Set performance fee receiver address
      contract: cOETHBaseHarvester,
      signature: "setPerformanceFeeReceiver(address)",
      args: [guardianAddr],
    },
    {
      // Set performance fee bps
      contract: cOETHBaseHarvester,
      signature: "setPerformanceFeeBps(uint256)",
      args: [2000], //20%
    },
  ];
};
