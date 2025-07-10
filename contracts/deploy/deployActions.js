const hre = require("hardhat");
const { parseUnits } = require("ethers/lib/utils.js");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isHolesky,
  isHoleskyOrFork,
  isSonicOrFork,
  isTest,
  isFork,
  isPlume,
  isHoodi,
  isHoodiOrFork,
} = require("../test/helpers.js");
const { deployWithConfirmation, withConfirmation } = require("../utils/deploy");
const { metapoolLPCRVPid } = require("../utils/constants");
const { impersonateAccount } = require("../utils/signers");

const log = require("../utils/logger")("deploy:core");

/**
 * Deploy AAVE Strategy which only supports USDC.
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
      [assetAddresses.USDC],
      [assetAddresses.aUSDC],
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
 * Deploy Compound Strategy which only supports USDS.
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
    [[assetAddresses.COMP], [assetAddresses.USDS], [assetAddresses.cUSDS]]
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
 * Deploys a Convex Strategy which supports USDC, USDT and USDS.
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
      [assetAddresses.USDS, assetAddresses.USDC, assetAddresses.USDT],
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
      [assetAddresses.USDS, assetAddresses.USDC, assetAddresses.USDT],
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

  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  // Set up supported assets for Vault
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDS, 0)
  );
  log("Added USDS asset to Vault");
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
const configureOETHVault = async (isSimpleOETH) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVault = await ethers.getContractAt(
    "IVault",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );
  // Set up supported assets for Vault
  const { WETH, RETH, stETH, frxETH } = assetAddresses;
  const assets = isSimpleOETH ? [WETH] : [WETH, RETH, stETH, frxETH];
  for (const asset of assets) {
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

  // Cache WETH asset address
  await withConfirmation(cVault.connect(sGovernor).cacheWETHAssetIndex());

  // Redeem fee to 0
  await withConfirmation(cVault.connect(sGovernor).setRedeemFeeBps(0));

  // Allocate threshold
  await withConfirmation(
    cVault
      .connect(sGovernor)
      .setAutoAllocateThreshold(ethers.utils.parseUnits("25", 18))
  );

  // Rebase threshold
  await withConfirmation(
    cVault
      .connect(sGovernor)
      .setAutoAllocateThreshold(ethers.utils.parseUnits("5", 18))
  );

  // Set withdrawal claim delay to 10m
  await withConfirmation(
    cVault.connect(sGovernor).setWithdrawalClaimDelay(10 * 60)
  );
};

const deployOUSDHarvester = async (ousdDripper) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
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
      governorAddr,
      []
    )
  );

  log("Initialized HarvesterProxy");

  await withConfirmation(
    cHarvester
      .connect(sGovernor)
      .setRewardProceedsAddress(
        isMainnet || isHolesky || isHoodi
          ? ousdDripper.address
          : cVaultProxy.address
      )
  );

  return dHarvesterProxy;
};

const upgradeOETHHarvester = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");

  const dOETHHarvester = await deployWithConfirmation("OETHHarvester", [
    cOETHVaultProxy.address,
    assetAddresses.WETH,
  ]);

  await withConfirmation(cOETHHarvesterProxy.upgradeTo(dOETHHarvester.address));

  log("Upgraded OETHHarvesterProxy");
  return cOETHHarvesterProxy;
};

const deployOETHHarvester = async (oethDripper) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  const dOETHHarvesterProxy = await deployWithConfirmation(
    "OETHHarvesterProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");

  const dOETHHarvester = await deployWithConfirmation("OETHHarvester", [
    cOETHVaultProxy.address,
    assetAddresses.WETH,
  ]);

  const cOETHHarvester = await ethers.getContractAt(
    "OETHHarvester",
    dOETHHarvesterProxy.address
  );

  await withConfirmation(
    // prettier-ignore
    cOETHHarvesterProxy["initialize(address,address,bytes)"](
      dOETHHarvester.address,
      governorAddr,
      []
    )
  );

  log("Initialized OETHHarvesterProxy");

  await withConfirmation(
    cOETHHarvester
      .connect(sGovernor)
      .setRewardProceedsAddress(
        isMainnet || isHolesky || isHoodi
          ? oethDripper.address
          : cOETHVaultProxy.address
      )
  );

  return cOETHHarvester;
};

/**
 * Deploy Harvester
 */
