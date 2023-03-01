const hre = require("hardhat");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");
const {
  metapoolLPCRVPid,
  lusdMetapoolLPCRVPid,
} = require("../utils/constants");

/**
 * Deploy AAVE Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dAaveStrategyProxy = await deployWithConfirmation(
    "AaveStrategyProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    dAaveStrategyProxy.address
  );
  await withConfirmation(
    cAaveStrategyProxy["initialize(address,address,bytes)"](
      dAaveStrategy.address,
      deployerAddr,
      []
    )
  );

  const cAaveIncentivesController = await ethers.getContract(
    "MockAaveIncentivesController"
  );

  log("Initialized AaveStrategyProxy");
  const initFunctionName =
    "initialize(address,address,address[],address[],address[],address,address)";
  await withConfirmation(
    cAaveStrategy
      .connect(sDeployer)
      [initFunctionName](
        assetAddresses.AAVE_ADDRESS_PROVIDER,
        cVaultProxy.address,
        [assetAddresses.AAVE_TOKEN],
        [assetAddresses.DAI],
        [assetAddresses.aDAI],
        cAaveIncentivesController.address,
        assetAddresses.STKAAVE
      )
  );
  log("Initialized AaveStrategy");
  await withConfirmation(
    cAaveStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`AaveStrategy transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cAaveStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for AaveStrategy");
  }

  return cAaveStrategy;
};

/**
 * Deploy Compound Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployCompoundStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dCompoundStrategyProxy = await deployWithConfirmation(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    dCompoundStrategyProxy.address
  );
  await withConfirmation(
    cCompoundStrategyProxy["initialize(address,address,bytes)"](
      dCompoundStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized CompoundStrategyProxy");
  await withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .initialize(
        addresses.dead,
        cVaultProxy.address,
        [assetAddresses.COMP],
        [assetAddresses.DAI],
        [assetAddresses.cDAI]
      )
  );
  log("Initialized CompoundStrategy");
  await withConfirmation(
    cCompoundStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`CompoundStrategy transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cCompoundStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for CompoundStrategy");
  }
  return cCompoundStrategy;
};

/**
 * Deploys a 3pool Strategy which supports USDC, USDT and DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 */
const deployThreePoolStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deployWithConfirmation("ThreePoolStrategyProxy");
  const cThreePoolStrategyProxy = await ethers.getContract(
    "ThreePoolStrategyProxy"
  );

  const dThreePoolStrategy = await deployWithConfirmation("ThreePoolStrategy");
  const cThreePoolStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    cThreePoolStrategyProxy.address
  );

  await withConfirmation(
    cThreePoolStrategyProxy["initialize(address,address,bytes)"](
      dThreePoolStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized ThreePoolStrategyProxy");

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await withConfirmation(
    cThreePoolStrategy
      .connect(sDeployer)
      [
        "initialize(address,address,address[],address[],address[],address,address)"
      ](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        [assetAddresses.CRV],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        assetAddresses.ThreePoolGauge,
        assetAddresses.CRVMinter
      )
  );
  log("Initialized ThreePoolStrategy");

  await withConfirmation(
    cThreePoolStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`ThreePoolStrategy transferGovernance(${governorAddr}) called`);
  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cThreePoolStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for ThreePoolStrategy");
  }

  return cThreePoolStrategy;
};

/**
 * Deploys a Convex Strategy which supports USDC, USDT and DAI.
 */
const deployConvexStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deployWithConfirmation("ConvexStrategyProxy");
  const cConvexStrategyProxy = await ethers.getContract("ConvexStrategyProxy");

  const dConvexStrategy = await deployWithConfirmation("ConvexStrategy");
  const cConvexStrategy = await ethers.getContractAt(
    "ConvexStrategy",
    cConvexStrategyProxy.address
  );

  await withConfirmation(
    cConvexStrategyProxy["initialize(address,address,bytes)"](
      dConvexStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized ConvexStrategyProxy");

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");
  await withConfirmation(
    cConvexStrategy
      .connect(sDeployer)
      [
        "initialize(address,address,address[],address[],address[],address,address,uint256)"
      ](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        [assetAddresses.CRV, assetAddresses.CVX],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        mockBooster.address, // _cvxDepositorAddress,
        mockRewardPool.address, // _cvxRewardStakerAddress,
        9 // _cvxDepositorPTokenId
      )
  );
  log("Initialized ConvexStrategy");

  await withConfirmation(
    cConvexStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`ConvexStrategy transferGovernance(${governorAddr}) called`);
  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cConvexStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for ConvexStrategy");
  }
  return cConvexStrategy;
};

