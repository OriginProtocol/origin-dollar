const hre = require("hardhat");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isFork,
  isMainnetOrFork,
} = require("../test/helpers.js");
const { deployWithConfirmation, withConfirmation } = require("../utils/deploy");
const {
  convex_3CRV_PID,
  convex_OUSD_3CRV_PID,
  convex_LUSD_3CRV_PID,
  convex_frxETH_WETH_PID,
  convex_OETH_ETH_PID,
  convex_frxETH_OETH_PID,
} = require("../utils/constants");

const log = require("../utils/logger")("deploy:001_core");

/**
 * Deploy AAVE Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { governorAddr } = await getNamedAccounts();

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

  const cAaveIncentivesController = await ethers.getContract(
    "MockAaveIncentivesController"
  );

  const initData = cAaveStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[],address,address)",
    [
      [assetAddresses.AAVE_TOKEN],
      [assetAddresses.DAI],
      [assetAddresses.aDAI],
      cAaveIncentivesController.address,
      assetAddresses.STKAAVE,
    ]
  );

  await withConfirmation(
    cAaveStrategyProxy["initialize(address,address,bytes)"](
      dAaveStrategy.address,
      governorAddr,
      initData
    )
  );

  log("Initialized AaveStrategyProxy");

  return cAaveStrategy;
};

/**
 * Deploy Compound Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployCompoundStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

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

  const initData = cCompoundStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [[assetAddresses.COMP], [assetAddresses.DAI], [assetAddresses.cDAI]]
  );

  await withConfirmation(
    cCompoundStrategyProxy["initialize(address,address,bytes)"](
      dCompoundStrategy.address,
      governorAddr,
      initData
    )
  );

  return cCompoundStrategy;
};

/**
 * Deploys a 3pool Strategy which supports USDC, USDT and DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 */
const deployThreePoolStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ThreePoolStrategyProxy", [], null, true);
  const cThreePoolStrategyProxy = await ethers.getContract(
    "ThreePoolStrategyProxy"
  );

  const dThreePoolStrategy = await deployWithConfirmation("ThreePoolStrategy", [
    [assetAddresses.ThreePool, cVaultProxy.address],
    [3, assetAddresses.ThreePool, assetAddresses.ThreePoolToken],
  ]);
  const cThreePoolStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    cThreePoolStrategyProxy.address
  );

  const initData = cThreePoolStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[],address,address)",
    [
      [assetAddresses.CRV],
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
      [
        assetAddresses.ThreePool,
        assetAddresses.ThreePool,
        assetAddresses.ThreePool,
      ],
      assetAddresses.ThreePoolGauge,
      assetAddresses.CRVMinter,
    ]
  );

  await withConfirmation(
    cThreePoolStrategyProxy["initialize(address,address,bytes)"](
      dThreePoolStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized ThreePoolStrategyProxy");

  return cThreePoolStrategy;
};

/**
 * Deploys a Convex Strategy which supports USDC, USDT and DAI.
 */
const deployConvexStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  const cVaultProxy = await ethers.getContract("VaultProxy");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(convex_3CRV_PID, assetAddresses.ThreePoolToken);

  await deployWithConfirmation("ConvexStrategyProxy", [], null, true);
  const cConvexStrategyProxy = await ethers.getContract("ConvexStrategyProxy");

  const dConvexStrategy = await deployWithConfirmation(
    "ConvexThreePoolStrategy",
    [
      [assetAddresses.ThreePool, cVaultProxy.address],
      [
        3, // Number of 3Pool assets
        assetAddresses.ThreePool,
        assetAddresses.ThreePoolToken,
      ],
      [
        mockBooster.address, // _cvxDepositorAddress,
        convex_3CRV_PID, // _cvxDepositorPTokenId
      ],
    ]
  );
  const cConvexStrategy = await ethers.getContractAt(
    "ConvexThreePoolStrategy",
    cConvexStrategyProxy.address
  );

  // 4. Initialize the Convex strategy using the Curve 3Pool
  // Construct initialize call data to init and configure the new strategy
  const initData = cConvexStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.CRV, assetAddresses.CVX],
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
      [
        assetAddresses.ThreePool,
        assetAddresses.ThreePool,
        assetAddresses.ThreePool,
      ],
    ]
  );

  await withConfirmation(
    cConvexStrategyProxy["initialize(address,address,bytes)"](
      dConvexStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized ConvexStrategyProxy");

  return cConvexStrategy;
};

/**
 * Deploys a Convex Strategy for the Curve frxETH/WETH pool
 */
const deployConvexFrxEthWethStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(
    convex_frxETH_WETH_PID,
    assetAddresses.CurveFrxEthWethPool
  );

  await deployWithConfirmation("ConvexFrxEthWethStrategyProxy", [], null, true);
  const cConvexFrxEthWethStrategyProxy = await ethers.getContract(
    "ConvexFrxEthWethStrategyProxy"
  );

  const dConvexStrategy = await deployWithConfirmation(
    "ConvexTwoPoolStrategy",
    [
      [assetAddresses.CurveFrxEthWethPool, cVaultProxy.address],
      [
        2, // Number of coins in the Curve pool
        assetAddresses.CurveFrxEthWethPool,
        assetAddresses.CurveFrxEthWethPool,
      ],
      [
        mockBooster.address, // _cvxDepositorAddress,
        convex_frxETH_WETH_PID, // _cvxDepositorPTokenId
      ],
    ]
  );
  const cConvexStrategy = await ethers.getContractAt(
    "ConvexTwoPoolStrategy",
    cConvexFrxEthWethStrategyProxy.address
  );

  // 4. Initialize the new Curve frxETH/WETH strategy
  // Construct initialize call data to init and configure the new strategy
  const initData = cConvexStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.CRV, assetAddresses.CVX],
      [assetAddresses.WETH, assetAddresses.frxETH],
      [assetAddresses.CurveFrxEthWethPool, assetAddresses.CurveFrxEthWethPool],
    ]
  );

  await withConfirmation(
    cConvexFrxEthWethStrategyProxy["initialize(address,address,bytes)"](
      dConvexStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized ConvexFrxEthWethStrategyProxy");

  return cConvexStrategy;
};

/**
 * Deploys a Convex Generalized Meta Strategy with LUSD token configuration
 */
const deployConvexLUSDMetaStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ConvexLUSDMetaStrategyProxy");
  const cConvexLUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexLUSDMetaStrategyProxy"
  );

  const dConvexLUSDMetaStrategy = await deployWithConfirmation(
    "ConvexGeneralizedMetaStrategy",
    [
      [assetAddresses.ThreePool, cVaultProxy.address],
      [3, assetAddresses.ThreePool, assetAddresses.ThreePoolToken],
    ]
  );
  const cConvexLUSDMetaStrategy = await ethers.getContractAt(
    "ConvexGeneralizedMetaStrategy",
    cConvexLUSDMetaStrategyProxy.address
  );

  // Initialize Strategies
  const mockBooster = await ethers.getContract("MockBooster");
  const mockRewardPool = await ethers.getContract("MockRewardPool");

  const LUSD = await ethers.getContract("MockLUSD");

  const initData = cConvexLUSDMetaStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[],(address,address,address,address,address,uint256))",
    [
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
        convex_LUSD_3CRV_PID, // _cvxDepositorPTokenId
      ],
    ]
  );

  await withConfirmation(
    cConvexLUSDMetaStrategyProxy["initialize(address,address,bytes)"](
      dConvexLUSDMetaStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized ConvexLUSDMetaStrategyProxy");

  return cConvexLUSDMetaStrategy;
};

/**
 * Deploys a Convex Meta Strategy which supports OUSD / 3Crv
 */
const deployConvexOUSDMetaStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  const cVaultProxy = await ethers.getContract("VaultProxy");

  await deployWithConfirmation("ConvexOUSDMetaStrategyProxy", [], null, true);
  const cConvexOUSDMetaStrategyProxy = await ethers.getContract(
    "ConvexOUSDMetaStrategyProxy"
  );

  const mockBooster = await ethers.getContract("MockBooster");
  // Get the Convex rewards pool contract
  const poolInfo = await mockBooster.poolInfo(convex_OUSD_3CRV_PID);
  const mockRewardPool = await ethers.getContractAt(
    "MockRewardPool",
    poolInfo.crvRewards
  );
  const ousd = await ethers.getContract("OUSDProxy");

  const dConvexOUSDMetaStrategy = await deployWithConfirmation(
    "ConvexOUSDMetaStrategy",
    [
      [assetAddresses.ThreePoolOUSDMetapool, cVaultProxy.address],
      [
        ousd.address, // oTokenAddress,
        assetAddresses.USDT, // vaultAssetAddress (USDT)
        assetAddresses.ThreePoolToken, // poolAssetAddress (3CRV)
        0, // Curve pool index for OUSD
        1, // Curve pool index for 3CRV
      ],
      [
        mockBooster.address, // cvxDepositorAddress,
        mockRewardPool.address, // cvxRewardStakerAddress,
        convex_OUSD_3CRV_PID, // cvxDepositorPTokenId
      ],
      assetAddresses.ThreePool, // _curve3Pool
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT], // _curve3PoolAssets
    ]
  );

  const cConvexOUSDMetaStrategy = await ethers.getContractAt(
    "ConvexOUSDMetaStrategy",
    cConvexOUSDMetaStrategyProxy.address
  );

  // Initialize Strategies
  const initData = cConvexOUSDMetaStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.CVX, assetAddresses.CRV],
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
      [
        assetAddresses.ThreePoolOUSDMetapool,
        assetAddresses.ThreePoolOUSDMetapool,
        assetAddresses.ThreePoolOUSDMetapool,
      ],
    ]
  );

  await withConfirmation(
    cConvexOUSDMetaStrategyProxy["initialize(address,address,bytes)"](
      dConvexOUSDMetaStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized ConvexOUSDMetaStrategyProxy");

  return cConvexOUSDMetaStrategy;
};

/**
 * Deploys a Convex AMO Strategy for the Curve OETH/ETH pool
 */
const deployConvexOethEthAMOStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  const cVaultProxy = await ethers.getContract("OETHVaultProxy");

  await deployWithConfirmation("ConvexEthMetaStrategyProxy", [], null, true);
  const cConvexEthMetaStrategyProxy = await ethers.getContract(
    "ConvexEthMetaStrategyProxy"
  );

  const mockBooster = await ethers.getContract("MockBooster");
  // Get the Convex rewards pool contract
  const poolInfo = await mockBooster.poolInfo(convex_OETH_ETH_PID);

  const oeth = await ethers.getContract("OETHProxy");

  const dConvexEthMetaStrategy = await deployWithConfirmation(
    "ConvexEthMetaStrategy",
    [
      [assetAddresses.CurveOethEthPool, cVaultProxy.address],
      [
        oeth.address, // oTokenAddress,
        assetAddresses.WETH, // vaultAssetAddress (WETH)
        addresses.ETH, // poolAssetAddress (ETH)
        1, // Curve pool index for OToken OETH
        0, // Curve pool index for asset ETH
      ],
      [
        mockBooster.address, // cvxDepositorAddress,
        poolInfo.crvRewards, // cvxRewardStakerAddress,
        convex_OETH_ETH_PID, // cvxDepositorPTokenId
      ],
    ]
  );
  const cConvexEthMetaStrategy = await ethers.getContractAt(
    "ConvexEthMetaStrategy",
    cConvexEthMetaStrategyProxy.address
  );

  // Initialize Strategies
  const initData = cConvexEthMetaStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.CVX, assetAddresses.CRV],
      [assetAddresses.WETH],
      [assetAddresses.CurveOethEthPool],
    ]
  );

  await withConfirmation(
    cConvexEthMetaStrategyProxy["initialize(address,address,bytes)"](
      dConvexEthMetaStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized ConvexEthMetaStrategyProxy");

  return cConvexEthMetaStrategy;
};

/**
 * Deploys a Convex AMO Strategy for the Curve frxETH/OETH pool
 */
const deployConvexFrxETHAMOStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();

  const cVaultProxy = await ethers.getContract("OETHVaultProxy");

  await deployWithConfirmation("ConvexFrxETHAMOStrategyProxy", [], null, true);
  const cConvexFrxETHAMOStrategyProxy = await ethers.getContract(
    "ConvexFrxETHAMOStrategyProxy"
  );

  const mockBooster = await ethers.getContract("MockBooster");
  // Get the Convex rewards pool contract
  const poolInfo = await mockBooster.poolInfo(convex_frxETH_OETH_PID);

  const oeth = await ethers.getContract("OETHProxy");

  const dConvexFrxETHAMOStrategy = await deployWithConfirmation(
    "ConvexFrxETHAMOStrategy",
    [
      [assetAddresses.CurveFrxEthOethPool, cVaultProxy.address],
      [
        oeth.address, // oTokenAddress,
        assetAddresses.frxETH, // vaultAssetAddress (frxETH)
        assetAddresses.frxETH, // poolAssetAddress (frxETH)
        1, // Curve pool index for OToken OETH
        0, // Curve pool index for asset frxETH
      ],
      [
        mockBooster.address, // cvxDepositorAddress,
        poolInfo.crvRewards, // cvxRewardStakerAddress,
        convex_frxETH_OETH_PID, // cvxDepositorPTokenId
      ],
    ]
  );
  const cConvexFrxETHAMOStrategy = await ethers.getContractAt(
    "ConvexFrxETHAMOStrategy",
    cConvexFrxETHAMOStrategyProxy.address
  );

  // Initialize Strategies
  const initData = cConvexFrxETHAMOStrategy.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.CVX, assetAddresses.CRV],
      [assetAddresses.frxETH],
      [assetAddresses.CurveFrxEthOethPool],
    ]
  );

  await withConfirmation(
    cConvexFrxETHAMOStrategyProxy["initialize(address,address,bytes)"](
      dConvexFrxETHAMOStrategy.address,
      governorAddr,
      initData
    )
  );
  log("Initialized cConvexFrxETHAMOStrategyProxy");

  return cConvexFrxETHAMOStrategy;
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
 * Configure OETH Vault by adding supported assets, unpause capital and set strategist.
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
  const { governorAddr } = await getNamedAccounts();
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
      governorAddr,
      []
    )
  );
  await withConfirmation(
    cOETHHarvesterProxy["initialize(address,address,bytes)"](
      dOETHHarvester.address,
      governorAddr,
      []
    )
  );
  log("Initialized OETHHarvesterProxy");

  if (!isMainnet) {
    await withConfirmation(
      cHarvester
        .connect(sGovernor)
        .setRewardsProceedsAddress(cVaultProxy.address)
    );

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
  const { governorAddr } = await getNamedAccounts();

  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  log("Deploy FraxETHStrategyProxy");
  const dFraxETHStrategyProxy = await deployWithConfirmation(
    "FraxETHStrategyProxy"
  );
  const cFraxETHStrategyProxy = await ethers.getContract(
    "FraxETHStrategyProxy"
  );
  log("Deploy FraxETHStrategy");
  const dFraxETHStrategy = await deployWithConfirmation("FraxETHStrategy", [
    [assetAddresses.sfrxETH, cOETHVaultProxy.address],
    assetAddresses.frxETH,
  ]);
  const cFraxETHStrategy = await ethers.getContractAt(
    "FraxETHStrategy",
    dFraxETHStrategyProxy.address
  );
  log("Initialize FraxETHStrategyProxy");
  const initData = cFraxETHStrategy.interface.encodeFunctionData(
    "initialize()",
    []
  );
  await withConfirmation(
    cFraxETHStrategyProxy["initialize(address,address,bytes)"](
      dFraxETHStrategy.address,
      governorAddr,
      initData
    )
  );
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

// deploy Curve OUSD/3Crv Metapool mocks
const deployCurveMetapoolMocks = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  const ousd = await ethers.getContract("OUSDProxy");

  await hre.deployments.deploy("MockCurveMetapool", {
    from: deployerAddr,
    args: [[ousd.address, assetAddresses.ThreePoolToken]],
  });

  const curveLpToken = await ethers.getContract("MockCurveMetapool");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(convex_OUSD_3CRV_PID, curveLpToken.address);
};