const deployHarvesters = async (ousdDripper, oethDripper) => {
  const dHarvesterProxy = await deployOUSDHarvester(ousdDripper);
  const dOETHHarvesterProxy = await deployOETHHarvester(oethDripper);

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

  const nativeStakingSSVStrategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const nativeStakingSSVStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    nativeStakingSSVStrategyProxy.address
  );

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setHarvesterAddress(oethHarvesterProxy.address)
  );
};

const deployOUSDDripper = async () => {
  const { governorAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

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
  const cDripper = await ethers.getContractAt(
    "OETHDripper",
    cDripperProxy.address
  );

  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // duration of 14 days
  await withConfirmation(
    cDripper.connect(sGovernor).setDripDuration(14 * 24 * 60 * 60)
  );
  await withConfirmation(
    cVault.connect(sGovernor).setDripper(cDripperProxy.address)
  );

  return cDripper;
};

const deployOETHDripper = async () => {
  const { governorAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

  // Deploy Dripper Impl
  const dDripper = await deployWithConfirmation("OETHDripper", [
    cVaultProxy.address,
    assetAddresses.WETH,
  ]);

  await deployWithConfirmation("OETHDripperProxy");
  // Deploy Dripper Proxy
  const cDripperProxy = await ethers.getContract("OETHDripperProxy");
  await withConfirmation(
    cDripperProxy["initialize(address,address,bytes)"](
      dDripper.address,
      governorAddr,
      []
    )
  );
  const cDripper = await ethers.getContractAt(
    "OETHDripper",
    cDripperProxy.address
  );

  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // duration of 14 days
  await withConfirmation(
    cDripper.connect(sGovernor).setDripDuration(14 * 24 * 60 * 60)
  );

  await withConfirmation(
    cVault.connect(sGovernor).setDripper(cDripperProxy.address)
  );

  return cDripper;
};

const deployDrippers = async () => {
  const ousdDripper = await deployOUSDDripper();
  const oethDripper = await deployOETHDripper();

  return [ousdDripper, oethDripper];
};

/**
 * upgradeNativeStakingFeeAccumulator
 */
const upgradeNativeStakingFeeAccumulator = async () => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const strategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const feeAccumulatorProxy = await ethers.getContract(
    "NativeStakingFeeAccumulatorProxy"
  );

  log("About to deploy FeeAccumulator implementation");
  const dFeeAccumulatorImpl = await deployWithConfirmation("FeeAccumulator", [
    strategyProxy.address, // STRATEGY
  ]);
  log(`New FeeAccumulator implementation: ${dFeeAccumulatorImpl.address}`);

  await withConfirmation(
    feeAccumulatorProxy
      .connect(sDeployer)
      .upgradeTo(dFeeAccumulatorImpl.address)
  );
};

/**
 * Upgrade NativeStakingSSVStrategy
 */
const upgradeNativeStakingSSVStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr } = await getNamedAccounts();
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const strategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cFeeAccumulatorProxy = await ethers.getContract(
    "NativeStakingFeeAccumulatorProxy"
  );

  log("About to deploy NativeStakingSSVStrategy implementation");
  const dStrategyImpl = await deployWithConfirmation(
    "NativeStakingSSVStrategy",
    [
      [addresses.zero, cOETHVaultProxy.address], //_baseConfig
      assetAddresses.WETH, // wethAddress
      assetAddresses.SSV, // ssvToken
      assetAddresses.SSVNetwork, // ssvNetwork
      500, // maxValidators
      cFeeAccumulatorProxy.address, // feeAccumulator
      assetAddresses.beaconChainDepositContract, // depositContractMock
    ]
  );
  log(`New NativeStakingSSVStrategy implementation: ${dStrategyImpl.address}`);

  await withConfirmation(
    strategyProxy.connect(sDeployer).upgradeTo(dStrategyImpl.address)
  );
};