/**
 * Deploys a Convex Generalized Meta Strategy with LUSD token configuration
 */
const deployConvexLUSDMetaStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deployWithConfirmation("ConvexLUSDMetaStrategyProxy");
  const cConvexLUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexLUSDMetaStrategyProxy"
  );

  const dConvexLUSDMetaStrategy = await deployWithConfirmation(
    "ConvexGeneralizedMetaStrategy"
  );
  const cConvexLUSDMetaStrategy = await ethers.getContractAt(
    "ConvexGeneralizedMetaStrategy",
    cConvexLUSDMetaStrategyProxy.address
  );

  await withConfirmation(
    cConvexLUSDMetaStrategyProxy["initialize(address,address,bytes)"](
      dConvexLUSDMetaStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized ConvexLUSDMetaStrategyProxy");

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");

  const LUSD = await ethers.getContract("MockLUSD");
  await withConfirmation(
    cConvexLUSDMetaStrategy
      .connect(sDeployer)
      [
        "initialize(address[],address[],address[],(address,address,address,address,address,address,address,uint256))"
      ](
        [assetAddresses.CVX, assetAddresses.CRV],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        [
          assetAddresses.ThreePool,
          cVaultProxy.address,
          mockBooster.address, // _cvxDepositorAddress,
          assetAddresses.ThreePoolLUSDMetapool, // metapool address,
          LUSD.address, // LUSD
          mockRewardPool.address, // _cvxRewardStakerAddress,
          assetAddresses.LUSDMetapoolToken, // metapoolLpToken
          lusdMetapoolLPCRVPid, // _cvxDepositorPTokenId
        ]
      )
  );
  log("Initialized ConvexLUSDMetaStrategy");

  await withConfirmation(
    cConvexLUSDMetaStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`ConvexLUSDMetaStrategy transferGovernance(${governorAddr}) called`);
  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cConvexLUSDMetaStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for ConvexLUSDMetaStrategy");
  }
  return cConvexLUSDMetaStrategy;
};

/**
 * Deploys a Convex Meta Strategy which supports OUSD / 3Crv
 */
const deployConvexOUSDMetaStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deployWithConfirmation("ConvexOUSDMetaStrategyProxy");
  const cConvexOUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexOUSDMetaStrategyProxy"
  );

  const dConvexOUSDMetaStrategy = await deployWithConfirmation(
    "ConvexOUSDMetaStrategy"
  );
  const cConvexOUSDMetaStrategy = await ethers.getContractAt(
    "ConvexOUSDMetaStrategy",
    cConvexOUSDMetaStrategyProxy.address
  );

  await withConfirmation(
    cConvexOUSDMetaStrategyProxy["initialize(address,address,bytes)"](
      dConvexOUSDMetaStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized ConvexOUSDMetaStrategyProxy");

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");
  const ousd = await ethers.getContract("OUSDProxy");

  await withConfirmation(
    cConvexOUSDMetaStrategy
      .connect(sDeployer)
      [
        "initialize(address[],address[],address[],(address,address,address,address,address,address,address,uint256))"
      ](
        [assetAddresses.CVX, assetAddresses.CRV],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        [
          assetAddresses.ThreePool,
          cVaultProxy.address,
          mockBooster.address, // _cvxDepositorAddress,
          assetAddresses.ThreePoolOUSDMetapool, // metapool address,
          ousd.address, // _ousdAddress,
          mockRewardPool.address, // _cvxRewardStakerAddress,
          assetAddresses.ThreePoolOUSDMetapool, // metapoolLpToken (metapool address),
          metapoolLPCRVPid, // _cvxDepositorPTokenId
        ]
      )
  );
  log("Initialized ConvexOUSDMetaStrategy");

  await withConfirmation(
    cConvexOUSDMetaStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`ConvexOUSDMetaStrategy transferGovernance(${governorAddr}) called`);
  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cConvexOUSDMetaStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for ConvexOUSDMetaStrategy");
  }
  return cConvexOUSDMetaStrategy;
};

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async (harvesterProxy) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await ethers.getContractAt(
    "VaultInitializer",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  // Set up supported assets for Vault
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.DAI)
  );
  log("Added DAI asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDT)
  );
  log("Added USDT asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDC)
  );
  log("Added USDC asset to Vault");
  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on Vault");
  // Set Strategist address.
  await withConfirmation(
    cVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );
};