// deploy Curve LUSD/3Crv Metapool mocks
const deployCurveLUSDMetapoolMocks = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  await hre.deployments.deploy("MockCurveLUSDMetapool", {
    from: deployerAddr,
    args: [[assetAddresses.LUSD, assetAddresses.ThreePoolToken]],
  });

  const curveLpToken = await ethers.getContract("MockCurveLUSDMetapool");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(convex_LUSD_3CRV_PID, curveLpToken.address);
};

// deploy Curve OETH/ETH Pool mocks
const deployCurveOethEthPoolMocks = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();

  const oeth = await ethers.getContract("OETHProxy");

  await hre.deployments.deploy("MockCurveOethEthPool", {
    from: deployerAddr,
    args: [[addresses.ETH, oeth.address]],
  });

  const curveLpToken = await ethers.getContract("MockCurveOethEthPool");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(convex_OETH_ETH_PID, curveLpToken.address);
};

// deploy Curve frxETH/OETH Pool mocks
const deployCurvefrxEthOethPoolMocks = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  const oeth = await ethers.getContract("OETHProxy");

  await hre.deployments.deploy("MockCurveFrxEthOethPool", {
    from: deployerAddr,
    args: [[assetAddresses.frxETH, oeth.address]],
  });

  const curveLpToken = await ethers.getContract("MockCurveFrxEthOethPool");
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(convex_frxETH_OETH_PID, curveLpToken.address);
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
  const oeth = await ethers.getContract("OETHProxy");
  const cOUSDVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  const cOETHVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );

  // Deploy proxy and implementation
  const dOUSDBuybackProxy = await deployWithConfirmation("BuybackProxy");
  const dOETHBuybackProxy = await deployWithConfirmation("OETHBuybackProxy");
  const ousdContractName = isMainnetOrFork ? "OUSDBuyback" : "MockBuyback";
  const oethContractName = isMainnetOrFork ? "OETHBuyback" : "MockBuyback";
  const dOUSDBuybackImpl = await deployWithConfirmation(ousdContractName, [
    ousd.address,
    assetAddresses.OGV,
    assetAddresses.CVX,
    assetAddresses.CVXLocker,
  ]);
  const dOETHBuybackImpl = await deployWithConfirmation(oethContractName, [
    oeth.address,
    assetAddresses.OGV,
    assetAddresses.CVX,
    assetAddresses.CVXLocker,
  ]);

  const cOUSDBuybackProxy = await ethers.getContractAt(
    "BuybackProxy",
    dOUSDBuybackProxy.address
  );

  const cOETHBuybackProxy = await ethers.getContractAt(
    "OETHBuybackProxy",
    dOETHBuybackProxy.address
  );

  // Init proxy to implementation
  await withConfirmation(
    cOUSDBuybackProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dOUSDBuybackImpl.address, deployerAddr, [])
  );
  await withConfirmation(
    cOETHBuybackProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dOETHBuybackImpl.address, deployerAddr, [])
  );

  const cOUSDBuyback = await ethers.getContractAt(
    ousdContractName,
    cOUSDBuybackProxy.address
  );
  const cOETHBuyback = await ethers.getContractAt(
    oethContractName,
    cOETHBuybackProxy.address
  );

  // Initialize implementation contract
  const initFunction = "initialize(address,address,address,address)";
  await withConfirmation(
    cOUSDBuyback.connect(sDeployer)[initFunction](
      assetAddresses.uniswapUniversalRouter,
      strategistAddr,
      strategistAddr, // Treasury manager
      assetAddresses.RewardsSource
    )
  );
  await withConfirmation(
    cOETHBuyback.connect(sDeployer)[initFunction](
      assetAddresses.uniswapUniversalRouter,
      strategistAddr,
      strategistAddr, // Treasury manager
      assetAddresses.RewardsSource
    )
  );

  // Init proxy to implementation
  await withConfirmation(
    cOUSDBuyback.connect(sDeployer).transferGovernance(governorAddr)
  );
  await withConfirmation(
    cOETHBuyback.connect(sDeployer).transferGovernance(governorAddr)
  );

  await cOUSDBuyback.connect(sDeployer).safeApproveAllTokens();
  await cOETHBuyback.connect(sDeployer).safeApproveAllTokens();

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cOUSDBuyback
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    await withConfirmation(
      cOETHBuyback
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for Buyback");

    await cOUSDVault.connect(sGovernor).setTrusteeAddress(cOUSDBuyback.address);
    await cOETHVault.connect(sGovernor).setTrusteeAddress(cOETHBuyback.address);
    log("Buyback set as Vault trustee");
  }
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

  const ousd = await ethers.getContract("OUSDProxy");
  const dWrappedOusdImpl = await deployWithConfirmation("WrappedOusd", [
    ousd.address,
    "Wrapped OUSD IMPL",
    "WOUSD IMPL",
  ]);
  await deployWithConfirmation("WrappedOUSDProxy");
  const wousdProxy = await ethers.getContract("WrappedOUSDProxy");
  const wousd = await ethers.getContractAt("WrappedOusd", wousdProxy.address);

  const initData = wousd.interface.encodeFunctionData("initialize()", []);

  await wousdProxy.connect(sDeployer)[
    // eslint-disable-next-line no-unexpected-multiline
    "initialize(address,address,bytes)"
  ](dWrappedOusdImpl.address, governorAddr, initData);
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

