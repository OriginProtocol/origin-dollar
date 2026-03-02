const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { parseUnits } = require("ethers/lib/utils.js");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  isTest,
  isFork,
  isForkTest,
  isCI,
  isHoodiOrFork,
} = require("../test/helpers.js");
const {
  deployWithConfirmation,
  verifyContractOnEtherscan,
  withConfirmation,
  encodeSaltForCreateX,
} = require("../utils/deploy");
const { replaceContractAt } = require("../utils/hardhat");
const { resolveContract } = require("../utils/resolvers");
const { impersonateAccount, getSigner } = require("../utils/signers");
const { getDefenderSigner } = require("../utils/signersNoHardhat");
const { getTxOpts } = require("../utils/tx");
const createxAbi = require("../abi/createx.json");

const {
  beaconChainGenesisTimeHoodi,
  beaconChainGenesisTimeMainnet,
} = require("../utils/constants");

const log = require("../utils/logger")("deploy:core");

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async () => {
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on Vault");
  // Set Strategist address.
  await withConfirmation(
    cVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );

  // Set withdrawal claim delay to 10m
  await withConfirmation(
    cVault.connect(sGovernor).setWithdrawalClaimDelay(10 * 60)
  );
};

/**
 * Configure OETH Vault by adding supported assets and Strategies.
 */
const configureOETHVault = async () => {
  let { governorAddr, deployerAddr, strategistAddr } = await getNamedAccounts();
  // Signers
  let sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cVault = await ethers.getContractAt(
    "IVault",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );

  if (isHoodiOrFork) {
    governorAddr = deployerAddr;
    sGovernor = sDeployer;
  }

  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on OETH Vault");
  // Set Strategist address.
  await withConfirmation(
    cVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );

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

const deploySimpleOETHHarvester = async () => {
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const assetAddresses = await getAssetAddresses(deployments);

  // Deploy OETHHarvesterSimple implementation
  const dHarvester = await deployWithConfirmation("OETHHarvesterSimple", [
    assetAddresses.WETH,
  ]);
  await deployWithConfirmation("OETHSimpleHarvesterProxy");
  const cHarvesterProxy = await ethers.getContract("OETHSimpleHarvesterProxy");
  await withConfirmation(
    cHarvesterProxy["initialize(address,address,bytes)"](
      dHarvester.address,
      governorAddr,
      []
    )
  );
  const cHarvester = await ethers.getContractAt(
    "OETHHarvesterSimple",
    cHarvesterProxy.address
  );
  await withConfirmation(
    cHarvester.connect(sGovernor).setStrategistAddr(strategistAddr)
  );

  return cHarvester;
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
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const strategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );

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

  const networkName = await getNetworkName();
  if (networkName == "hoodi") {
    const sGovernor = isFork ? await getSigner() : await getDefenderSigner();
    await withConfirmation(
      strategyProxy.connect(sGovernor).upgradeTo(dStrategyImpl.address)
    );
  }
};

const upgradeCompoundingStakingSSVStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);

  const cOETHVaultProxy = await resolveContract("OETHVaultProxy");
  const cBeaconProofs = await resolveContract("BeaconProofs");
  const strategyProxy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy"
  );

  log("Deploy CompoundingStakingSSVStrategy implementation");

  const genesisTimestamp = isHoodiOrFork
    ? beaconChainGenesisTimeHoodi
    : beaconChainGenesisTimeMainnet;
  const dStrategyImpl = await deployWithConfirmation(
    "CompoundingStakingSSVStrategy",
    [
      [addresses.zero, cOETHVaultProxy.address], //_baseConfig
      assetAddresses.WETH, // wethAddress
      assetAddresses.SSV, // ssvToken
      assetAddresses.SSVNetwork, // ssvNetwork
      assetAddresses.beaconChainDepositContract, // depositContractMock
      cBeaconProofs.address, // BeaconProofs
      genesisTimestamp,
    ]
  );

  const sDeployer = isFork ? await getSigner() : await getDefenderSigner();
  await withConfirmation(
    strategyProxy.connect(sDeployer).upgradeTo(dStrategyImpl.address)
  );

  console.log(
    `Upgraded CompoundingStakingSSVStrategyProxy to implementation at ${dStrategyImpl.address}`
  );
};