/**
 * Deploy Harvester
 */
const deployHarvester = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dHarvesterProxy = await deployWithConfirmation(
    "HarvesterProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
  const dHarvester = await deployWithConfirmation("Harvester", [
    cVaultProxy.address,
    assetAddresses.USDT,
  ]);
  const cHarvester = await ethers.getContractAt(
    "Harvester",
    dHarvesterProxy.address
  );
  await withConfirmation(
    cHarvesterProxy["initialize(address,address,bytes)"](
      dHarvester.address,
      deployerAddr,
      []
    )
  );

  log("Initialized HarvesterProxy");

  await withConfirmation(
    cHarvester.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`Harvester transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cHarvester
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for Harvester");

    await withConfirmation(
      cHarvester
        .connect(sGovernor)
        .setRewardsProceedsAddress(cVaultProxy.address)
    );
  }

  return dHarvesterProxy;
};

/**
 * Configure Strategies by setting the Harvester address
 */
const configureStrategies = async (harvesterProxy) => {
  const { governorAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const compoundProxy = await ethers.getContract("CompoundStrategyProxy");
  const compound = await ethers.getContractAt(
    "CompoundStrategy",
    compoundProxy.address
  );
  await withConfirmation(
    compound.connect(sGovernor).setHarvesterAddress(harvesterProxy.address)
  );

  const aaveProxy = await ethers.getContract("AaveStrategyProxy");
  const aave = await ethers.getContractAt("AaveStrategy", aaveProxy.address);
  await withConfirmation(
    aave.connect(sGovernor).setHarvesterAddress(harvesterProxy.address)
  );

  const convexProxy = await ethers.getContract("ConvexStrategyProxy");
  const convex = await ethers.getContractAt(
    "ConvexStrategy",
    convexProxy.address
  );
  await withConfirmation(
    convex.connect(sGovernor).setHarvesterAddress(harvesterProxy.address)
  );

  const OUSDmetaStrategyProxy = await ethers.getContract(
    "ConvexOUSDMetaStrategyProxy"
  );
  const metaStrategy = await ethers.getContractAt(
    "ConvexOUSDMetaStrategy",
    OUSDmetaStrategyProxy.address
  );
  await withConfirmation(
    metaStrategy.connect(sGovernor).setHarvesterAddress(harvesterProxy.address)
  );

  const LUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexLUSDMetaStrategyProxy"
  );
  const LUSDMetaStrategy = await ethers.getContractAt(
    "ConvexGeneralizedMetaStrategy",
    LUSDMetaStrategyProxy.address
  );
  await withConfirmation(
    LUSDMetaStrategy.connect(sGovernor).setHarvesterAddress(
      harvesterProxy.address
    )
  );

  const threePoolProxy = await ethers.getContract("ThreePoolStrategyProxy");
  const threePool = await ethers.getContractAt(
    "ThreePoolStrategy",
    threePoolProxy.address
  );
  await withConfirmation(
    threePool.connect(sGovernor).setHarvesterAddress(harvesterProxy.address)
  );

  const uniV3UsdcUsdtProxy = await ethers.getContract("UniV3_USDC_USDT_Proxy");
  const uniV3UsdcUsdt = await ethers.getContractAt(
    "GeneralizedUniswapV3Strategy",
    uniV3UsdcUsdtProxy.address
  );
  await withConfirmation(
    uniV3UsdcUsdt.connect(sGovernor).setHarvesterAddress(harvesterProxy.address)
  );
};

const deployDripper = async () => {
  const { governorAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  const cVaultProxy = await ethers.getContract("VaultProxy");

  // Deploy Dripper Impl
  const dDripper = await deployWithConfirmation("Dripper", [
    cVaultProxy.address,
    assetAddresses.USDT,
  ]);
  const dDripperProxy = await deployWithConfirmation("DripperProxy");
  // Deploy Dripper Proxy
  cDripperProxy = await ethers.getContract("DripperProxy");
  await withConfirmation(
    cDripperProxy["initialize(address,address,bytes)"](
      dDripper.address,
      governorAddr,
      []
    )
  );
};

/**
 * Deploy the OracleRouter and initialise it with Chainlink sources.
 */
const deployOracles = async () => {
  const { deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // TODO: Change this to intelligently decide which router contract to deploy?
  const oracleContract = isMainnet ? "OracleRouter" : "OracleRouterDev";
  await deployWithConfirmation("OracleRouter", [], oracleContract);
  const oracleRouter = await ethers.getContract("OracleRouter");

  // Register feeds
  // Not needed in production
  const oracleAddresses = await getOracleAddresses(deployments);
  const assetAddresses = await getAssetAddresses(deployments);
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.DAI, oracleAddresses.chainlink.DAI_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.USDC, oracleAddresses.chainlink.USDC_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.USDT, oracleAddresses.chainlink.USDT_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.TUSD, oracleAddresses.chainlink.TUSD_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.COMP, oracleAddresses.chainlink.COMP_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.AAVE, oracleAddresses.chainlink.AAVE_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.CRV, oracleAddresses.chainlink.CRV_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.CVX, oracleAddresses.chainlink.CVX_USD)
  );
  withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(
        assetAddresses.NonStandardToken,
        oracleAddresses.chainlink.NonStandardToken_USD
      )
  );
};

/**
 * Deploy the core contracts (Vault and OUSD).
 *
 */
const deployCore = async () => {
  const { governorAddr } = await hre.getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  await deployWithConfirmation("OUSDProxy");
  await deployWithConfirmation("VaultProxy");

  // Main contracts
  const dOUSD = await deployWithConfirmation("OUSD");
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  await deployWithConfirmation("Governor", [governorAddr, 60]);

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cOracleRouter = await ethers.getContract("OracleRouter");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  await withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSDProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized VaultProxy");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .initialize(cOracleRouter.address, cOUSDProxy.address)
  );
  log("Initialized Vault");

  await withConfirmation(
    cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  log("Initialized VaultAdmin implementation");

  // Initialize OUSD
  await withConfirmation(
    cOUSD
      .connect(sGovernor)
      .initialize("Origin Dollar", "OUSD", cVaultProxy.address)
  );

  log("Initialized OUSD");
};

// deploy curve metapool mocks
const deployCurveMetapoolMocks = async () => {
  const ousd = await ethers.getContract("OUSDProxy");
  const { deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  await hre.deployments.deploy("MockCurveMetapool", {
    from: deployerAddr,
    args: [[ousd.address, assetAddresses.ThreePoolToken]],
  });

  const metapoolToken = await ethers.getContract("MockCurveMetapool");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(metapoolLPCRVPid, metapoolToken.address);
};

// deploy curve metapool mocks
const deployCurveLUSDMetapoolMocks = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  const LUSD = await ethers.getContract("MockLUSD");

  await hre.deployments.deploy("MockCurveLUSDMetapool", {
    from: deployerAddr,
    args: [[LUSD.address, assetAddresses.ThreePoolToken]],
  });

  const LUSDMetapoolToken = await ethers.getContract("MockCurveLUSDMetapool");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(lusdMetapoolLPCRVPid, LUSDMetapoolToken.address);
};

// Deploy the Flipper trading contract
const deployFlipper = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await hre.getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const ousd = await ethers.getContract("OUSDProxy");

  await deployWithConfirmation("Flipper", [
    assetAddresses.DAI,
    ousd.address,
    assetAddresses.USDC,
    assetAddresses.USDT,
  ]);
  const flipper = await ethers.getContract("Flipper");
  await withConfirmation(flipper.transferGovernance(governorAddr));
  await withConfirmation(flipper.connect(sGovernor).claimGovernance());
};

// create Uniswap V3 OUSD - USDT pool
const deployUniswapV3Pool = async () => {
  const ousd = await ethers.getContract("OUSDProxy");
  const assetAddresses = await getAssetAddresses(deployments);
  const MockUniswapV3Factory = await ethers.getContract("MockUniswapV3Factory");

  await MockUniswapV3Factory.createPool(assetAddresses.USDT, ousd.address, 500);

  await MockUniswapV3Factory.createPool(
    assetAddresses.USDT,
    assetAddresses.DAI,
    500
  );

  await MockUniswapV3Factory.createPool(
    assetAddresses.USDT,
    assetAddresses.USDC,
    500
  );
};

const deployBuyback = async () => {
  const { deployerAddr, governorAddr, strategistAddr } =
    await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const assetAddresses = await getAssetAddresses(deployments);
  const ousd = await ethers.getContract("OUSDProxy");
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );

  await deployWithConfirmation("Buyback", [
    assetAddresses.uniswapRouter,
    strategistAddr,
    ousd.address,
    assetAddresses.OGV,
    assetAddresses.USDT,
    assetAddresses.WETH,
    assetAddresses.RewardsSource,
  ]);
  const cBuyback = await ethers.getContract("Buyback");

  await withConfirmation(
    cBuyback.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`Buyback transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cBuyback
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for Buyback");

    await cVault.connect(sGovernor).setTrusteeAddress(cBuyback.address);
    log("Buyback set as Vault trustee");
  }
  return cBuyback;
};