/**
 * Deploy NativeStakingSSVStrategy
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployNativeStakingSSVStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  log("Deploy NativeStakingSSVStrategyProxy");
  const dNativeStakingSSVStrategyProxy = await deployWithConfirmation(
    "NativeStakingSSVStrategyProxy"
  );
  const cNativeStakingSSVStrategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );

  log("Deploy FeeAccumulator proxy");
  const dFeeAccumulatorProxy = await deployWithConfirmation(
    "NativeStakingFeeAccumulatorProxy"
  );
  const cFeeAccumulatorProxy = await ethers.getContractAt(
    "NativeStakingFeeAccumulatorProxy",
    dFeeAccumulatorProxy.address
  );

  log("Deploy NativeStakingSSVStrategy");
  const dStrategyImpl = await deployWithConfirmation(
    "NativeStakingSSVStrategy",
    [
      [addresses.zero, cOETHVaultProxy.address], //_baseConfig
      assetAddresses.WETH, // wethAddress
      assetAddresses.SSV, // ssvToken
      assetAddresses.SSVNetwork, // ssvNetwork
      500, // maxValidators
      dFeeAccumulatorProxy.address, // feeAccumulator
      assetAddresses.beaconChainDepositContract, // depositContractMock
    ]
  );
  const cStrategyImpl = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    dStrategyImpl.address
  );

  log("Deploy encode initialize function of the strategy contract");
  const initData = cStrategyImpl.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.WETH], // reward token addresses
      /* no need to specify WETH as an asset, since we have that overridden in the "supportsAsset"
       * function on the strategy
       */
      [], // asset token addresses
      [], // platform tokens addresses
    ]
  );

  log("Initialize the proxy and execute the initialize strategy function");
  await withConfirmation(
    cNativeStakingSSVStrategyProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](
      cStrategyImpl.address, // implementation address
      governorAddr, // governance
      initData // data for call to the initialize function on the strategy
    )
  );

  const cStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    dNativeStakingSSVStrategyProxy.address
  );

  log("Approve spending of the SSV token");
  await withConfirmation(cStrategy.connect(sDeployer).safeApproveAllTokens());

  log("Deploy fee accumulator implementation");
  const dFeeAccumulator = await deployWithConfirmation("FeeAccumulator", [
    cNativeStakingSSVStrategyProxy.address, // STRATEGY
  ]);
  const cFeeAccumulator = await ethers.getContractAt(
    "FeeAccumulator",
    dFeeAccumulator.address
  );

  log("Init fee accumulator proxy");
  await withConfirmation(
    cFeeAccumulatorProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](
      cFeeAccumulator.address, // implementation address
      governorAddr, // governance
      "0x" // do not call any initialize functions
    )
  );
  return cStrategy;
};