/**
 * Deploy NativeStakingSSVStrategy
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployNativeStakingSSVStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  let { governorAddr, deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  if (isHoodiOrFork) {
    governorAddr = deployerAddr;
  }

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
  const networkName = await getNetworkName();

  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  log("Deploy Beacon Proofs");
  await deployWithConfirmation("BeaconProofs", []);
  const cBeaconProofs = await ethers.getContract("BeaconProofs");

  let governorAddress;
  // Deploy the proxy on Hoodi fork not as defender relayer since we will not
  // test SSV token claiming on that testnet
  if ((isTest && !isFork) || networkName == "hoodi") {
    // For unit tests and Hoodi, use the Governor contract
    governorAddress = governorAddr;

    log("Deploy CompoundingStakingSSVStrategyProxy");
    await deployWithConfirmation("CompoundingStakingSSVStrategyProxy");
  } else {
    // For fork tests and mainnet deployments, use the Timelock contract
    governorAddress = addresses.mainnet.Timelock;
    log(`Mainnet governor is the Timelock contract ${governorAddress}`);
  }

  let cCompoundingStakingSSVStrategyProxy;
  if (isTest) {
    log(`Fix CompoundingStakingSSVStrategyProxy address for unit tests`);
    // For unit tests, fix the address of compoundingStakingSSVStrategy so the withdrawal credentials
    // are fixed for the validator public key proofs
    await replaceContractAt(
      addresses.unitTests.CompoundingStakingStrategyProxy,
      await ethers.getContract("CompoundingStakingSSVStrategyProxy")
    );
    // Set the governor in storage of the proxy to the deployer
    await setStorageAt(
      addresses.unitTests.CompoundingStakingStrategyProxy,
      "0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a", // governor storage slot
      deployerAddr
    );
    cCompoundingStakingSSVStrategyProxy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategyProxy",
      addresses.unitTests.CompoundingStakingStrategyProxy
    );
  } else {
    // For fork tests, mainnet and Hoodi deployments.
    // Should have already been deployed by the Defender Relayer as SSV rewards are sent to the deployer.
    // Use the deployStakingProxy Hardhat task to deploy
    cCompoundingStakingSSVStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
  }

  const proxyGovernor = await cCompoundingStakingSSVStrategyProxy.governor();
  log(`CompoundingStakingSSVStrategyProxy's governor: ${proxyGovernor}`);
  if (isFork && proxyGovernor != deployerAddr) {
    // For fork tests, transfer the governance to the deployer account
    const currentSigner = await impersonateAccount(proxyGovernor);
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
  const genesisTimestamp = isHoodiOrFork
    ? beaconChainGenesisTimeHoodi
    : beaconChainGenesisTimeMainnet;
  const dStrategyImpl = await deployWithConfirmation(
    "CompoundingStakingSSVStrategy",
    [
      [addresses.zero, cOETHVaultProxy.address], //_baseConfig
      assetAddresses.WETH, // wethAddress
      assetAddresses.SSV, // ssvToken
      assetAddresses.SSVNetwork, // ssvNetwork
      assetAddresses.beaconChainDepositContract, // depositContractMock
      cBeaconProofs.address, // BeaconProofs
      genesisTimestamp,
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
      [], // reward token addresses
      /* no need to specify WETH as an asset, since we have that overridden in the "supportsAsset"
       * function on the strategy
       */
      [], // asset token addresses
      [], // platform tokens addresses
    ]
  );

  log(
    `Initialize the CompoundingStakingSSVStrategy proxy ${cCompoundingStakingSSVStrategyProxy.address} to implementation ${cStrategyImpl.address} and execute the initialize strategy function using deployer ${deployerAddr}`
  );
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

  log("Deploy CompoundingStakingStrategyView");
  await deployWithConfirmation("CompoundingStakingStrategyView", [
    cCompoundingStakingSSVStrategyProxy.address,
  ]);

  return cStrategy;
};

/**
 * Deploy the OracleRouter.
 * Deprecated
 */