const deployVaultValueChecker = async () => {
  const vault = await ethers.getContract("VaultProxy");
  const ousd = await ethers.getContract("OUSDProxy");

  await deployWithConfirmation("VaultValueChecker", [
    vault.address,
    ousd.address,
  ]);
};

const deployWOusd = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const ousd = await ethers.getContract("OUSDProxy");
  const dWrappedOusdImpl = await deployWithConfirmation("WrappedOusd", [
    ousd.address,
    "Wrapped OUSD IMPL",
    "WOUSD IMPL",
  ]);
  const dWrappedOusdProxy = await deployWithConfirmation("WrappedOUSDProxy");
  const wousdProxy = await ethers.getContract("WrappedOUSDProxy");
  const wousd = await ethers.getContractAt("WrappedOusd", wousdProxy.address);

  await wousdProxy
    .connect(sDeployer)
    ["initialize(address,address,bytes)"](
      dWrappedOusdImpl.address,
      deployerAddr,
      []
    );
  await wousd.connect(sDeployer)["initialize()"]();
  await wousd.connect(sDeployer).transferGovernance(governorAddr);
  await wousd.connect(sGovernor).claimGovernance();
};

const deployUniswapV3Strategy = async () => {
  const { deployerAddr, governorAddr, operatorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const vault = await ethers.getContract("VaultProxy");
  const pool = await ethers.getContract("MockUniswapV3Pool");
  const manager = await ethers.getContract("MockNonfungiblePositionManager");
  const compStrat = await ethers.getContract("CompoundStrategyProxy");
  const v3Helper = await ethers.getContract("MockUniswapV3Helper");

  const uniV3UsdcUsdtImpl = await deployWithConfirmation("UniV3_USDC_USDT_Strategy", [], "GeneralizedUniswapV3Strategy");
  await deployWithConfirmation("UniV3_USDC_USDT_Proxy");
  const uniV3UsdcUsdtProxy = await ethers.getContract("UniV3_USDC_USDT_Proxy");

  await withConfirmation(
    uniV3UsdcUsdtProxy["initialize(address,address,bytes)"](
      uniV3UsdcUsdtImpl.address,
      deployerAddr,
      []
    )
  );
  log("Initialized UniV3_USDC_USDT_Proxy");

  const uniV3UsdcUsdtStrat = await ethers.getContractAt("GeneralizedUniswapV3Strategy", uniV3UsdcUsdtProxy.address);
  await withConfirmation(
    uniV3UsdcUsdtStrat.connect(sDeployer)
      ["initialize(address,address,address,address,address,address,address)"](
        vault.address,
        pool.address,
        manager.address,
        compStrat.address,
        compStrat.address,
        operatorAddr,
        v3Helper.address
      )
  );
  log("Initialized UniV3_USDC_USDT_Strategy");

  await withConfirmation(
    uniV3UsdcUsdtStrat.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`UniV3_USDC_USDT_Strategy transferGovernance(${governorAddr}) called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      uniV3UsdcUsdtStrat
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for UniV3_USDC_USDT_Strategy");
  }

  return uniV3UsdcUsdtStrat;
}

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();
  await deployCurveMetapoolMocks();
  await deployCurveLUSDMetapoolMocks();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await deployThreePoolStrategy();
  await deployConvexStrategy();
  await deployConvexOUSDMetaStrategy();
  await deployConvexLUSDMetaStrategy();
  await deployUniswapV3Strategy();
  const harvesterProxy = await deployHarvester();
  await configureVault(harvesterProxy);
  await configureStrategies(harvesterProxy);
  await deployDripper();
  await deployFlipper();
  await deployBuyback();
  await deployUniswapV3Pool();
  await deployVaultValueChecker();
  await deployWOusd();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];
main.skip = () => isFork;

module.exports = main;