/**
 * Deploy CompoundingStakingSSVStrategy
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployCompoundingStakingSSVStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  const cBeaconOracle = await ethers.getContract("BeaconOracle");
  const cBeaconProofs = await ethers.getContract("BeaconProofs");

  let governorAddress;
  if (isTest && !isFork) {
    // For unit tests, use the Governor contract
    governorAddress = governorAddr;

    log("Deploy CompoundingStakingSSVStrategyProxy");
    await deployWithConfirmation("CompoundingStakingSSVStrategyProxy");
  } else {
    // For fork tests and mainnet deployments, use the Timelock contract
    governorAddress = addresses.mainnet.Timelock;
  }
  // Should have already been deployed by the Defender Relayer as SSV rewards are sent to the deployer.
  // Use the deployStakingProxy Hardhat task to deploy
  const cCompoundingStakingSSVStrategyProxy = await ethers.getContract(
    "CompoundingStakingSSVStrategyProxy"
  );

  const proxyGovernor = await cCompoundingStakingSSVStrategyProxy.governor();
  if (isFork && proxyGovernor != deployerAddr) {
    // For fork tests, transfer the governance to the deployer account
    const currentSigner = await impersonateAccount(
      "0x3Ba227D87c2A7aB89EAaCEFbeD9bfa0D15Ad249A"
    );
    await withConfirmation(
      cCompoundingStakingSSVStrategyProxy
        .connect(currentSigner)
        .transferGovernance(deployerAddr)
    );

    await withConfirmation(
      cCompoundingStakingSSVStrategyProxy.connect(sDeployer).claimGovernance()
    );
  } else {
    /* Before kicking off the deploy script make sure the Defender relayer transfers the governance
     * of the proxy to the deployer account that shall be deploying this script so it will be able
     * to initialize the proxy contract
     *
     * Run the following to make it happen, and comment this error block out:
     * yarn run hardhat transferGovernance --proxy CompoundingStakingSSVStrategyProxy --governor 0xdeployerAddress  --network mainnet
     */
    if (proxyGovernor != deployerAddr) {
      throw new Error(
        `Compounding Staking Strategy proxy's governor: ${proxyGovernor} does not match current deployer ${deployerAddr}`
      );
    }
  }

  log("Deploy CompoundingStakingSSVStrategy");
  const dStrategyImpl = await deployWithConfirmation(
    "CompoundingStakingSSVStrategy",
    [
      [addresses.zero, cOETHVaultProxy.address], //_baseConfig
      assetAddresses.WETH, // wethAddress
      assetAddresses.SSV, // ssvToken
      assetAddresses.SSVNetwork, // ssvNetwork
      assetAddresses.beaconChainDepositContract, // depositContractMock
      cBeaconOracle.address, // BeaconOracle
      cBeaconProofs.address, // BeaconProofs
    ]
  );
  const cStrategyImpl = await ethers.getContractAt(
    "CompoundingStakingSSVStrategy",
    dStrategyImpl.address
  );

  log("Deploy encode initialize function of the strategy contract");
  const initData = cStrategyImpl.interface.encodeFunctionData(
    "initialize(address[],address[],address[])",
    [
      [assetAddresses.WETH], // reward token addresses
      /* no need to specify WETH as an asset, since we have that overridden in the "supportsAsset"
       * function on the strategy
       */
      [], // asset token addresses
      [], // platform tokens addresses
    ]
  );

  log("Initialize the proxy and execute the initialize strategy function");
  await withConfirmation(
    cCompoundingStakingSSVStrategyProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](
      cStrategyImpl.address, // implementation address
      governorAddress,
      initData // data for call to the initialize function on the strategy
    )
  );

  const cStrategy = await ethers.getContractAt(
    "CompoundingStakingSSVStrategy",
    cCompoundingStakingSSVStrategyProxy.address
  );

  log("Approve spending of the SSV token");
  await withConfirmation(cStrategy.connect(sDeployer).safeApproveAllTokens());

  return cStrategy;
};

const deployBeaconContracts = async () => {
  log("Deploy Beacon Oracle that maps blocks and slots");
  await deployWithConfirmation("BeaconOracle", []);

  log("Deploy Beacon Proofs");
  await deployWithConfirmation("BeaconProofs", []);
};

/**
 * Deploy the OracleRouter and initialise it with Chainlink sources.
 */