const deployOracles = async () => {};

const deployOETHCore = async () => {
  let { governorAddr, deployerAddr } = await hre.getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  let sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // In case of Hoodie let the deployer be governor.
  if (isHoodiOrFork) {
    console.log("isHoodiOrFork", "YES");
    governorAddr = deployerAddr;
    sGovernor = sDeployer;
  }

  // Proxies
  await deployWithConfirmation("OETHProxy");
  await deployWithConfirmation("OETHVaultProxy");

  // Main contracts
  const dOETH = await deployWithConfirmation("OETH");
  const dOETHVault = await deployWithConfirmation("OETHVault", [
    assetAddresses.WETH,
  ]);

  // Get contract instances
  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);
  const cOETHVault = await ethers.getContractAt(
    "IVault",
    cOETHVaultProxy.address
  );

  // prettier-ignore
  await withConfirmation(
    cOETHProxy.connect(sDeployer)["initialize(address,address,bytes)"](
      dOETH.address,
      governorAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized OETHProxy");
  // prettier-ignore
  await withConfirmation(
    cOETHVaultProxy.connect(sDeployer)["initialize(address,address,bytes)"](
      dOETHVault.address,
      governorAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized OETHVaultProxy");

  await withConfirmation(
    cOETHVault
      .connect(sGovernor)
      .initialize(cOETHProxy.address, await getTxOpts())
  );
  log("Initialized OETHVault");

  await withConfirmation(
    cOETHVaultProxy.connect(sGovernor).upgradeTo(dOETHVault.address)
  );
  log("Upgraded VaultCore implementation");

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
  const { governorAddr, deployerAddr } = await hre.getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // Proxies
  await deployWithConfirmation("OUSDProxy");
  await deployWithConfirmation("VaultProxy");
  log("Deployed OUSD Token and OUSD Vault proxies");

  // Main contracts
  let dOUSD;
  if (isTest) {
    dOUSD = await deployWithConfirmation("TestUpgradedOUSD");
  } else {
    dOUSD = await deployWithConfirmation("OUSD");
  }

  // Deploy Vault implementations
  const dVaultAdmin = await deployWithConfirmation("OUSDVault", [
    assetAddresses.USDC,
  ]);
  log("Deployed OUSD Vault implementations (Core, Admin)");

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

  // Initialize OUSD Token Proxy
  await withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSD Token Proxy");

  // Initialize OUSD Vault Proxy with Vault Core implementation
  // prettier-ignore
  await withConfirmation(
    cVaultProxy.connect(sDeployer)["initialize(address,address,bytes)"](
      dVaultAdmin.address,
      governorAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized OUSD Vault Proxy");

  // Initialize OUSD Vault Core
  await withConfirmation(
    cVault.connect(sGovernor).initialize(cOUSDProxy.address)
  );
  log("Initialized OUSD Vault Core");

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
  log("Initialized OUSD Token");

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
  const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

  // Deploy Sonic SwapX AMO Strategy implementation
  const dSonicSwapXAMOStrategy = await deployWithConfirmation(
    "SonicSwapXAMOStrategy",
    [
      [addresses.sonic.SwapXWSOS.pool, cOSonicVaultProxy.address],
      addresses.sonic.SwapXWSOS.gauge,
    ]
  );

  return dSonicSwapXAMOStrategy;
};

const deploySonicSwapXAMOStrategyImplementationAndInitialize = async () => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cSonicSwapXAMOStrategyProxy = await ethers.getContract(
    "SonicSwapXAMOStrategyProxy"
  );

  // Deploy Sonic SwapX AMO Strategy implementation
  const dSonicSwapXAMOStrategy =
    await deploySonicSwapXAMOStrategyImplementation();

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

const deployOETHSupernovaAMOStrategyImplementation = async () => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cOETHSupernovaAMOStrategyProxy = await ethers.getContract(
    "OETHSupernovaAMOProxy"
  );
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

  // Deploy OETH Supernova AMO Strategy implementation that will serve
  // OETH Supernova AMO
  const dSupernovaAMOStrategy = await deployWithConfirmation(
    "OETHSupernovaAMOStrategy",
    [
      [addresses.mainnet.SupernovaOETHWETH.pool, cOETHVaultProxy.address],
      addresses.mainnet.SupernovaOETHWETH.gauge,
    ]
  );

  const cOETHSupernovaAMOStrategy = await ethers.getContractAt(
    "OETHSupernovaAMOStrategy",
    cOETHSupernovaAMOStrategyProxy.address
  );

  // Initialize OETH Supernova AMO Strategy implementation
  const depositPriceRange = parseUnits("0.01", 18); // 1% or 100 basis points
  const initData = cOETHSupernovaAMOStrategy.interface.encodeFunctionData(
    "initialize(address[],uint256)",
    [[addresses.mainnet.supernovaToken], depositPriceRange]
  );
  await withConfirmation(
    // prettier-ignore
    cOETHSupernovaAMOStrategyProxy
      .connect(sDeployer)["initialize(address,address,bytes)"](
        dSupernovaAMOStrategy.address,
        addresses.mainnet.Timelock,
        initData
      )
  );

  return cOETHSupernovaAMOStrategy;
};

const getCreate2ProxiesFilePath = async () => {
  const networkName =
    isFork || isForkTest || isCI ? "localhost" : await getNetworkName();
  return path.resolve(
    __dirname,
    `./../deployments/${networkName}/create2Proxies.json`
  );
};

const storeCreate2ProxyAddress = async (proxyName, proxyAddress) => {
  const filePath = await getCreate2ProxiesFilePath();

  // Ensure the directory exists before writing the file
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  let existingContents = {};
  if (fs.existsSync(filePath)) {
    existingContents = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  await new Promise((resolve, reject) => {
    fs.writeFile(
      filePath,
      JSON.stringify(
        {
          ...existingContents,
          [proxyName]: proxyAddress,
        },
        undefined,
        2
      ),
      (err) => {
        if (err) {
          console.log("Err:", err);
          reject(err);
          return;
        }
        console.log(
          `Stored create2 proxy address for ${proxyName} at ${filePath}`
        );
        resolve();
      }
    );
  });
};

const getCreate2ProxyAddress = async (proxyName) => {
  const filePath = await getCreate2ProxiesFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Create2 proxies file not found at ${filePath}`);
  }
  const contents = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!contents[proxyName]) {
    throw new Error(`Proxy ${proxyName} not found in ${filePath}`);
  }
  return contents[proxyName];
};

// deploys an instance of InitializeGovernedUpgradeabilityProxy where address is defined by salt
const deployProxyWithCreateX = async (
  salt,
  proxyName,
  verifyContract = false,
  contractPath = null
) => {
  const { deployerAddr } = await getNamedAccounts();

  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // Basically hex of "originprotocol" padded to 20 bytes to mimic an address
  const addrForSalt = "0x0000000000006f726967696e70726f746f636f6c";
  // NOTE: We always use fixed address to compute the salt for the proxy.
  // It makes the address predictable, easier to verify and easier to use
  // with CI and local fork testing.
  log(
    `Deploying ${proxyName} with salt: ${salt} and fixed address: ${addrForSalt}`
  );

  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
  const factoryEncodedSalt = encodeSaltForCreateX(addrForSalt, false, salt);

  const getFactoryBytecode = async () => {
    // No deployment needed—get factory directly from artifacts
    const ProxyContract = await ethers.getContractFactory(proxyName);
    const encodedArgs = ProxyContract.interface.encodeDeploy([deployerAddr]);
    return ethers.utils.hexConcat([ProxyContract.bytecode, encodedArgs]);
  };

  const txResponse = await withConfirmation(
    cCreateX
      .connect(sDeployer)
      .deployCreate2(factoryEncodedSalt, await getFactoryBytecode())
  );

  // // // Create3ProxyContractCreation
  // const create3ContractCreationTopic =
  //   "0x2feea65dd4e9f9cbd86b74b7734210c59a1b2981b5b137bd0ee3e208200c9067";
  const contractCreationTopic =
    "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";

  // const topicToUse = isCreate3 ? create3ContractCreationTopic : contractCreationTopic;
  const txReceipt = await txResponse.wait();
  const proxyAddress = ethers.utils.getAddress(
    `0x${txReceipt.events
      .find((event) => event.topics[0] === contractCreationTopic)
      .topics[1].slice(26)}`
  );

  log(`Deployed ${proxyName} at ${proxyAddress}`);

  await storeCreate2ProxyAddress(proxyName, proxyAddress);

  // Verify contract on Etherscan if requested and on a live network
  // Can be enabled via parameter or VERIFY_CONTRACTS environment variable
  const shouldVerify =
    verifyContract || process.env.VERIFY_CONTRACTS === "true";
  if (shouldVerify && !isTest && !isFork && proxyAddress) {
    // Constructor args for the proxy are [deployerAddr]
    const constructorArgs = [deployerAddr];
    await verifyContractOnEtherscan(
      proxyName,
      proxyAddress,
      constructorArgs,
      proxyName,
      contractPath
    );
  }

  return proxyAddress;
};

// deploys and initializes the CrossChain master strategy
const deployCrossChainMasterStrategyImpl = async (
  proxyAddress,
  targetDomainId,
  remoteStrategyAddress,
  baseToken,
  peerBaseToken,
  vaultAddress,
  implementationName = "CrossChainMasterStrategy",
  skipInitialize = false,
  tokenMessengerAddress = addresses.CCTPTokenMessengerV2,
  messageTransmitterAddress = addresses.CCTPMessageTransmitterV2,
  governor = addresses.mainnet.Timelock
) => {
  const { deployerAddr, multichainStrategistAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  log(`Deploying CrossChainMasterStrategyImpl as deployer ${deployerAddr}`);

  const cCrossChainStrategyProxy = await ethers.getContractAt(
    "CrossChainStrategyProxy",
    proxyAddress
  );

  await deployWithConfirmation(implementationName, [
    [
      addresses.zero, // platform address
      vaultAddress, // vault address
    ],
    [
      tokenMessengerAddress,
      messageTransmitterAddress,
      targetDomainId,
      remoteStrategyAddress,
      baseToken,
      peerBaseToken,
    ],
  ]);
  const dCrossChainMasterStrategy = await ethers.getContract(
    implementationName
  );

  if (!skipInitialize) {
    const initData = dCrossChainMasterStrategy.interface.encodeFunctionData(
      "initialize(address,uint16,uint16)",
      [multichainStrategistAddr, 2000, 0]
    );

    // Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cCrossChainStrategyProxy.connect(sDeployer)[initFunction](
        dCrossChainMasterStrategy.address,
        governor, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );
  }

  return dCrossChainMasterStrategy.address;
};

// deploys and initializes the CrossChain remote strategy
const deployCrossChainRemoteStrategyImpl = async (
  platformAddress, // underlying 4626 vault address
  proxyAddress,
  targetDomainId,
  remoteStrategyAddress,
  baseToken,
  peerBaseToken,
  implementationName = "CrossChainRemoteStrategy",
  tokenMessengerAddress = addresses.CCTPTokenMessengerV2,
  messageTransmitterAddress = addresses.CCTPMessageTransmitterV2,
  governor = addresses.base.timelock,
  initialize = true
) => {
  const { deployerAddr, multichainStrategistAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  log(`Deploying CrossChainRemoteStrategyImpl as deployer ${deployerAddr}`);

  const cCrossChainStrategyProxy = await ethers.getContractAt(
    "CrossChainStrategyProxy",
    proxyAddress
  );

  await deployWithConfirmation(implementationName, [
    [
      platformAddress,
      addresses.zero, // There is no vault on the remote strategy
    ],
    [
      tokenMessengerAddress,
      messageTransmitterAddress,
      targetDomainId,
      remoteStrategyAddress,
      baseToken,
      peerBaseToken,
    ],
  ]);
  const dCrossChainRemoteStrategy = await ethers.getContract(
    implementationName
  );

  if (initialize) {
    const initData = dCrossChainRemoteStrategy.interface.encodeFunctionData(
      "initialize(address,address,uint16,uint16)",
      [multichainStrategistAddr, multichainStrategistAddr, 2000, 0]
    );

    // Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cCrossChainStrategyProxy.connect(sDeployer)[initFunction](
        dCrossChainRemoteStrategy.address,
        governor, // governor
        //initData, // data for delegate call to the initialize function on the strategy
        initData,
        await getTxOpts()
      )
    );
  }

  return dCrossChainRemoteStrategy.address;
};

// deploy the corss chain Master / Remote strategy pair for unit testing
const deployCrossChainUnitTestStrategy = async (usdcAddress) => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const dMasterProxy = await deployWithConfirmation(
    "CrossChainMasterStrategyProxy",
    [deployerAddr],
    "CrossChainStrategyProxy"
  );
  const dRemoteProxy = await deployWithConfirmation(
    "CrossChainRemoteStrategyProxy",
    [deployerAddr],
    "CrossChainStrategyProxy"
  );

  const cVaultProxy = await ethers.getContract("VaultProxy");
  const messageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock"
  );
  const tokenMessenger = await ethers.getContract("CCTPTokenMessengerMock");
  const c4626Vault = await ethers.getContract("MockERC4626Vault");

  await deployCrossChainMasterStrategyImpl(
    dMasterProxy.address,
    6, // Base domain id
    // unit tests differ from mainnet where remote strategy has a different address
    dRemoteProxy.address,
    usdcAddress,
    usdcAddress, // Assume both are same on unit tests
    cVaultProxy.address,
    "CrossChainMasterStrategy",
    false,
    tokenMessenger.address,
    messageTransmitter.address,
    governorAddr
  );

  await deployCrossChainRemoteStrategyImpl(
    c4626Vault.address,
    dRemoteProxy.address,
    0, // Ethereum domain id
    dMasterProxy.address,
    usdcAddress,
    usdcAddress, // Assume both are same on unit tests
    "CrossChainRemoteStrategy",
    tokenMessenger.address,
    messageTransmitter.address,
    governorAddr
  );

  const cCrossChainRemoteStrategy = await ethers.getContractAt(
    "CrossChainRemoteStrategy",
    dRemoteProxy.address
  );
  await withConfirmation(
    cCrossChainRemoteStrategy.connect(sGovernor).safeApproveAllTokens()
  );
  // await withConfirmation(
  //   messageTransmitter.connect(sDeployer).setCCTPTokenMessenger(tokenMessenger.address)
  // );
};

const deploySafeModulesForUnitTests = async () => {
  const cSafeContract = await ethers.getContract("MockSafeContract");
  const usdc = await ethers.getContract("MockUSDC");
  await deployWithConfirmation("MockAutoWithdrawalVault", [usdc.address]);
  const mockAutoWithdrawalVault = await ethers.getContract(
    "MockAutoWithdrawalVault"
  );
  await deployWithConfirmation("AutoWithdrawalModule", [
    cSafeContract.address,
    cSafeContract.address,
    mockAutoWithdrawalVault.address,
    addresses.dead,
  ]);
};

module.exports = {
  deployOracles,
  deployCore,
  deployOETHCore,
  deployOUSDCore,
  deployNativeStakingSSVStrategy,
  deployCompoundingStakingSSVStrategy,
  deploySimpleOETHHarvester,
  configureVault,
  configureOETHVault,
  deployUniswapV3Pool,
  deployVaultValueChecker,
  deployWOusd,
  deployWOeth,
  upgradeNativeStakingSSVStrategy,
  upgradeNativeStakingFeeAccumulator,
  upgradeCompoundingStakingSSVStrategy,
  deployBaseAerodromeAMOStrategyImplementation,
  getPlumeContracts,
  deploySonicSwapXAMOStrategyImplementation,
  deploySonicSwapXAMOStrategyImplementationAndInitialize,
  deployOETHSupernovaAMOStrategyImplementation,
  deployProxyWithCreateX,
  deployCrossChainMasterStrategyImpl,
  deployCrossChainRemoteStrategyImpl,
  deployCrossChainUnitTestStrategy,
  deploySafeModulesForUnitTests,

  getCreate2ProxyAddress,
};
