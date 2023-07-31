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
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy", [
    [assetAddresses.AAVE_ADDRESS_PROVIDER, cVaultProxy.address],
  ]);
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
    "initialize(address[],address[],address[],address,address)";
  await withConfirmation(
    cAaveStrategy
      .connect(sDeployer)
      // eslint-disable-next-line no-unexpected-multiline
      [initFunctionName](
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
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy", [
    [addresses.dead, cVaultProxy.address],
  ]);
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

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ThreePoolStrategyProxy");
  const cThreePoolStrategyProxy = await ethers.getContract(
    "ThreePoolStrategyProxy"
  );

  const dThreePoolStrategy = await deployWithConfirmation("ThreePoolStrategy", [
    [assetAddresses.ThreePool, cVaultProxy.address],
  ]);
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

  await withConfirmation(
    cThreePoolStrategy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address[],address[],address[],address,address)"
    ]([assetAddresses.CRV], [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT], [assetAddresses.ThreePoolToken, assetAddresses.ThreePoolToken, assetAddresses.ThreePoolToken], assetAddresses.ThreePoolGauge, assetAddresses.CRVMinter)
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

  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ConvexStrategyProxy");
  const cConvexStrategyProxy = await ethers.getContract("ConvexStrategyProxy");

  const dConvexStrategy = await deployWithConfirmation("ConvexStrategy", [
    [assetAddresses.ThreePool, cVaultProxy.address],
  ]);
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
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");
  await withConfirmation(
    cConvexStrategy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address[],address[],address[],address,address,uint256)"
    ](
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

  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ConvexLUSDMetaStrategyProxy");
  const cConvexLUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexLUSDMetaStrategyProxy"
  );

  const dConvexLUSDMetaStrategy = await deployWithConfirmation(
    "ConvexGeneralizedMetaStrategy",
    [[assetAddresses.ThreePool, cVaultProxy.address]]
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
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");

  const LUSD = await ethers.getContract("MockLUSD");
  await withConfirmation(
    cConvexLUSDMetaStrategy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address[],address[],address[],(address,address,address,address,address,uint256))"
    ](
      [assetAddresses.CVX, assetAddresses.CRV],
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
      [
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolToken,
      ],
      [
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

  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ConvexOUSDMetaStrategyProxy");
  const cConvexOUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexOUSDMetaStrategyProxy"
  );

  const dConvexOUSDMetaStrategy = await deployWithConfirmation(
    "ConvexOUSDMetaStrategy",
    [[assetAddresses.ThreePool, cVaultProxy.address]]
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
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");
  const ousd = await ethers.getContract("OUSDProxy");

  await withConfirmation(
    cConvexOUSDMetaStrategy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address[],address[],address[],(address,address,address,address,address,uint256))"
    ](
      [assetAddresses.CVX, assetAddresses.CRV],
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
      [
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolToken,
      ],
      [
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
const configureVault = async () => {
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
    cVault.connect(sGovernor).supportAsset(assetAddresses.DAI, 0)
  );
  log("Added DAI asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDT, 0)
  );
  log("Added USDT asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDC, 0)
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
 * Configure OETH Vault by adding supported assets and Strategies.
 */
const configureOETHVault = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await ethers.getContractAt(
    "VaultInitializer",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );
  // Set up supported assets for Vault
  const { WETH, RETH, stETH, frxETH } = assetAddresses;
  for (const asset of [WETH, RETH, stETH, frxETH]) {
    await withConfirmation(cVault.connect(sGovernor).supportAsset(asset, 0));
  }
  log("Added assets to OETH Vault");

  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on OETH Vault");
  // Set Strategist address.
  await withConfirmation(
    cVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );
};

/**
 * Deploy Harvester
 */
const deployHarvesters = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  const dHarvesterProxy = await deployWithConfirmation(
    "HarvesterProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const dOETHHarvesterProxy = await deployWithConfirmation(
    "OETHHarvesterProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
  const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
  const dHarvester = await deployWithConfirmation("Harvester", [
    cVaultProxy.address,
    assetAddresses.USDT,
  ]);
  const dOETHHarvester = await deployWithConfirmation("OETHHarvester", [
    cOETHVaultProxy.address,
  ]);
  const cHarvester = await ethers.getContractAt(
    "Harvester",
    dHarvesterProxy.address
  );
  const cOETHHarvester = await ethers.getContractAt(
    "OETHHarvester",
    dOETHHarvesterProxy.address
  );
  await withConfirmation(
    cHarvesterProxy["initialize(address,address,bytes)"](
      dHarvester.address,
      deployerAddr,
      []
    )
  );
  await withConfirmation(
    cOETHHarvesterProxy["initialize(address,address,bytes)"](
      dOETHHarvester.address,
      deployerAddr,
      []
    )
  );
  log("Initialized OETHHarvesterProxy");

  await withConfirmation(
    cHarvester.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`Harvester transferGovernance(${governorAddr} called`);
  await withConfirmation(
    cOETHHarvester.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`OETHHarvester transferGovernance(${governorAddr} called`);

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

    await withConfirmation(
      cOETHHarvester
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for Harvester");

    await withConfirmation(
      cOETHHarvester
        .connect(sGovernor)
        .setRewardsProceedsAddress(cOETHVaultProxy.address)
    );
  }

  return [dHarvesterProxy, dOETHHarvesterProxy];
};

/**
 * Configure Strategies by setting the Harvester address
 */
const configureStrategies = async (harvesterProxy, oethHarvesterProxy) => {
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

  // OETH Strategies
  const fraxEthStrategyProxy = await ethers.getContract("FraxETHStrategyProxy");
  const fraxEthStrategy = await ethers.getContractAt(
    "FraxETHStrategy",
    fraxEthStrategyProxy.address
  );
  await withConfirmation(
    fraxEthStrategy
      .connect(sGovernor)
      .setHarvesterAddress(oethHarvesterProxy.address)
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
  await deployWithConfirmation("DripperProxy");
  // Deploy Dripper Proxy
  const cDripperProxy = await ethers.getContract("DripperProxy");
  await withConfirmation(
    cDripperProxy["initialize(address,address,bytes)"](
      dDripper.address,
      governorAddr,
      []
    )
  );
};

/**
 * Deploy FraxETHStrategy
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployFraxEthStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  const dFraxETHStrategyProxy = await deployWithConfirmation(
    "FraxETHStrategyProxy"
  );
  const cFraxETHStrategyProxy = await ethers.getContract(
    "FraxETHStrategyProxy"
  );
  const dFraxETHStrategy = await deployWithConfirmation("FraxETHStrategy", [
    [assetAddresses.sfrxETH, cOETHVaultProxy.address],
  ]);
  const cFraxETHStrategy = await ethers.getContractAt(
    "FraxETHStrategy",
    dFraxETHStrategyProxy.address
  );
  await withConfirmation(
    cFraxETHStrategyProxy["initialize(address,address,bytes)"](
      dFraxETHStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized FraxETHStrategyProxy");
  await withConfirmation(
    cFraxETHStrategy
      .connect(sDeployer)
      .initialize([], [assetAddresses.frxETH], [assetAddresses.sfrxETH])
  );
  log("Initialized FraxETHStrategy");
  await withConfirmation(
    cFraxETHStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`FraxETHStrategy transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cFraxETHStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for FraxETHStrategy");
  }
  return cFraxETHStrategy;
};

/**
 * Deploy the OracleRouter and initialise it with Chainlink sources.
 */
const deployOracles = async () => {
  const { deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // TODO: Change this to intelligently decide which router contract to deploy?
  const oracleContract = isMainnet ? "OracleRouter" : "MockOracleRouter";
  await deployWithConfirmation("OracleRouter", [], oracleContract);
  const oracleRouter = await ethers.getContract("OracleRouter");

  // Register feeds
  // Not needed in production
  const oracleAddresses = await getOracleAddresses(deployments);
  const assetAddresses = await getAssetAddresses(deployments);
  /* Mock oracle feeds report 0 for updatedAt data point. Set
   * maxStaleness to 100 years from epoch to make the Oracle
   * feeds valid
   */
  const maxStaleness = 24 * 60 * 60 * 365 * 100;

  const oracleFeeds = [
    [assetAddresses.DAI, oracleAddresses.chainlink.DAI_USD],
    [assetAddresses.USDC, oracleAddresses.chainlink.USDC_USD],
    [assetAddresses.USDT, oracleAddresses.chainlink.USDT_USD],
    [assetAddresses.TUSD, oracleAddresses.chainlink.TUSD_USD],
    [assetAddresses.COMP, oracleAddresses.chainlink.COMP_USD],
    [assetAddresses.AAVE, oracleAddresses.chainlink.AAVE_USD],
    [assetAddresses.CRV, oracleAddresses.chainlink.CRV_USD],
    [assetAddresses.CVX, oracleAddresses.chainlink.CVX_USD],
    [assetAddresses.RETH, oracleAddresses.chainlink.RETH_ETH],
    [assetAddresses.WETH, oracleAddresses.chainlink.WETH_ETH],
    [addresses.mainnet.WETH, oracleAddresses.chainlink.WETH_ETH],
    [assetAddresses.stETH, oracleAddresses.chainlink.STETH_ETH],
    [assetAddresses.frxETH, oracleAddresses.chainlink.FRXETH_ETH],
    [
      assetAddresses.NonStandardToken,
      oracleAddresses.chainlink.NonStandardToken_USD,
    ],
  ];

  for (const [asset, oracle] of oracleFeeds) {
    await withConfirmation(
      oracleRouter.connect(sDeployer).setFeed(asset, oracle, maxStaleness)
    );
  }
};

/**
 * Deploy the core contracts (Vault and OUSD).
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
  await deployWithConfirmation("OETHProxy");
  await deployWithConfirmation("OETHVaultProxy");

  // Main contracts
  const dOUSD = await deployWithConfirmation("OUSD");
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  const dOETH = await deployWithConfirmation("OETH");
  const dOETHVault = await deployWithConfirmation("OETHVault");

  await deployWithConfirmation("Governor", [governorAddr, 60]);

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cOracleRouter = await ethers.getContract("OracleRouter");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);
  const cOETHOracleRouter = isMainnet
    ? await ethers.getContract("OETHOracleRouter")
    : cOracleRouter;
  const cOETHVault = await ethers.getContractAt(
    "Vault",
    cOETHVaultProxy.address
  );

  await withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSDProxy");

  await withConfirmation(
    cOETHProxy["initialize(address,address,bytes)"](
      dOETH.address,
      governorAddr,
      []
    )
  );
  log("Initialized OETHProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized OETHVaultProxy");
  await withConfirmation(
    cOETHVaultProxy["initialize(address,address,bytes)"](
      dOETHVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized OETHVaultProxy");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .initialize(cOracleRouter.address, cOUSDProxy.address)
  );
  log("Initialized Vault");
  await withConfirmation(
    cOETHVault
      .connect(sGovernor)
      .initialize(cOETHOracleRouter.address, cOETHProxy.address)
  );
  log("Initialized OETHVault");

  await withConfirmation(
    cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  await withConfirmation(
    cOETHVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  await withConfirmation(
    cOETHVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  log("Initialized VaultAdmin implementation");

  // Initialize OUSD
  /* Set the original resolution to 27 decimals. We used to have it set to 18
   * decimals at launch and then migrated to 27. Having it set to 27 it will
   * make unit tests run at that resolution that more closely mimics mainnet
   * behaviour.
   *
   * Another reason:
   * Testing Vault value checker with small changes in Vault value and supply
   * was behaving incorrectly because the rounding error that is present with
   * 18 decimal point resolution, which was interfering with unit test correctness.
   * Possible solutions were:
   *  - scale up unit test values so rounding error isn't a problem
   *  - have unit test run in 27 decimal point rebasingCreditsPerToken resolution
   *
   * Latter seems more fitting - due to mimicking production better as already mentioned.
   */
  const resolution = ethers.utils.parseUnits("1", 27);
  await withConfirmation(
    cOUSD
      .connect(sGovernor)
      .initialize("Origin Dollar", "OUSD", cVaultProxy.address, resolution)
  );
  log("Initialized OUSD");

  await withConfirmation(
    cOETH
      .connect(sGovernor)
      .initialize("Origin Ether", "OETH", cOETHVaultProxy.address, resolution)
  );
  log("Initialized OETH");
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

  // Deploy proxy and implementation
  const dBuybackProxy = await deployWithConfirmation("BuybackProxy");
  const dBuybackImpl = await deployWithConfirmation("Buyback");

  const cBuybackProxy = await ethers.getContractAt(
    "BuybackProxy",
    dBuybackProxy.address
  );

  // Init proxy to implementation
  await withConfirmation(
    cBuybackProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dBuybackImpl.address, deployerAddr, [])
  );

  const cBuyback = await ethers.getContractAt("Buyback", cBuybackProxy.address);

  // Initialize implementation contract
  const initFunction =
    "initialize(address,address,address,address,address,address,address,address,uint256)";
  await withConfirmation(
    cBuyback.connect(sDeployer)[initFunction](
      assetAddresses.uniswapRouter,
      strategistAddr,
      strategistAddr, // Treasury manager
      ousd.address,
      assetAddresses.OGV,
      assetAddresses.USDT,
      assetAddresses.WETH,
      assetAddresses.RewardsSource,
      "5000" // 50%
    )
  );

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
  await deployWithConfirmation("WrappedOUSDProxy");
  const wousdProxy = await ethers.getContract("WrappedOUSDProxy");
  const wousd = await ethers.getContractAt("WrappedOusd", wousdProxy.address);

  await wousdProxy.connect(sDeployer)[
    // eslint-disable-next-line no-unexpected-multiline
    "initialize(address,address,bytes)"
  ](dWrappedOusdImpl.address, deployerAddr, []);
  await wousd.connect(sDeployer)["initialize()"]();
  await wousd.connect(sDeployer).transferGovernance(governorAddr);
  await wousd.connect(sGovernor).claimGovernance();
};

const deployOETHSwapper = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const assetAddresses = await getAssetAddresses(deployments);

  const vaultProxy = await ethers.getContract("OETHVaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  const mockSwapper = await ethers.getContract("MockSwapper");

  await deployWithConfirmation("Swapper1InchV5");
  const cSwapper = await ethers.getContract("Swapper1InchV5");

  cSwapper
    .connect(sDeployer)
    .approveAssets([
      assetAddresses.RETH,
      assetAddresses.stETH,
      assetAddresses.WETH,
      assetAddresses.frxETH,
    ]);

  await vault.connect(sGovernor).setSwapper(mockSwapper.address);
  await vault.connect(sGovernor).setSwapAllowedUndervalue(100);

  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.RETH, 200);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.stETH, 70);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.WETH, 20);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.frxETH, 20);
};

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
  await deployFraxEthStrategy();
  const [harvesterProxy, oethHarvesterProxy] = await deployHarvesters();
  await configureVault();
  await configureOETHVault();
  await configureStrategies(harvesterProxy, oethHarvesterProxy);
  await deployDripper();
  await deployFlipper();
  await deployBuyback();
  await deployUniswapV3Pool();
  await deployVaultValueChecker();
  await deployWOusd();
  await deployOETHSwapper();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];
main.tags = ["unit_tests"];
main.skip = () => isFork;

module.exports = main;