const deployOracles = async () => {
  const { deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  let oracleContract = "MockOracleRouter";
  let contractName = "OracleRouter";
  let args = [];
  if (isMainnet) {
    oracleContract = "OracleRouter";
  } else if (isHoleskyOrFork || isHoodiOrFork) {
    oracleContract = "OETHFixedOracle";
    contractName = "OETHOracleRouter";
    args = [];
  } else if (isSonicOrFork) {
    oracleContract = "OSonicOracleRouter";
    contractName = "OSonicOracleRouter";
    args = [addresses.zero];
  }

  await deployWithConfirmation(contractName, args, oracleContract);
  if (isHoleskyOrFork || isHoodiOrFork || isSonicOrFork) {
    // no need to configure any feeds since they are hardcoded to a fixed feed
    // TODO: further deployments will require more intelligent separation of different
    // chains / environment oracle deployments
    return;
  }

  const oracleRouter = await ethers.getContract("OracleRouter");
  log("Deployed OracleRouter");

  const assetAddresses = await getAssetAddresses(deployments);

  // Register feeds
  // Not needed in production
  const oracleAddresses = await getOracleAddresses(deployments);
  /* Mock oracle feeds report 0 for updatedAt data point. Set
   * maxStaleness to 100 years from epoch to make the Oracle
   * feeds valid
   */
  const maxStaleness = 24 * 60 * 60 * 365 * 100;

  const oracleFeeds = [
    [assetAddresses.USDS, oracleAddresses.chainlink.USDS_USD],
    [assetAddresses.USDT, oracleAddresses.chainlink.USDT_USD],
    [assetAddresses.USDC, oracleAddresses.chainlink.USDC_USD],
    [assetAddresses.TUSD, oracleAddresses.chainlink.TUSD_USD],
    [assetAddresses.COMP, oracleAddresses.chainlink.COMP_USD],
    [assetAddresses.AAVE, oracleAddresses.chainlink.AAVE_USD],
    [assetAddresses.AAVE_TOKEN, oracleAddresses.chainlink.AAVE_USD],
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
    [assetAddresses.BAL, oracleAddresses.chainlink.BAL_ETH],
  ];

  for (const [asset, oracle] of oracleFeeds) {
    await withConfirmation(
      oracleRouter.connect(sDeployer).setFeed(asset, oracle, maxStaleness)
    );
  }
};

const deployOETHCore = async () => {
  const { governorAddr, deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // Proxies
  await deployWithConfirmation("OETHProxy");
  await deployWithConfirmation("OETHVaultProxy");

  // Main contracts
  const dOETH = await deployWithConfirmation("OETH");
  const dOETHVault = await deployWithConfirmation("OETHVault");
  const dOETHVaultCore = await deployWithConfirmation("OETHVaultCore", [
    assetAddresses.WETH,
  ]);
  const dOETHVaultAdmin = await deployWithConfirmation("OETHVaultAdmin", [
    assetAddresses.WETH,
  ]);

  // Get contract instances
  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);

  const oracleRouterContractName =
    isMainnet || isHoodiOrFork ? "OETHOracleRouter" : "OracleRouter";
  const cOETHOracleRouter = await ethers.getContract(oracleRouterContractName);
  const cOETHVault = await ethers.getContractAt(
    "IVault",
    cOETHVaultProxy.address
  );

  // prettier-ignore
  await withConfirmation(
    cOETHProxy.connect(sDeployer)["initialize(address,address,bytes)"](
      dOETH.address,
      governorAddr,
      []
    )
  );
  log("Initialized OETHProxy");

  // prettier-ignore
  await withConfirmation(
    cOETHVaultProxy.connect(sDeployer)["initialize(address,address,bytes)"](
      dOETHVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized OETHVaultProxy");

  await withConfirmation(
    cOETHVault
      .connect(sGovernor)
      .initialize(cOETHOracleRouter.address, cOETHProxy.address)
  );
  log("Initialized OETHVault");

  await withConfirmation(
    cOETHVaultProxy.connect(sGovernor).upgradeTo(dOETHVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cOETHVault.connect(sGovernor).setAdminImpl(dOETHVaultAdmin.address)
  );

  log("Initialized VaultAdmin implementation");
  // Initialize OETH
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
    cOETH.connect(sGovernor).initialize(cOETHVaultProxy.address, resolution)
  );
  log("Initialized OETH");
};

const deployOUSDCore = async () => {
  const { governorAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  await deployWithConfirmation("OUSDProxy");
  await deployWithConfirmation("VaultProxy");

  // Main contracts
  let dOUSD;
  if (isTest) {
    dOUSD = await deployWithConfirmation("TestUpgradedOUSD");
  } else {
    dOUSD = await deployWithConfirmation("OUSD");
  }
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cOracleRouter = await ethers.getContract("OracleRouter");
  const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

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
    cOUSD.connect(sGovernor).initialize(cVaultProxy.address, resolution)
  );
  log("Initialized OUSD");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .setRebaseRateMax(ethers.utils.parseUnits("200", 18))
  );
};

/**
 * Deploy the core contracts (Vault and OUSD).
 */
const deployCore = async () => {
  await deployOUSDCore();
  await deployOETHCore();
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

// create Uniswap V3 OUSD - USDT pool
const deployUniswapV3Pool = async () => {
  const ousd = await ethers.getContract("OUSDProxy");
  const assetAddresses = await getAssetAddresses(deployments);
  const MockUniswapV3Factory = await ethers.getContract("MockUniswapV3Factory");

  await MockUniswapV3Factory.createPool(assetAddresses.USDT, ousd.address, 500);

  await MockUniswapV3Factory.createPool(
    assetAddresses.USDT,
    assetAddresses.USDS,
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
  const ousdContractName = "OUSDBuyback";
  const oethContractName = "OETHBuyback";
  const dOUSDBuybackImpl = await deployWithConfirmation(ousdContractName, [
    ousd.address,
    assetAddresses.OGN,
    assetAddresses.CVX,
    assetAddresses.CVXLocker,
  ]);
  const dOETHBuybackImpl = await deployWithConfirmation(oethContractName, [
    oeth.address,
    assetAddresses.OGN,
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

  const mockSwapper = await ethers.getContract("MockSwapper");

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
  const initFunction = "initialize(address,address,address,address,uint256)";
  await withConfirmation(
    cOUSDBuyback.connect(sDeployer)[initFunction](
      mockSwapper.address,
      strategistAddr,
      strategistAddr, // Treasury manager
      assetAddresses.RewardsSource,
      5000 // 50%
    )
  );
  await withConfirmation(
    cOETHBuyback.connect(sDeployer)[initFunction](
      mockSwapper.address,
      strategistAddr,
      strategistAddr, // Treasury manager
      assetAddresses.RewardsSource,
      5000 // 50%
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

const deployWOeth = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const oeth = await ethers.getContract("OETHProxy");
  const dWrappedOethImpl = await deployWithConfirmation("WOETH", [
    oeth.address,
  ]);
  await deployWithConfirmation("WOETHProxy");
  const woethProxy = await ethers.getContract("WOETHProxy");
  const woeth = await ethers.getContractAt("WOETH", woethProxy.address);

  const initData = woeth.interface.encodeFunctionData("initialize()", []);

  await woethProxy.connect(sDeployer)[
    // eslint-disable-next-line no-unexpected-multiline
    "initialize(address,address,bytes)"
  ](dWrappedOethImpl.address, governorAddr, initData);
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
      assetAddresses.USDS,
      assetAddresses.USDC,
      assetAddresses.USDT,
    ]);

  await vault.connect(sGovernor).setSwapper(mockSwapper.address);
  await vault.connect(sGovernor).setSwapAllowedUndervalue(100);

  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.USDS, 50);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.USDC, 50);
  await vault.connect(sGovernor).setOracleSlippage(assetAddresses.USDT, 50);
};

const deployBaseAerodromeAMOStrategyImplementation = async () => {
  const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
  const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

  await deployWithConfirmation("AerodromeAMOStrategy", [
    /* Check all these values match 006_base_amo_strategy deploy file
     */
    [addresses.zero, cOETHbVaultProxy.address], // platformAddress, VaultAddress
    addresses.base.WETH, // weth address
    cOETHbProxy.address, // OETHb address
    addresses.base.swapRouter, // swapRouter
    addresses.base.nonFungiblePositionManager, // nonfungiblePositionManager
    addresses.base.aerodromeOETHbWETHClPool, // clOETHbWethPool
    addresses.base.aerodromeOETHbWETHClGauge, // gauge address
    addresses.base.sugarHelper, // sugarHelper
    -1, // lowerBoundingTick
    0, // upperBoundingTick
    0, // tickClosestToParity
  ]);

  return await ethers.getContract("AerodromeAMOStrategy");
};

const deployPlumeRoosterAMOStrategyImplementation = async (poolAddress) => {
  return _deployPlumeRoosterAMOImplementationConfigurable(
    poolAddress,
    "RoosterAMOStrategy"
  );
};

const deployPlumeMockRoosterAMOStrategyImplementation = async (poolAddress) => {
  return _deployPlumeRoosterAMOImplementationConfigurable(
    poolAddress,
    "MockRoosterAMOStrategy"
  );
};

const _deployPlumeRoosterAMOImplementationConfigurable = async (
  poolAddress,
  stratContractName
) => {
  const cOETHpProxy = await ethers.getContract("OETHPlumeProxy");
  const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");

  if (!isFork && isPlume) {
    throw new Error("You cannot deploy this strategy yet");
  }

  const cMockMaverickDistributor = await ethers.getContract(
    "MockMaverickDistributor"
  );

  await deployWithConfirmation(stratContractName, [
    /* Used first by the 002_rooster_amo_ deploy file
     */
    [addresses.zero, cOETHpVaultProxy.address], // platformAddress, VaultAddress
    addresses.plume.WETH, // weth address
    cOETHpProxy.address, // OETHp address
    addresses.plume.MaverickV2LiquidityManager, // liquidity mananger
    addresses.plume.MaverickV2PoolLens, // pool lens
    addresses.plume.MaverickV2Position, // position
    addresses.plume.MaverickV2Quoter, // quoter
    poolAddress, // superOETHp/WPLUME pool
    true, // uppperTickAtParity
    // TODO: change these to actual addresses
    cMockMaverickDistributor.address, // votingDistributor
    cMockMaverickDistributor.address, // poolDistributor
  ]);

  return await ethers.getContract(stratContractName);
};

const getPlumeContracts = async () => {
  const maverickV2LiquidityManager = await ethers.getContractAt(
    "IMaverickV2LiquidityManager",
    addresses.plume.MaverickV2LiquidityManager
  );
  const maverickV2PoolLens = await ethers.getContractAt(
    "IMaverickV2PoolLens",
    addresses.plume.MaverickV2PoolLens
  );
  const cOETHpProxy = await ethers.getContract("OETHPlumeProxy");
  const cOETHp = await ethers.getContractAt("OETHPlume", cOETHpProxy.address);

  return {
    maverickV2LiquidityManager,
    maverickV2PoolLens,
    cOETHp,
  };
};

const deploySonicSwapXAMOStrategyImplementation = async () => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cSonicSwapXAMOStrategyProxy = await ethers.getContract(
    "SonicSwapXAMOStrategyProxy"
  );
  const cOSonicProxy = await ethers.getContract("OSonicProxy");
  const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

  // Deploy Sonic SwapX AMO Strategy implementation
  const dSonicSwapXAMOStrategy = await deployWithConfirmation(
    "SonicSwapXAMOStrategy",
    [
      [addresses.sonic.SwapXWSOS.pool, cOSonicVaultProxy.address],
      cOSonicProxy.address,
      addresses.sonic.wS,
      addresses.sonic.SwapXWSOS.gauge,
    ]
  );
  const cSonicSwapXAMOStrategy = await ethers.getContractAt(
    "SonicSwapXAMOStrategy",
    cSonicSwapXAMOStrategyProxy.address
  );
  // Initialize Sonic Curve AMO Strategy implementation
  const depositPriceRange = parseUnits("0.01", 18); // 1% or 100 basis points
  const initData = cSonicSwapXAMOStrategy.interface.encodeFunctionData(
    "initialize(address[],uint256)",
    [[addresses.sonic.SWPx], depositPriceRange]
  );
  await withConfirmation(
    // prettier-ignore
    cSonicSwapXAMOStrategyProxy
      .connect(sDeployer)["initialize(address,address,bytes)"](
        dSonicSwapXAMOStrategy.address,
        addresses.sonic.timelock,
        initData
      )
  );

  return cSonicSwapXAMOStrategy;
};

module.exports = {
  deployOracles,
  deployCore,
  deployOETHCore,
  deployOUSDCore,
  deployCurveMetapoolMocks,
  deployCompoundStrategy,
  deployAaveStrategy,
  deployConvexStrategy,
  deployConvexOUSDMetaStrategy,
  deployBeaconContracts,
  deployNativeStakingSSVStrategy,
  deployCompoundingStakingSSVStrategy,
  deployDrippers,
  deployOETHDripper,
  deployOUSDDripper,
  deployHarvesters,
  deployOETHHarvester,
  deployOUSDHarvester,
  upgradeOETHHarvester,
  configureVault,
  configureOETHVault,
  configureStrategies,
  deployBuyback,
  deployUniswapV3Pool,
  deployVaultValueChecker,
  deployWOusd,
  deployWOeth,
  deployOETHSwapper,
  deployOUSDSwapper,
  upgradeNativeStakingSSVStrategy,
  upgradeNativeStakingFeeAccumulator,
  deployBaseAerodromeAMOStrategyImplementation,
  deployPlumeRoosterAMOStrategyImplementation,
  deployPlumeMockRoosterAMOStrategyImplementation,
  getPlumeContracts,
  deploySonicSwapXAMOStrategyImplementation,
};