const deployOUSDSwapper = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const assetAddresses = await getAssetAddresses(deployments);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  const mockSwapper = await ethers.getContract("MockSwapper");
  // Assumes deployOETHSwapper has already been run
  const cSwapper = await ethers.getContract("Swapper1InchV5");

  cSwapper
    .connect(sDeployer)
    .approveAssets([
      assetAddresses.DAI,
      assetAddresses.USDC,
      assetAddresses.USDT,
    ]);

  await vault.connect(sGovernor).setSwapper(mockSwapper.address);
  await vault.connect(sGovernor).setSwapAllowedUndervalue(100);

  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.DAI, 50);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.USDC, 50);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.USDT, 50);
};

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();
  await deployCurveMetapoolMocks();
  await deployCurveLUSDMetapoolMocks();
  await deployCurveOethEthPoolMocks();
  await deployCurvefrxEthOethPoolMocks();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await deployThreePoolStrategy();
  await deployConvexStrategy();
  await deployConvexOUSDMetaStrategy();
  await deployConvexLUSDMetaStrategy();
  await deployConvexOethEthAMOStrategy();
  await deployConvexFrxETHAMOStrategy();
  await deployConvexFrxEthWethStrategy();
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
  await deployOUSDSwapper();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];
main.tags = ["unit_tests"];
main.skip = () => isFork;

module.exports = main;
