const hre = require("hardhat");
const { ethers } = hre;
const { formatUnits } = require("ethers/lib/utils");
const mocha = require("mocha");

require("./_global-hooks");

const { hotDeployOption } = require("./_hot-deploy.js");
const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
//const { setChainlinkOraclePrice } = require("../utils/oracle");

const { balancer_rETH_WETH_PID } = require("../utils/constants");
const {
  fundAccounts,
  fundAccountsForOETHUnitTests,
} = require("../utils/funding");
const { deployWithConfirmation } = require("../utils/deploy");

const { replaceContractAt } = require("../utils/hardhat");
const {
  getAssetAddresses,
  usdsUnits,
  getOracleAddresses,
  oethUnits,
  ousdUnits,
  units,
  isTest,
  isFork,
  isHolesky,
  isHoleskyFork,
} = require("./helpers");
const { hardhatSetBalance, setERC20TokenBalance } = require("./_fund");

const usdsAbi = require("./abi/usds.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const erc20Abi = require("./abi/erc20.json");
const morphoAbi = require("./abi/morpho.json");
const morphoLensAbi = require("./abi/morphoLens.json");
const crvMinterAbi = require("./abi/crvMinter.json");
const susdsAbi = require("./abi/sUSDS.json");
const metamorphoAbi = require("./abi/metamorpho.json");

// const curveFactoryAbi = require("./abi/curveFactory.json")
const ousdMetapoolAbi = require("./abi/ousdMetapool.json");
const oethMetapoolAbi = require("./abi/oethMetapool.json");
const threepoolLPAbi = require("./abi/threepoolLP.json");
const threepoolSwapAbi = require("./abi/threepoolSwap.json");
const curveXChainLiquidityGaugeAbi = require("./abi/curveXChainLiquidityGauge.json");
const curveStableSwapNGAbi = require("./abi/curveStableSwapNG.json");

const sfrxETHAbi = require("./abi/sfrxETH.json");
const { defaultAbiCoder, parseUnits } = require("ethers/lib/utils");
const { impersonateAndFund } = require("../utils/signers");

const log = require("../utils/logger")("test:fixtures");

let snapshotId;

const simpleOETHFixture = deployments.createFixture(async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  log(`Forked from block: ${await hre.ethers.provider.getBlockNumber()}`);
  log(`Before deployments with param "${isFork ? undefined : ["unit_tests"]}"`);
  // Run the contract deployments
  await deployments.fixture(isFork ? undefined : ["unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });
  log(`Block after deployments: ${await hre.ethers.provider.getBlockNumber()}`);

  const { governorAddr, multichainStrategistAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const oethProxy = await ethers.getContract("OETHProxy");
  const OETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const oethVault = await ethers.getContractAt(
    "IVault",
    OETHVaultProxy.address
  );
  const oeth = await ethers.getContractAt("OETH", oethProxy.address);

  const cWOETHProxy = await ethers.getContract("WOETHProxy");
  const woeth = await ethers.getContractAt("WOETH", cWOETHProxy.address);

  const oethHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
  const oethHarvester = await ethers.getContractAt(
    "OETHHarvester",
    oethHarvesterProxy.address
  );

  const oethOracleRouter = await ethers.getContract(
    isFork ? "OETHOracleRouter" : "OracleRouter"
  );

  let weth,
    ssv,
    nativeStakingSSVStrategy,
    oethDripper,
    oethFixedRateDripper,
    simpleOETHHarvester;

  if (isFork) {
    let addressContext = addresses.mainnet;
    if (isHolesky || isHoleskyFork) {
      addressContext = addresses.holesky;
    }

    weth = await ethers.getContractAt("IWETH9", addressContext.WETH);
    ssv = await ethers.getContractAt(erc20Abi, addressContext.SSV);

    const oethDripperProxy = await ethers.getContract("OETHDripperProxy");
    oethDripper = await ethers.getContractAt(
      "OETHDripper",
      oethDripperProxy.address
    );

    const oethFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );
    oethFixedRateDripper = await ethers.getContractAt(
      "OETHFixedRateDripper",
      oethFixedRateDripperProxy.address
    );

    const simpleOETHHarvesterProxy = await ethers.getContract(
      "OETHSimpleHarvesterProxy"
    );
    simpleOETHHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      simpleOETHHarvesterProxy.address
    );

    const nativeStakingStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
    );

    nativeStakingSSVStrategy = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      nativeStakingStrategyProxy.address
    );
  } else {
    weth = await ethers.getContract("MockWETH");
    ssv = await ethers.getContract("MockSSV");

    const nativeStakingStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
    );
    nativeStakingSSVStrategy = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      nativeStakingStrategyProxy.address
    );
  }

  if (!isFork) {
    // Enable capital movement
    await oethVault.connect(sGovernor).unpauseCapital();
  }

  const signers = await hre.ethers.getSigners();
  let governor = signers[1];
  let strategist = signers[0];

  const [matt, josh, anna, domen, daniel, franck] = signers.slice(4);

  if (isFork) {
    governor = await impersonateAndFund(governorAddr);
    strategist = await impersonateAndFund(multichainStrategistAddr);

    for (const user of [matt, josh, anna, domen, daniel, franck]) {
      // Everyone gets free weth
      await setERC20TokenBalance(user.address, weth, "1000000", hre);
      // And vault can rug them all
      await resetAllowance(weth, user, oethVault.address);
    }
  } else {
    // Fund WETH contract
    await hardhatSetBalance(weth.address, "999999999999999");

    // Fund all with mockTokens
    await fundAccountsForOETHUnitTests();

    // Reset allowances
    for (const user of [matt, josh, domen, daniel, franck]) {
      await resetAllowance(weth, user, oethVault.address);
    }
  }

  return {
    // Accounts
    matt,
    josh,
    anna,
    governor,
    strategist,
    domen,
    daniel,
    franck,
    // Contracts
    oethOracleRouter,
    // Assets
    ssv,
    weth,
    // OETH
    oethVault,
    oeth,
    woeth,
    nativeStakingSSVStrategy,
    oethDripper,
    oethFixedRateDripper,
    oethHarvester,
    simpleOETHHarvester,
  };
});

const getVaultAndTokenConracts = async () => {
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  // the same contract as the "ousd" one just with some unlocked features
  const ousdUnlocked = await ethers.getContractAt(
    "TestUpgradedOUSD",
    ousdProxy.address
  );

  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  const oethProxy = await ethers.getContract("OETHProxy");
  const OETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const oethVault = await ethers.getContractAt(
    "IVault",
    OETHVaultProxy.address
  );
  const oeth = await ethers.getContractAt("OETH", oethProxy.address);

  let mockNonRebasing, mockNonRebasingTwo;

  const woethProxy = await ethers.getContract("WOETHProxy");
  const woeth = await ethers.getContractAt("WOETH", woethProxy.address);

  if (!isFork) {
    // Mock contracts for testing rebase opt out
    mockNonRebasing = await ethers.getContract("MockNonRebasing");
    await mockNonRebasing.setOUSD(ousd.address);
    mockNonRebasingTwo = await ethers.getContract("MockNonRebasingTwo");
    await mockNonRebasingTwo.setOUSD(ousd.address);
  }

  return {
    ousd,
    ousdUnlocked,
    vault,
    oethVault,
    oeth,
    woeth,
    mockNonRebasing,
    mockNonRebasingTwo,
  };
};

/**
 * This fixture creates the 4 different OUSD contract account types in all of
 * the possible storage configuration: StdRebasing, StdNonRebasing, YieldDelegationSource,
 * YieldDelegationTarget
 */
const createAccountTypes = async ({ vault, ousd, ousdUnlocked, deploy }) => {
  const signers = await hre.ethers.getSigners();
  const matt = signers[4];
  const governor = signers[1];

  if (!isFork) {
    await fundAccounts();
    const usds = await ethers.getContract("MockUSDS");
    await usds.connect(matt).approve(vault.address, usdsUnits("1000"));
    await vault.connect(matt).mint(usds.address, usdsUnits("1000"), 0);
  }

  const createAccount = async () => {
    let account = ethers.Wallet.createRandom();
    // Give ETH to user
    await hardhatSetBalance(account.address, "1000000");
    account = account.connect(ethers.provider);
    return account;
  };

  const createContract = async (name) => {
    const fullName = `MockNonRebasing_${name}`;
    await deploy(fullName, {
      from: matt.address,
      contract: "MockNonRebasing",
    });

    const contract = await ethers.getContract(fullName);
    await contract.setOUSD(ousd.address);

    return contract;
  };

  // generate alternativeCreditsPerToken BigNumber and creditBalance BigNumber
  // for a given credits per token
  const generateCreditsBalancePair = ({ creditsPerToken, tokenBalance }) => {
    const creditsPerTokenBN = parseUnits(`${creditsPerToken}`, 27);
    // 1e18 * 1e27 / 1e18
    const creditsBalanceBN = tokenBalance
      .mul(creditsPerTokenBN)
      .div(parseUnits("1", 18));

    return {
      creditsPerTokenBN,
      creditsBalanceBN,
    };
  };

  const createNonRebasingNotSetAlternativeCptContract = async ({
    name,
    creditsPerToken,
    balance,
  }) => {
    const nonrebase_cotract_notSet_altcpt_gt = await createContract(name);
    await ousd
      .connect(matt)
      .transfer(nonrebase_cotract_notSet_altcpt_gt.address, balance);
    const { creditsPerTokenBN, creditsBalanceBN } = generateCreditsBalancePair({
      creditsPerToken,
      tokenBalance: balance,
    });
    await ousdUnlocked
      .connect(matt)
      .overwriteCreditBalances(
        nonrebase_cotract_notSet_altcpt_gt.address,
        creditsBalanceBN
      );
    await ousdUnlocked
      .connect(matt)
      .overwriteAlternativeCPT(
        nonrebase_cotract_notSet_altcpt_gt.address,
        creditsPerTokenBN
      );
    await ousdUnlocked.connect(matt).overwriteRebaseState(
      nonrebase_cotract_notSet_altcpt_gt.address,
      0 // NotSet
    );

    return nonrebase_cotract_notSet_altcpt_gt;
  };

  const rebase_eoa_notset_0 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_eoa_notset_0.address, ousdUnits("11"));
  const rebase_eoa_notset_1 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_eoa_notset_1.address, ousdUnits("12"));

  const rebase_eoa_stdRebasing_0 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_eoa_stdRebasing_0.address, ousdUnits("21"));
  await ousd.connect(rebase_eoa_stdRebasing_0).rebaseOptOut();
  await ousd.connect(rebase_eoa_stdRebasing_0).rebaseOptIn();
  const rebase_eoa_stdRebasing_1 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_eoa_stdRebasing_1.address, ousdUnits("22"));
  await ousd.connect(rebase_eoa_stdRebasing_1).rebaseOptOut();
  await ousd.connect(rebase_eoa_stdRebasing_1).rebaseOptIn();

  const rebase_contract_0 = await createContract("rebase_contract_0");
  await ousd.connect(matt).transfer(rebase_contract_0.address, ousdUnits("33"));
  await rebase_contract_0.connect(matt).rebaseOptIn();
  const rebase_contract_1 = await createContract("rebase_contract_1");
  await ousd.connect(matt).transfer(rebase_contract_1.address, ousdUnits("34"));
  await rebase_contract_1.connect(matt).rebaseOptIn();

  const nonrebase_eoa_0 = await createAccount();
  await ousd.connect(matt).transfer(nonrebase_eoa_0.address, ousdUnits("44"));
  await ousd.connect(nonrebase_eoa_0).rebaseOptOut();
  const nonrebase_eoa_1 = await createAccount();
  await ousd.connect(matt).transfer(nonrebase_eoa_1.address, ousdUnits("45"));
  await ousd.connect(nonrebase_eoa_1).rebaseOptOut();

  const nonrebase_cotract_0 = await createContract("nonrebase_cotract_0");
  await ousd
    .connect(matt)
    .transfer(nonrebase_cotract_0.address, ousdUnits("55"));
  await nonrebase_cotract_0.connect(matt).rebaseOptIn();
  await nonrebase_cotract_0.connect(matt).rebaseOptOut();
  const nonrebase_cotract_1 = await createContract("nonrebase_cotract_1");
  await ousd
    .connect(matt)
    .transfer(nonrebase_cotract_1.address, ousdUnits("56"));
  await nonrebase_cotract_1.connect(matt).rebaseOptIn();
  await nonrebase_cotract_1.connect(matt).rebaseOptOut();

  const nonrebase_cotract_notSet_0 = await createContract(
    "nonrebase_cotract_notSet_0"
  );
  const nonrebase_cotract_notSet_1 = await createContract(
    "nonrebase_cotract_notSet_1"
  );

  const nonrebase_cotract_notSet_altcpt_gt_0 =
    await createNonRebasingNotSetAlternativeCptContract({
      name: "nonrebase_cotract_notSet_altcpt_gt_0",
      creditsPerToken: 0.934232,
      balance: ousdUnits("65"),
    });

  const nonrebase_cotract_notSet_altcpt_gt_1 =
    await createNonRebasingNotSetAlternativeCptContract({
      name: "nonrebase_cotract_notSet_altcpt_gt_1",
      creditsPerToken: 0.890232,
      balance: ousdUnits("66"),
    });

  const rebase_delegate_source_0 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_delegate_source_0.address, ousdUnits("76"));
  const rebase_delegate_target_0 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_delegate_target_0.address, ousdUnits("77"));

  await ousd
    .connect(governor)
    .delegateYield(
      rebase_delegate_source_0.address,
      rebase_delegate_target_0.address
    );

  const rebase_delegate_source_1 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_delegate_source_1.address, ousdUnits("87"));
  const rebase_delegate_target_1 = await createAccount();
  await ousd
    .connect(matt)
    .transfer(rebase_delegate_target_1.address, ousdUnits("88"));

  await ousd
    .connect(governor)
    .delegateYield(
      rebase_delegate_source_1.address,
      rebase_delegate_target_1.address
    );

  // matt burn remaining OUSD
  await vault
    .connect(matt)
    .redeem(ousd.balanceOf(matt.address), ousdUnits("0"));

  return {
    // StdRebasing account type:
    // - all have alternativeCreditsPerToken = 0
    // - _creditBalances non zero using global contract's rebasingCredits to compute balance

    // EOA account that has rebaseState: NotSet
    rebase_eoa_notset_0,
    rebase_eoa_notset_1,
    // EOA account that has rebaseState: StdRebasing
    rebase_eoa_stdRebasing_0,
    rebase_eoa_stdRebasing_1,
    // contract account that has rebaseState: StdRebasing
    rebase_contract_0,
    rebase_contract_1,

    // StdNonRebasing account type:
    // - alternativeCreditsPerToken > 0 & 1e18 for new accounts
    // - _creditBalances non zero:
    //   - new accounts match _creditBalances to their token balance
    //   - older accounts use _creditBalances & alternativeCreditsPerToken to compute token balance

    // EOA account that has rebaseState: StdNonRebasing
    nonrebase_eoa_0,
    nonrebase_eoa_1,
    // contract account that has rebaseState: StdNonRebasing
    nonrebase_cotract_0,
    nonrebase_cotract_1,
    // contract account that has rebaseState: NotSet
    nonrebase_cotract_notSet_0,
    nonrebase_cotract_notSet_1,
    // contract account that has rebaseState: NotSet & alternativeCreditsPerToken > 0
    // note: these are older accounts that have been migrated by the older versions of
    //       of the code without explicitly setting rebaseState to StdNonRebasing
    nonrebase_cotract_notSet_altcpt_gt_0,
    nonrebase_cotract_notSet_altcpt_gt_1,

    // account delegating yield
    rebase_delegate_source_0,
    rebase_delegate_source_1,

    // account receiving delegated yield
    rebase_delegate_target_0,
    rebase_delegate_target_1,
  };
};

/**
 * Vault and token fixture with extra functionality regarding different types of accounts
 * (rebaseStates and alternativeCreditsPerToken ) when testing token contract behaviour
 */
const loadTokenTransferFixture = deployments.createFixture(async () => {
  log(`Forked from block: ${await hre.ethers.provider.getBlockNumber()}`);

  log(`Before deployments with param "${isFork ? undefined : ["unit_tests"]}"`);

  // Run the contract deployments
  await deployments.fixture(isFork ? undefined : ["unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  log(`Block after deployments: ${await hre.ethers.provider.getBlockNumber()}`);

  const { governorAddr, multichainStrategistAddr, timelockAddr } =
    await getNamedAccounts();

  const vaultAndTokenConracts = await getVaultAndTokenConracts();

  const signers = await hre.ethers.getSigners();
  let governor = signers[1];
  let strategist = signers[0];

  const accountTypes = await createAccountTypes({
    ousd: vaultAndTokenConracts.ousd,
    ousdUnlocked: vaultAndTokenConracts.ousdUnlocked,
    vault: vaultAndTokenConracts.vault,
    deploy: deployments.deploy,
  });

  return {
    ...vaultAndTokenConracts,
    ...accountTypes,
    governorAddr,
    strategistAddr: multichainStrategistAddr,
    timelockAddr,
    governor,
    strategist,
  };
});

const defaultFixture = deployments.createFixture(async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  log(`Forked from block: ${await hre.ethers.provider.getBlockNumber()}`);

  log(`Before deployments with param "${isFork ? undefined : ["unit_tests"]}"`);

  // Run the contract deployments
  await deployments.fixture(isFork ? undefined : ["unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  log(`Block after deployments: ${await hre.ethers.provider.getBlockNumber()}`);

  const { governorAddr, multichainStrategistAddr, timelockAddr } =
    await getNamedAccounts();

  const vaultAndTokenConracts = await getVaultAndTokenConracts();

  const harvesterProxy = await ethers.getContract("HarvesterProxy");
  const harvester = await ethers.getContractAt(
    "Harvester",
    harvesterProxy.address
  );
  const oethHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
  const oethHarvester = await ethers.getContractAt(
    "OETHHarvester",
    oethHarvesterProxy.address
  );

  const dripperProxy = await ethers.getContract("DripperProxy");
  const dripper = await ethers.getContractAt("Dripper", dripperProxy.address);
  const wousdProxy = await ethers.getContract("WrappedOUSDProxy");
  const wousd = await ethers.getContractAt("WrappedOusd", wousdProxy.address);
  const CompoundStrategyFactory = await ethers.getContractFactory(
    "CompoundStrategy"
  );

  const compoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundStrategyProxy.address
  );

  const convexStrategyProxy = await ethers.getContract("ConvexStrategyProxy");
  const convexStrategy = await ethers.getContractAt(
    "ConvexStrategy",
    convexStrategyProxy.address
  );

  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const aaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    aaveStrategyProxy.address
  );

  const oracleRouter = await ethers.getContract("OracleRouter");
  const oethOracleRouter = await ethers.getContract(
    isFork ? "OETHOracleRouter" : "OracleRouter"
  );

  const nativeStakingStrategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const nativeStakingSSVStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    nativeStakingStrategyProxy.address
  );

  const nativeStakingFeeAccumulatorProxy = await ethers.getContract(
    "NativeStakingFeeAccumulatorProxy"
  );
  const nativeStakingFeeAccumulator = await ethers.getContractAt(
    "FeeAccumulator",
    nativeStakingFeeAccumulatorProxy.address
  );

  const morphoSteakhouseUSDCStrategyProxy = !isFork
    ? undefined
    : await ethers.getContract("MetaMorphoStrategyProxy");
  const morphoSteakhouseUSDCStrategy = !isFork
    ? undefined
    : await ethers.getContractAt(
        "Generalized4626Strategy",
        morphoSteakhouseUSDCStrategyProxy.address
      );

  const morphoGauntletPrimeUSDCStrategyProxy = !isFork
    ? undefined
    : await ethers.getContract("MorphoGauntletPrimeUSDCStrategyProxy");
  const morphoGauntletPrimeUSDCStrategy = !isFork
    ? undefined
    : await ethers.getContractAt(
        "Generalized4626Strategy",
        morphoGauntletPrimeUSDCStrategyProxy.address
      );

  const morphoGauntletPrimeUSDTStrategyProxy = !isFork
    ? undefined
    : await ethers.getContract("MorphoGauntletPrimeUSDTStrategyProxy");
  const morphoGauntletPrimeUSDTStrategy = !isFork
    ? undefined
    : await ethers.getContractAt(
        "Generalized4626USDTStrategy",
        morphoGauntletPrimeUSDTStrategyProxy.address
      );

  const curvePoolBooster = isFork
    ? await ethers.getContractAt(
        "CurvePoolBooster",
        "0xF4c001dfe53C584425d7943395C7E57b10BD1DC8" // hardcoded as generated with CreateX.
      )
    : undefined;

  const simpleHarvesterProxy = isFork
    ? await ethers.getContract("OETHSimpleHarvesterProxy")
    : undefined;

  const simpleOETHHarvester = isFork
    ? await ethers.getContractAt(
        "OETHHarvesterSimple",
        simpleHarvesterProxy.address
      )
    : undefined;

  const oethFixedRateDripperProxy = !isFork
    ? undefined
    : await ethers.getContract("OETHFixedRateDripperProxy");
  const oethFixedRateDripper = !isFork
    ? undefined
    : await ethers.getContractAt(
        "OETHFixedRateDripper",
        oethFixedRateDripperProxy.address
      );

  const OUSDCurveAMOProxy = isFork
    ? await ethers.getContract("OUSDCurveAMOProxy")
    : undefined;
  const OUSDCurveAMO = isFork
    ? await ethers.getContractAt("CurveAMOStrategy", OUSDCurveAMOProxy.address)
    : undefined;

  const curvePoolOusdUsdc = await ethers.getContractAt(
    curveStableSwapNGAbi,
    addresses.mainnet.curve.OUSD_USDC.pool
  );
  const curveGaugeOusdUsdc = await ethers.getContractAt(
    curveXChainLiquidityGaugeAbi,
    addresses.mainnet.curve.OUSD_USDC.gauge
  );

  const OETHCurveAMOProxy = isFork
    ? await ethers.getContract("OETHCurveAMOProxy")
    : undefined;
  const OETHCurveAMO = isFork
    ? await ethers.getContractAt("CurveAMOStrategy", OETHCurveAMOProxy.address)
    : undefined;

  const curvePoolOETHWETH = await ethers.getContractAt(
    curveStableSwapNGAbi,
    addresses.mainnet.curve.OETH_WETH.pool
  );
  const curveGaugeOETHWETH = await ethers.getContractAt(
    curveXChainLiquidityGaugeAbi,
    addresses.mainnet.curve.OETH_WETH.gauge
  );

  let usdt,
    usds,
    tusd,
    usdc,
    weth,
    ogn,
    ogv,
    nonStandardToken,
    cusdt,
    cusdc,
    comp,
    adai,
    ausdt,
    ausdc,
    aave,
    aaveToken,
    stkAave,
    aaveIncentivesController,
    reth,
    stETH,
    frxETH,
    sfrxETH,
    sUSDS,
    morphoSteakHouseUSDCVault,
    morphoGauntletPrimeUSDCVault,
    morphoGauntletPrimeUSDTVault,
    ssv;

  let chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedUSDS,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    crv,
    crvMinter,
    aura,
    bal,
    threePool,
    threePoolToken,
    metapoolToken,
    morpho,
    morphoToken,
    legacyMorphoToken,
    morphoCompoundStrategy,
    balancerREthStrategy,
    makerSSRStrategy,
    morphoAaveStrategy,
    oethMorphoAaveStrategy,
    morphoLens,
    threePoolGauge,
    aaveAddressProvider,
    cvx,
    cvxBooster,
    cvxRewardPool,
    depositContractUtils,
    oethDripper,
    oethZapper,
    swapper,
    mockSwapper,
    swapper1Inch,
    mock1InchSwapRouter,
    convexEthMetaStrategy,
    vaultValueChecker,
    oethVaultValueChecker;

  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    usds = await ethers.getContractAt(usdsAbi, addresses.mainnet.USDS);
    usdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.USDC);
    weth = await ethers.getContractAt("IWETH9", addresses.mainnet.WETH);
    cusdt = await ethers.getContractAt(erc20Abi, addresses.mainnet.cUSDT);
    cusdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.cUSDC);
    comp = await ethers.getContractAt(erc20Abi, addresses.mainnet.COMP);
    crv = await ethers.getContractAt(erc20Abi, addresses.mainnet.CRV);
    cvx = await ethers.getContractAt(erc20Abi, addresses.mainnet.CVX);
    ogn = await ethers.getContractAt(erc20Abi, addresses.mainnet.OGN);
    aave = await ethers.getContractAt(erc20Abi, addresses.mainnet.Aave);
    ausdt = await ethers.getContractAt(erc20Abi, addresses.mainnet.aUSDT);
    ausdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.aUSDC);
    adai = await ethers.getContractAt(erc20Abi, addresses.mainnet.aDAI);
    reth = await ethers.getContractAt("IRETH", addresses.mainnet.rETH);
    frxETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.frxETH);
    sfrxETH = await ethers.getContractAt(sfrxETHAbi, addresses.mainnet.sfrxETH);
    stETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.stETH);
    sUSDS = await ethers.getContractAt(susdsAbi, addresses.mainnet.sUSDS);
    morpho = await ethers.getContractAt(morphoAbi, addresses.mainnet.Morpho);
    morphoLens = await ethers.getContractAt(
      morphoLensAbi,
      addresses.mainnet.MorphoLens
    );
    morphoSteakHouseUSDCVault = await ethers.getContractAt(
      metamorphoAbi,
      addresses.mainnet.MorphoSteakhouseUSDCVault
    );
    morphoGauntletPrimeUSDCVault = await ethers.getContractAt(
      metamorphoAbi,
      addresses.mainnet.MorphoGauntletPrimeUSDCVault
    );
    morphoGauntletPrimeUSDTVault = await ethers.getContractAt(
      metamorphoAbi,
      addresses.mainnet.MorphoGauntletPrimeUSDTVault
    );
    morphoToken = await ethers.getContractAt(
      erc20Abi,
      addresses.mainnet.MorphoToken
    );
    legacyMorphoToken = await ethers.getContractAt(
      erc20Abi,
      addresses.mainnet.LegacyMorphoToken
    );
    aura = await ethers.getContractAt(erc20Abi, addresses.mainnet.AURA);
    bal = await ethers.getContractAt(erc20Abi, addresses.mainnet.BAL);
    ogv = await ethers.getContractAt(erc20Abi, addresses.mainnet.OGV);
    ssv = await ethers.getContractAt(erc20Abi, addresses.mainnet.SSV);

    crvMinter = await ethers.getContractAt(
      crvMinterAbi,
      addresses.mainnet.CRVMinter
    );
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      addresses.mainnet.AAVE_ADDRESS_PROVIDER
    );
    cvxBooster = await ethers.getContractAt(
      "MockBooster",
      addresses.mainnet.CVXBooster
    );
    cvxRewardPool = await ethers.getContractAt(
      "IRewardStaking",
      addresses.mainnet.CVXRewardsPool
    );

    const makerSSRStrategyProxy = await ethers.getContract(
      "MakerSSRStrategyProxy"
    );
    makerSSRStrategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      makerSSRStrategyProxy.address
    );

    const morphoCompoundStrategyProxy = await ethers.getContract(
      "MorphoCompoundStrategyProxy"
    );
    morphoCompoundStrategy = await ethers.getContractAt(
      "MorphoCompoundStrategy",
      morphoCompoundStrategyProxy.address
    );

    const morphoAaveStrategyProxy = await ethers.getContract(
      "MorphoAaveStrategyProxy"
    );
    morphoAaveStrategy = await ethers.getContractAt(
      "MorphoAaveStrategy",
      morphoAaveStrategyProxy.address
    );

    const oethMorphoAaveStrategyProxy = await ethers.getContract(
      "OETHMorphoAaveStrategyProxy"
    );
    oethMorphoAaveStrategy = await ethers.getContractAt(
      "MorphoAaveStrategy",
      oethMorphoAaveStrategyProxy.address
    );

    const balancerRethStrategyProxy = await ethers.getContract(
      "OETHBalancerMetaPoolrEthStrategyProxy"
    );
    balancerREthStrategy = await ethers.getContractAt(
      "BalancerMetaPoolStrategy",
      balancerRethStrategyProxy.address
    );

    const convexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );
    convexEthMetaStrategy = await ethers.getContractAt(
      "ConvexEthMetaStrategy",
      convexEthMetaStrategyProxy.address
    );

    const oethDripperProxy = await ethers.getContract("OETHDripperProxy");
    oethDripper = await ethers.getContractAt(
      "OETHDripper",
      oethDripperProxy.address
    );

    oethZapper = await ethers.getContract("OETHZapper");

    swapper = await ethers.getContract("Swapper1InchV5");

    vaultValueChecker = await ethers.getContract("VaultValueChecker");
    oethVaultValueChecker = await ethers.getContract("OETHVaultValueChecker");
  } else {
    usdt = await ethers.getContract("MockUSDT");
    usds = await ethers.getContract("MockUSDS");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    weth = await ethers.getContractAt("MockWETH", addresses.mainnet.WETH);
    ogn = await ethers.getContract("MockOGN");
    ogv = await ethers.getContract("MockOGV");
    reth = await ethers.getContract("MockRETH");
    frxETH = await ethers.getContract("MockfrxETH");
    sfrxETH = await ethers.getContract("MocksfrxETH");
    // // Note: Not used anywhere in unit tests
    sUSDS = undefined;
    stETH = await ethers.getContract("MockstETH");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
    ssv = await ethers.getContract("MockSSV");

    cusdt = await ethers.getContract("MockCUSDT");
    cusdc = await ethers.getContract("MockCUSDC");
    comp = await ethers.getContract("MockCOMP");
    bal = await ethers.getContract("MockBAL");
    aura = await ethers.getContract("MockAura");

    crv = await ethers.getContract("MockCRV");
    cvx = await ethers.getContract("MockCVX");
    crvMinter = await ethers.getContract("MockCRVMinter");
    threePool = await ethers.getContract("MockCurvePool");
    threePoolToken = await ethers.getContract("Mock3CRV");
    metapoolToken = await ethers.getContract("MockCurveMetapool");
    threePoolGauge = await ethers.getContract("MockCurveGauge");
    cvxBooster = await ethers.getContract("MockBooster");
    cvxRewardPool = await ethers.getContract("MockRewardPool");
    depositContractUtils = await ethers.getContract("DepositContractUtils");

    adai = await ethers.getContract("MockADAI");
    aaveToken = await ethers.getContract("MockAAVEToken");
    aave = await ethers.getContract("MockAave");
    // currently in test the mockAave is itself the address provder
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      aave.address
    );
    stkAave = await ethers.getContract("MockStkAave");
    aaveIncentivesController = await ethers.getContract(
      "MockAaveIncentivesController"
    );

    chainlinkOracleFeedDAI = await ethers.getContract(
      "MockChainlinkOracleFeedDAI"
    );
    chainlinkOracleFeedUSDS = await ethers.getContract(
      "MockChainlinkOracleFeedUSDS"
    );
    chainlinkOracleFeedUSDT = await ethers.getContract(
      "MockChainlinkOracleFeedUSDT"
    );
    chainlinkOracleFeedUSDC = await ethers.getContract(
      "MockChainlinkOracleFeedUSDC"
    );
    chainlinkOracleFeedOGNETH = await ethers.getContract(
      "MockChainlinkOracleFeedOGNETH"
    );
    chainlinkOracleFeedETH = await ethers.getContract(
      "MockChainlinkOracleFeedETH"
    );

    swapper = await ethers.getContract("MockSwapper");
    mockSwapper = await ethers.getContract("MockSwapper");
    swapper1Inch = await ethers.getContract("Swapper1InchV5");
    mock1InchSwapRouter = await ethers.getContract("Mock1InchSwapRouter");
  }

  if (!isFork) {
    const assetAddresses = await getAssetAddresses(deployments);

    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Add TUSD in fixture, it is disabled by default in deployment
    await vaultAndTokenConracts.vault
      .connect(sGovernor)
      .supportAsset(assetAddresses.TUSD, 0);

    // Enable capital movement
    await vaultAndTokenConracts.vault.connect(sGovernor).unpauseCapital();
  }

  const signers = await hre.ethers.getSigners();
  let governor = signers[1];
  let strategist = signers[0];
  const adjuster = signers[0];
  let timelock;
  let oldTimelock;

  const [matt, josh, anna, domen, daniel, franck] = signers.slice(4);

  if (isFork) {
    governor = await impersonateAndFund(governorAddr);
    strategist = await impersonateAndFund(multichainStrategistAddr);
    timelock = await impersonateAndFund(timelockAddr);
    oldTimelock = await impersonateAndFund(addresses.mainnet.OldTimelock);

    // Just a hack to get around using `.getAddress()` on the signer
    governor.address = governorAddr;
    strategist.address = multichainStrategistAddr;
    timelock.address = timelockAddr;
    oldTimelock.address = addresses.mainnet.OldTimelock;
  } else {
    timelock = governor;
  }

  if (!isFork) {
    await fundAccounts();

    // Matt and Josh each have $100 OUSD & 100 OETH
    for (const user of [matt, josh]) {
      await usds
        .connect(user)
        .approve(vaultAndTokenConracts.vault.address, usdsUnits("100"));
      await vaultAndTokenConracts.vault
        .connect(user)
        .mint(usds.address, usdsUnits("100"), 0);

      // Fund WETH contract
      await hardhatSetBalance(user.address, "50000");
      await weth.connect(user).deposit({ value: oethUnits("10000") });
      await weth
        .connect(user)
        .approve(vaultAndTokenConracts.oethVault.address, oethUnits("100"));
    }
  }

  return {
    ...vaultAndTokenConracts,
    // Accounts
    matt,
    josh,
    anna,
    governor,
    strategist,
    adjuster,
    domen,
    daniel,
    franck,
    timelock,
    oldTimelock,
    // Contracts
    vaultValueChecker,
    harvester,
    dripper,
    // Oracle
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedUSDS,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    compoundStrategy,
    oracleRouter,
    oethOracleRouter,
    // Assets
    usdt,
    usds,
    sUSDS,
    tusd,
    usdc,
    ogn,
    ssv,
    weth,
    ogv,
    reth,
    stETH,
    nonStandardToken,
    // cTokens
    cusdc,
    cusdt,
    comp,
    // aTokens,
    adai,
    ausdt,
    ausdc,
    // CompoundStrategy contract factory to deploy
    CompoundStrategyFactory,
    crv,
    crvMinter,
    threePool,
    threePoolGauge,
    threePoolToken,
    metapoolToken,
    morpho,
    morphoLens,
    convexStrategy,
    makerSSRStrategy,
    morphoCompoundStrategy,
    morphoAaveStrategy,
    cvx,
    cvxBooster,
    cvxRewardPool,
    depositContractUtils,

    aaveStrategy,
    aaveToken,
    aaveAddressProvider,
    aaveIncentivesController,
    aave,
    stkAave,
    // uniswapPairOUSD_USDT,
    // liquidityRewardOUSD_USDT,
    wousd,
    morphoSteakhouseUSDCStrategy,
    morphoSteakHouseUSDCVault,
    morphoGauntletPrimeUSDCStrategy,
    morphoGauntletPrimeUSDCVault,
    morphoGauntletPrimeUSDTStrategy,
    morphoGauntletPrimeUSDTVault,
    curvePoolBooster,
    simpleOETHHarvester,
    oethFixedRateDripper,
    OUSDCurveAMO,
    curvePoolOusdUsdc,
    curveGaugeOusdUsdc,
    OETHCurveAMO,
    curvePoolOETHWETH,
    curveGaugeOETHWETH,

    // OETH
    oethVaultValueChecker,
    frxETH,
    sfrxETH,
    nativeStakingSSVStrategy,
    nativeStakingFeeAccumulator,
    balancerREthStrategy,
    oethMorphoAaveStrategy,
    convexEthMetaStrategy,
    oethDripper,
    oethHarvester,
    oethZapper,
    swapper,
    mockSwapper,
    swapper1Inch,
    mock1InchSwapRouter,
    aura,
    bal,

    morphoToken,
    legacyMorphoToken,
  };
});

async function oethDefaultFixture() {
  // TODO: Trim it down to only do OETH things
  const fixture = await defaultFixture();

  const { weth, reth, stETH, frxETH, sfrxETH } = fixture;
  const { matt, josh, domen, daniel, franck, oethVault } = fixture;

  if (isFork) {
    for (const user of [matt, josh, domen, daniel, franck]) {
      // Everyone gets free tokens
      for (const token of [weth, reth, stETH, frxETH, sfrxETH]) {
        await setERC20TokenBalance(user.address, token, "1000000", hre);

        // And vault can rug them all
        await resetAllowance(token, user, oethVault.address);
      }
    }
  } else {
    // Replace frxETHMinter
    await replaceContractAt(
      addresses.mainnet.FraxETHMinter,
      await ethers.getContract("MockFrxETHMinter")
    );

    // Fund WETH contract
    await hardhatSetBalance(weth.address, "999999999999999");

    // Fund all with mockTokens
    await fundAccountsForOETHUnitTests();

    // Reset allowances
    for (const user of [matt, josh, domen, daniel, franck]) {
      for (const asset of [weth, reth, stETH, frxETH, sfrxETH]) {
        await resetAllowance(asset, user, oethVault.address);
      }
    }
  }

  return fixture;
}

async function oethCollateralSwapFixture() {
  const fixture = await oethDefaultFixture();

  return fixture;

  // const { reth, stETH, matt, strategist, timelock, oethVault } = fixture;

  // const bufferBps = await oethVault.vaultBuffer();
  // const shouldChangeBuffer = bufferBps.lt(oethUnits("1"));

  // if (shouldChangeBuffer) {
  //   // If it's not 100% already, set it to 100%
  //   await oethVault.connect(strategist).setVaultBuffer(
  //     oethUnits("1") // 100%
  //   );
  // }

  // for (const token of [reth, stETH]) {
  //   await token
  //     .connect(matt)
  //     .approve(
  //       oethVault.address,
  //       parseEther("100000000000000000000000000000000000")
  //     );

  //   // Transfer some tokens to the Vault so they can be swapped out
  //   await token.connect(matt).transfer(oethVault.address, parseEther("200"));
  // }

  // if (shouldChangeBuffer) {
  //   // Set it back
  //   await oethVault.connect(strategist).setVaultBuffer(bufferBps);
  // }

  // // Withdraw all from strategies so we have assets to swap
  // await oethVault.connect(timelock).withdrawAllFromStrategies();

  // return fixture;
}

async function ousdCollateralSwapFixture() {
  const fixture = await defaultFixture();

  const { usds, usdc, usdt, matt, strategist, timelock, vault } = fixture;

  const bufferBps = await vault.vaultBuffer();
  const shouldChangeBuffer = bufferBps.lt(ousdUnits("1"));

  if (shouldChangeBuffer) {
    // If it's not 100% already, set it to 100%
    await vault.connect(strategist).setVaultBuffer(
      ousdUnits("1") // 100%
    );
  }

  await usdt.connect(matt).approve(vault.address, 0);
  for (const token of [usds, usdc, usdt]) {
    await token
      .connect(matt)
      .approve(vault.address, await units("10000", token));

    // Mint some tokens, so it ends up in Vault
    await vault.connect(matt).mint(token.address, await units("500", token), 0);
  }

  if (shouldChangeBuffer) {
    // Set it back
    await vault.connect(strategist).setVaultBuffer(bufferBps);
  }

  // Withdraw all from strategies so we have assets to swap
  await vault.connect(timelock).withdrawAllFromStrategies();

  return fixture;
}

async function oeth1InchSwapperFixture() {
  const fixture = await oethDefaultFixture();
  const { mock1InchSwapRouter } = fixture;

  const swapPlatformAddr = "0x1111111254EEB25477B68fb85Ed929f73A960582";
  await replaceContractAt(swapPlatformAddr, mock1InchSwapRouter);

  const stubbedRouterContract = await hre.ethers.getContractAt(
    "Mock1InchSwapRouter",
    swapPlatformAddr
  );
  fixture.mock1InchSwapRouter = stubbedRouterContract;

  return fixture;
}

/**
 * Configure the MockVault contract by initializing it and setting supported
 * assets and then upgrade the Vault implementation via VaultProxy.
 */
async function mockVaultFixture() {
  const fixture = await defaultFixture();

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Initialize and configure MockVault
  const cMockVault = await ethers.getContract("MockVault");

  // There is no need to initialize and setup the mock vault because the
  // proxy itself is already setup and the proxy is the one with the storage

  // Upgrade Vault to MockVault via proxy
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sGovernor).upgradeTo(cMockVault.address);

  fixture.mockVault = await ethers.getContractAt(
    "MockVault",
    cVaultProxy.address
  );

  return fixture;
}

async function bridgeHelperModuleFixture() {
  const fixture = await defaultFixture();

  const safeSigner = await impersonateAndFund(addresses.multichainStrategist);
  safeSigner.address = addresses.multichainStrategist;

  const bridgeHelperModule = await ethers.getContract(
    "EthereumBridgeHelperModule"
  );

  const cSafe = await ethers.getContractAt(
    [
      "function enableModule(address module) external",
      "function isModuleEnabled(address module) external view returns (bool)",
    ],
    addresses.multichainStrategist
  );
  if (isFork && !(await cSafe.isModuleEnabled(bridgeHelperModule.address))) {
    await cSafe.connect(safeSigner).enableModule(bridgeHelperModule.address);
  }

  return {
    ...fixture,
    bridgeHelperModule,
    safeSigner,
  };
}

async function claimRewardsModuleFixture() {
  const fixture = await defaultFixture();

  const safeSigner = await impersonateAndFund(addresses.multichainStrategist);
  safeSigner.address = addresses.multichainStrategist;

  const claimRewardsModule = await ethers.getContract(
    "ClaimStrategyRewardsSafeModule"
  );

  const cSafe = await ethers.getContractAt(
    [
      "function enableModule(address module) external",
      "function isModuleEnabled(address module) external view returns (bool)",
    ],
    addresses.multichainStrategist
  );
  if (isFork && !(await cSafe.isModuleEnabled(claimRewardsModule.address))) {
    await cSafe.connect(safeSigner).enableModule(claimRewardsModule.address);
  }

  return {
    ...fixture,
    claimRewardsModule,
    safeSigner,
  };
}

/**
 * Configure a Vault with only the Compound strategy.
 */
async function compoundVaultFixture() {
  const fixture = await defaultFixture();

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const assetAddresses = await getAssetAddresses(deployments);

  // Approve in Vault
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.compoundStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.compoundStrategy.address, true);

  // Add USDT
  await fixture.compoundStrategy
    .connect(sGovernor)
    .setPTokenAddress(assetAddresses.USDT, assetAddresses.cUSDT);
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.compoundStrategy.address
    );
  // Add USDC
  await fixture.compoundStrategy
    .connect(sGovernor)
    .setPTokenAddress(assetAddresses.USDC, assetAddresses.cUSDC);
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.compoundStrategy.address
    );
  // Add allocation mapping for USDS
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usds.address,
      fixture.compoundStrategy.address
    );

  return fixture;
}

/**
 * Configure a Vault with only the Convex strategy.
 */
async function convexVaultFixture() {
  const fixture = await defaultFixture();

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add Convex
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.convexStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.convexStrategy.address, true);

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.convexStrategy.address
    );
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.convexStrategy.address
    );
  return fixture;
}

/**
 * Configure a Vault with the balancerREthStrategy
 */
async function balancerREthFixture(config = { defaultStrategy: true }) {
  const fixture = await defaultFixture();
  await hotDeployOption(fixture, "balancerREthFixture", {
    isOethFixture: true,
  });

  const { oethVault, timelock, weth, reth, balancerREthStrategy, josh } =
    fixture;

  if (config.defaultStrategy) {
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(reth.address, balancerREthStrategy.address);
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(weth.address, balancerREthStrategy.address);
  }

  fixture.rEthBPT = await ethers.getContractAt(
    "IERC20Metadata",
    addresses.mainnet.rETH_WETH_BPT,
    josh
  );
  fixture.balancerREthPID = balancer_rETH_WETH_PID;

  fixture.auraPool = await ethers.getContractAt(
    "IERC4626",
    addresses.mainnet.rETH_WETH_AuraRewards
  );

  fixture.balancerVault = await ethers.getContractAt(
    "IBalancerVault",
    addresses.mainnet.balancerVault,
    josh
  );

  // completely peg the rETH price
  // await setChainlinkOraclePrice(addresses.mainnet.rETH, await reth.getExchangeRate());

  await setERC20TokenBalance(josh.address, reth, "1000000", hre);
  await hardhatSetBalance(josh.address, "1000000");

  return fixture;
}

/**
 * Configure a Vault with only the Meta strategy.
 */
async function convexMetaVaultFixture() {
  throw new Error("Fix fixtures");
  // const fixture = await defaultFixture();

  // if (isFork) {
  //   const { josh, matt, anna, domen, daniel, franck, ousd } = fixture;

  //   // const curveFactoryAddress = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'

  //   const threepoolLP = await ethers.getContractAt(
  //     threepoolLPAbi,
  //     addresses.mainnet.ThreePoolToken
  //   );
  //   const ousdMetaPool = await ethers.getContractAt(
  //     ousdMetapoolAbi,
  //     addresses.mainnet.CurveOUSDMetaPool
  //   );
  //   const threepoolSwap = await ethers.getContractAt(
  //     threepoolSwapAbi,
  //     addresses.mainnet.ThreePool
  //   );
  //   // const curveFactory = await ethers.getContractAt(curveFactoryAbi, curveFactoryAddress)

  //   const balances = await ousdMetaPool.get_balances();
  //   log(`Metapool balance 0: ${formatUnits(balances[0])}`);
  //   log(`Metapool balance 1: ${formatUnits(balances[1])}`);

  //   // Domen is loaded with 3CRV
  //   await hardhatSetBalance(domen.address, "1000000");
  //   await setERC20TokenBalance(domen.address, threepoolLP, "1000000", hre);

  //   for (const user of [josh, matt, anna, domen, daniel, franck]) {
  //     // Approve OUSD MetaPool contract to move funds
  //     await resetAllowance(threepoolLP, user, ousdMetaPool.address);
  //     await resetAllowance(ousd, user, ousdMetaPool.address);
  //   }

  //   fixture.ousdMetaPool = ousdMetaPool;
  //   fixture.threePoolToken = threepoolLP;
  //   fixture.threepoolSwap = threepoolSwap;
  // } else {
  //   // Migrations should do these on fork
  //   const { governorAddr } = await getNamedAccounts();
  //   const sGovernor = await ethers.provider.getSigner(governorAddr);

  //   // Add Convex Meta strategy
  //   await fixture.vault
  //     .connect(sGovernor)
  //     .approveStrategy(fixture.OUSDmetaStrategy.address);

  //   // set meta strategy on vault so meta strategy is allowed to mint OUSD
  //   await fixture.vault
  //     .connect(sGovernor)
  //     .setOusdMetaStrategy(fixture.OUSDmetaStrategy.address);

  //   // set OUSD mint threshold to 50 million
  //   await fixture.vault
  //     .connect(sGovernor)
  //     .setNetOusdMintForStrategyThreshold(parseUnits("50", 24));

  //   await fixture.harvester
  //     .connect(sGovernor)
  //     .setSupportedStrategy(fixture.OUSDmetaStrategy.address, true);

  //   await fixture.vault
  //     .connect(sGovernor)
  //     .setAssetDefaultStrategy(
  //       fixture.usdt.address,
  //       fixture.OUSDmetaStrategy.address
  //     );

  //   await fixture.vault
  //     .connect(sGovernor)
  //     .setAssetDefaultStrategy(
  //       fixture.usdc.address,
  //       fixture.OUSDmetaStrategy.address
  //     );
  // }

  // return fixture;
}

/**
 * Configure a Vault with default DAI strategy to the Maker DSR strategy.
 */

async function makerSSRFixture(
  config = {
    usdsMintAmount: 0,
    depositToStrategy: false,
  }
) {
  const fixture = await defaultFixture();

  if (isFork) {
    const { usds, josh, makerSSRStrategy, strategist, vault } = fixture;

    // Impersonate the OUSD Vault
    fixture.vaultSigner = await impersonateAndFund(vault.address);

    // mint some OUSD using USDS if configured
    if (config?.usdsMintAmount > 0) {
      const usdsMintAmount = parseUnits(config.usdsMintAmount.toString());
      await vault.connect(josh).rebase();
      await vault.connect(josh).allocate();

      // Approve the Vault to transfer USDS
      await usds.connect(josh).approve(vault.address, usdsMintAmount);

      // Mint OUSD with USDS
      // This will sit in the vault, not the strategy
      await vault.connect(josh).mint(usds.address, usdsMintAmount, 0);

      // Add DAI to the Maker DSR Strategy
      if (config?.depositToStrategy) {
        // The strategist deposits the WETH to the AMO strategy
        await vault
          .connect(strategist)
          .depositToStrategy(
            makerSSRStrategy.address,
            [usds.address],
            [usdsMintAmount]
          );
      }
    }
  } else {
    throw new Error(
      "Maker SSR strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with default USDC strategy to the Morpho Steakhouse USDC Vault.
 */
async function morphoSteakhouseUSDCFixture(
  config = {
    usdcMintAmount: 0,
    depositToStrategy: false,
  }
) {
  const fixture = await defaultFixture();

  if (isFork) {
    const { usdc, josh, morphoSteakhouseUSDCStrategy, strategist, vault } =
      fixture;

    // Impersonate the OUSD Vault
    fixture.vaultSigner = await impersonateAndFund(vault.address);

    // mint some OUSD using USDC if configured
    if (config?.usdcMintAmount > 0) {
      const usdcMintAmount = parseUnits(config.usdcMintAmount.toString(), 6);
      await vault.connect(josh).rebase();
      await vault.connect(josh).allocate();

      // Approve the Vault to transfer USDC
      await usdc.connect(josh).approve(vault.address, usdcMintAmount);

      // Mint OUSD with USDC
      // This will sit in the vault, not the strategy
      await vault.connect(josh).mint(usdc.address, usdcMintAmount, 0);

      // Add USDC to the strategy
      if (config?.depositToStrategy) {
        // The strategist deposits the USDC to the strategy
        await vault
          .connect(strategist)
          .depositToStrategy(
            morphoSteakhouseUSDCStrategy.address,
            [usdc.address],
            [usdcMintAmount]
          );
      }
    }
  } else {
    throw new Error(
      "Morpho Steakhouse USDC strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with default USDC strategy to the Morpho Gauntlet Prime USDC Vault.
 */
async function morphoGauntletPrimeUSDCFixture(
  config = {
    usdcMintAmount: 0,
    depositToStrategy: false,
  }
) {
  const fixture = await defaultFixture();

  if (isFork) {
    const { usdc, josh, morphoGauntletPrimeUSDCStrategy, strategist, vault } =
      fixture;

    // Impersonate the OUSD Vault
    fixture.vaultSigner = await impersonateAndFund(vault.address);

    // mint some OUSD using USDC if configured
    if (config?.usdcMintAmount > 0) {
      const usdcMintAmount = parseUnits(config.usdcMintAmount.toString(), 6);
      await vault.connect(josh).rebase();
      await vault.connect(josh).allocate();

      // Approve the Vault to transfer USDC
      await usdc.connect(josh).approve(vault.address, usdcMintAmount);

      // Mint OUSD with USDC
      // This will sit in the vault, not the strategy
      await vault.connect(josh).mint(usdc.address, usdcMintAmount, 0);

      // Add USDC to the strategy
      if (config?.depositToStrategy) {
        // The strategist deposits the USDC to the strategy
        await vault
          .connect(strategist)
          .depositToStrategy(
            morphoGauntletPrimeUSDCStrategy.address,
            [usdc.address],
            [usdcMintAmount]
          );
      }
    }
  } else {
    throw new Error(
      "Morpho Gauntlet Prime USDC strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with default USDT strategy to the Morpho Gauntlet Prime USDT Vault.
 */
async function morphoGauntletPrimeUSDTFixture(
  config = {
    usdtMintAmount: 0,
    depositToStrategy: false,
  }
) {
  const fixture = await defaultFixture();

  if (isFork) {
    const { usdt, josh, morphoGauntletPrimeUSDTStrategy, strategist, vault } =
      fixture;

    // Impersonate the OUSD Vault
    fixture.vaultSigner = await impersonateAndFund(vault.address);

    // mint some OUSD using USDT if configured
    if (config?.usdtMintAmount > 0) {
      const usdtMintAmount = parseUnits(config.usdtMintAmount.toString(), 6);
      await vault.connect(josh).rebase();
      await vault.connect(josh).allocate();

      // Approve the Vault to transfer USDT
      await usdt.connect(josh).approve(vault.address, 0);
      await usdt.connect(josh).approve(vault.address, usdtMintAmount);

      // Mint OUSD with USDT
      // This will sit in the vault, not the strategy
      await vault.connect(josh).mint(usdt.address, usdtMintAmount, 0);

      // Add USDT to the strategy
      if (config?.depositToStrategy) {
        // The strategist deposits the USDT to the strategy
        await vault
          .connect(strategist)
          .depositToStrategy(
            morphoGauntletPrimeUSDTStrategy.address,
            [usdt.address],
            [usdtMintAmount]
          );
      }
    }
  } else {
    throw new Error(
      "Morpho Gauntlet Prime USDT strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
async function morphoCompoundFixture() {
  const fixture = await defaultFixture();
  await hotDeployOption(fixture, "morphoCompoundFixture");

  const { timelock } = fixture;

  if (isFork) {
    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.morphoCompoundStrategy.address
      );

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.morphoCompoundStrategy.address
      );

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.dai.address,
        fixture.morphoCompoundStrategy.address
      );
  } else {
    throw new Error(
      "Morpho strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Aave strategy for USDT.
 */
async function aaveFixture() {
  const fixture = await defaultFixture();

  const { timelock } = fixture;

  if (isFork) {
    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.aaveStrategy.address
      );
  } else {
    throw new Error(
      "Aave strategy supported for USDT in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
async function morphoAaveFixture() {
  const fixture = await defaultFixture();

  const { timelock } = fixture;

  if (isFork) {
    // The supply of DAI and USDT has been paused for Morpho Aave V2 so no default strategy
    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(fixture.dai.address, addresses.zero);
    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(fixture.usdt.address, addresses.zero);

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.morphoAaveStrategy.address
      );
  } else {
    throw new Error(
      "Morpho strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
async function oethMorphoAaveFixture() {
  const fixture = await oethDefaultFixture();

  if (isFork) {
    const { oethVault, timelock, weth, oethMorphoAaveStrategy } = fixture;

    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(weth.address, oethMorphoAaveStrategy.address);
  } else {
    throw new Error(
      "Morpho strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * NativeStakingSSVStrategy fixture
 */
async function nativeStakingSSVStrategyFixture() {
  const fixture = await oethDefaultFixture();
  await hotDeployOption(fixture, "nativeStakingSSVStrategyFixture", {
    isOethFixture: true,
  });

  if (isFork) {
    const { nativeStakingSSVStrategy, ssv } = fixture;

    // The Defender Relayer
    fixture.validatorRegistrator = await impersonateAndFund(
      addresses.mainnet.validatorRegistrator
    );

    // Fund some SSV to the native staking strategy
    const ssvWhale = await impersonateAndFund(
      "0xf977814e90da44bfa03b6295a0616a897441acec" // Binance 8
    );
    await ssv
      .connect(ssvWhale)
      .transfer(nativeStakingSSVStrategy.address, oethUnits("100"));

    fixture.ssvNetwork = await ethers.getContractAt(
      "ISSVNetwork",
      addresses.mainnet.SSVNetwork
    );
  } else {
    fixture.ssvNetwork = await ethers.getContract("MockSSVNetwork");
    const { governorAddr } = await getNamedAccounts();
    const { oethVault, weth, nativeStakingSSVStrategy } = fixture;
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Approve Strategy
    await oethVault
      .connect(sGovernor)
      .approveStrategy(nativeStakingSSVStrategy.address);

    const fuseStartBn = ethers.utils.parseEther("21.6");
    const fuseEndBn = ethers.utils.parseEther("25.6");

    // Set as default
    await oethVault
      .connect(sGovernor)
      .setAssetDefaultStrategy(weth.address, nativeStakingSSVStrategy.address);

    await nativeStakingSSVStrategy
      .connect(sGovernor)
      .setFuseInterval(fuseStartBn, fuseEndBn);

    await nativeStakingSSVStrategy
      .connect(sGovernor)
      .setRegistrator(governorAddr);

    fixture.validatorRegistrator = sGovernor;
  }

  return fixture;
}

/**
 * CompoundingStakingSSVStrategy fixture
 */
async function compoundingStakingSSVStrategyFixture() {
  const fixture = await beaconChainFixture();
  await hotDeployOption(fixture, "compoundingStakingSSVStrategyFixture", {
    isOethFixture: true,
  });

  let compoundingStakingStrategyProxy;
  if (isTest && !isFork) {
    // For unit tests, the proxy is pinned to a fixed address
    compoundingStakingStrategyProxy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategyProxy",
      addresses.mainnet.CompoundingStakingStrategyProxy
    );
  } else {
    compoundingStakingStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
  }

  const compoundingStakingSSVStrategy = await ethers.getContractAt(
    "CompoundingStakingSSVStrategy",
    compoundingStakingStrategyProxy.address
  );
  fixture.compoundingStakingSSVStrategy = compoundingStakingSSVStrategy;

  if (isFork) {
    /*
    const { compoundingStakingSSVStrategy, ssv } = fixture;

    // The Defender Relayer
    fixture.validatorRegistrator = await impersonateAndFund(
      addresses.mainnet.validatorRegistrator
    );

    // Fund some SSV to the compounding staking strategy
    const ssvWhale = await impersonateAndFund(
      "0xf977814e90da44bfa03b6295a0616a897441acec" // Binance 8
    );
    await ssv
      .connect(ssvWhale)
      .transfer(compoundingStakingSSVStrategy.address, oethUnits("100"));

    fixture.ssvNetwork = await ethers.getContractAt(
      "ISSVNetwork",
      addresses.mainnet.SSVNetwork
    );
    */
  } else {
    fixture.ssvNetwork = await ethers.getContract("MockSSVNetwork");
    const { governorAddr } = await getNamedAccounts();
    const { oethVault, weth } = fixture;
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Approve Strategy
    await oethVault
      .connect(sGovernor)
      .approveStrategy(compoundingStakingSSVStrategy.address);

    // Set as default
    await oethVault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        weth.address,
        compoundingStakingSSVStrategy.address
      );

    await compoundingStakingSSVStrategy
      .connect(sGovernor)
      .setRegistrator(governorAddr);

    await compoundingStakingSSVStrategy
      .connect(sGovernor)
      .setHarvesterAddress(fixture.oethHarvester.address);

    fixture.validatorRegistrator = sGovernor;
  }

  return fixture;
}

/**
 * Generalized strategy fixture that works only in forked environment
 *
 * @param metapoolAddress -> the address of the metapool
 * @param rewardPoolAddress -> address of the reward staker contract
 * @param metastrategyProxyName -> name of the generalizedMetastrategy proxy contract
 */
async function convexGeneralizedMetaForkedFixture(
  config = {
    metapoolAddress: addresses.mainnet.CurveOUSDMetaPool,
    rewardPoolAddress: addresses.mainnet.CVXRewardsPool,
    metastrategyProxyName: addresses.mainnet.ConvexOUSDAMOStrategy,
    lpTokenAddress: addresses.mainnet.ThreePoolToken,
  }
) {
  const {
    metapoolAddress,
    rewardPoolAddress,
    metastrategyProxyName,
    lpTokenAddress,
  } = config;
  const fixture = await defaultFixture();

  const { timelockAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(timelockAddr);
  const { josh, matt, anna, domen, daniel, franck } = fixture;

  const threepoolLP = await ethers.getContractAt(
    threepoolLPAbi,
    addresses.mainnet.ThreePoolToken
  );
  const metapool = await ethers.getContractAt(ousdMetapoolAbi, metapoolAddress);

  const primaryCoin = await ethers.getContractAt(
    erc20Abi,
    await metapool.coins(0)
  );

  const threepoolSwap = await ethers.getContractAt(
    threepoolSwapAbi,
    addresses.mainnet.ThreePool
  );

  const lpToken = await ethers.getContractAt(erc20Abi, lpTokenAddress);

  for (const user of [josh, matt, anna, domen, daniel, franck]) {
    // Approve Metapool contract to move funds
    await resetAllowance(threepoolLP, user, metapoolAddress);
    await resetAllowance(primaryCoin, user, metapoolAddress);
  }

  await impersonateAndFund(domen.address, "1000000");
  await setERC20TokenBalance(domen.address, threepoolLP, "1000000", hre);

  fixture.metapoolCoin = primaryCoin;
  fixture.metapool = metapool;
  fixture.metapoolLpToken = lpToken;
  fixture.threePoolToken = threepoolLP;
  fixture.threepoolSwap = threepoolSwap;

  fixture.metaStrategyProxy = await ethers.getContract(metastrategyProxyName);
  fixture.metaStrategy = await ethers.getContractAt(
    "ConvexGeneralizedMetaStrategy",
    fixture.metaStrategyProxy.address
  );

  fixture.rewardPool = await ethers.getContractAt(
    "IRewardStaking",
    rewardPoolAddress
  );

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.metaStrategy.address
    );

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.metaStrategy.address
    );

  return fixture;
}

async function nodeSnapshot() {
  return await hre.network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
}

async function nodeRevert(snapshotId) {
  return await hre.network.provider.request({
    method: "evm_revert",
    params: [snapshotId],
  });
}

async function resetAllowance(
  tokenContract,
  signer,
  toAddress,
  allowance = "10000000000000000000000000000000000000000000000000"
) {
  await tokenContract.connect(signer).approve(toAddress, "0");
  await tokenContract.connect(signer).approve(toAddress, allowance);
}

/**
 * Configure a Vault with only the OETH/(W)ETH Curve Metastrategy.
 */
async function convexOETHMetaVaultFixture(
  config = {
    wethMintAmount: 0,
    depositToStrategy: false,
    poolAddEthAmount: 0,
    poolAddOethAmount: 0,
    balancePool: false,
  }
) {
  const fixture = await oethDefaultFixture();
  await hotDeployOption(fixture, "convexOETHMetaVaultFixture", {
    isOethFixture: true,
  });

  const {
    convexEthMetaStrategy,
    oeth,
    oethVault,
    josh,
    strategist,
    timelock,
    weth,
    crv,
  } = fixture;

  await impersonateAndFund(josh.address);
  await setERC20TokenBalance(josh.address, weth, "10000000", hre);
  await setERC20TokenBalance(josh.address, crv, "10000000", hre);

  // Update the strategy threshold to 500k ETH
  await oethVault
    .connect(timelock)
    .setNetOusdMintForStrategyThreshold(parseUnits("500", 21));

  await oethVault
    .connect(timelock)
    .setAssetDefaultStrategy(weth.address, addresses.zero);

  // Impersonate the OETH Vault
  fixture.oethVaultSigner = await impersonateAndFund(oethVault.address);
  // Impersonate the Curve gauge that holds all the LP tokens
  fixture.oethGaugeSigner = await impersonateAndFund(
    addresses.mainnet.CurveOETHGauge
  );

  // Convex pool that records the deposited balances
  fixture.cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    addresses.mainnet.CVXETHRewardsPool
  );

  fixture.oethMetaPool = await ethers.getContractAt(
    oethMetapoolAbi,
    addresses.mainnet.CurveOETHMetaPool
  );

  // mint some OETH using WETH is configured
  if (config?.wethMintAmount > 0) {
    const wethAmount = parseUnits(config.wethMintAmount.toString());
    await oethVault.connect(josh).rebase();
    await oethVault.connect(josh).allocate();

    // Calculate how much to mint based on the WETH in the vault,
    // the withdrawal queue, and the WETH to be sent to the strategy
    const wethBalance = await weth.balanceOf(oethVault.address);
    const queue = await oethVault.withdrawalQueueMetadata();
    const available = wethBalance.add(queue.claimed).sub(queue.queued);
    const mintAmount = wethAmount.sub(available);

    if (mintAmount.gt(0)) {
      // Approve the Vault to transfer WETH
      await weth.connect(josh).approve(oethVault.address, mintAmount);

      // Mint OETH with WETH
      // This will sit in the vault, not the strategy
      await oethVault.connect(josh).mint(weth.address, mintAmount, 0);
    }

    // Add ETH to the Metapool
    if (config?.depositToStrategy) {
      // The strategist deposits the WETH to the AMO strategy
      await oethVault
        .connect(strategist)
        .depositToStrategy(
          convexEthMetaStrategy.address,
          [weth.address],
          [wethAmount]
        );
    }
  }

  if (config?.balancePool) {
    const ethBalance = await fixture.oethMetaPool.balances(0);
    const oethBalance = await fixture.oethMetaPool.balances(1);

    const diff = parseInt(
      ethBalance.sub(oethBalance).div(oethUnits("1")).toString()
    );

    if (diff > 0) {
      config.poolAddOethAmount = (config.poolAddOethAmount || 0) + diff;
    } else if (diff < 0) {
      config.poolAddEthAmount = (config.poolAddEthAmount || 0) - diff;
    }
  }

  // Add ETH to the Metapool
  if (config?.poolAddEthAmount > 0) {
    // Fund Josh with ETH plus some extra for gas fees
    const fundAmount = config.poolAddEthAmount + 1;
    await hardhatSetBalance(josh.address, fundAmount.toString());

    const ethAmount = parseUnits(config.poolAddEthAmount.toString(), 18);
    // prettier-ignore
    await fixture.oethMetaPool
      .connect(josh)["add_liquidity(uint256[2],uint256)"]([ethAmount, 0], 0, {
        value: ethAmount,
      });
  }

  const { oethWhaleAddress } = addresses.mainnet;
  fixture.oethWhale = await impersonateAndFund(oethWhaleAddress);

  // Add OETH to the Metapool
  if (config?.poolAddOethAmount > 0) {
    const poolAddOethAmountUnits = parseUnits(
      config.poolAddOethAmount.toString()
    );

    const { oethWhale } = fixture;

    // Load with WETH
    await setERC20TokenBalance(
      oethWhaleAddress,
      weth,
      (config.poolAddOethAmount * 2).toString()
    );

    // Approve the Vault to transfer WETH
    await weth
      .connect(oethWhale)
      .approve(oethVault.address, poolAddOethAmountUnits);

    // Mint OETH with WETH
    await oethVault
      .connect(oethWhale)
      .mint(weth.address, poolAddOethAmountUnits, 0);

    const oethAmount = await oeth.balanceOf(oethWhaleAddress);
    log(`OETH whale balance     : ${formatUnits(oethAmount)}`);
    log(`OETH to add to Metapool: ${formatUnits(poolAddOethAmountUnits)}`);

    await oeth
      .connect(fixture.oethWhale)
      .approve(fixture.oethMetaPool.address, poolAddOethAmountUnits);

    // prettier-ignore
    await fixture.oethMetaPool
      .connect(fixture.oethWhale)["add_liquidity(uint256[2],uint256)"]([0, poolAddOethAmountUnits], 0);
  }

  return fixture;
}

/**
 * Configure a compound fixture with a false vault for testing
 */
async function compoundFixture() {
  throw new Error("Update fixture to remove usage of DAI");
  // const fixture = await defaultFixture();

  // const assetAddresses = await getAssetAddresses(deployments);
  // const { deploy } = deployments;
  // const { governorAddr } = await getNamedAccounts();
  // const sGovernor = await ethers.provider.getSigner(governorAddr);

  // await deploy("StandaloneCompound", {
  //   from: governorAddr,
  //   contract: "CompoundStrategy",
  //   args: [[addresses.dead, fixture.vault.address]],
  // });

  // fixture.cStandalone = await ethers.getContract("StandaloneCompound");

  // // Set governor as vault
  // await fixture.cStandalone
  //   .connect(sGovernor)
  //   .initialize(
  //     [assetAddresses.COMP],
  //     [assetAddresses.DAI, assetAddresses.USDC],
  //     [assetAddresses.cDAI, assetAddresses.cUSDC]
  //   );

  // await fixture.cStandalone
  //   .connect(sGovernor)
  //   .setHarvesterAddress(fixture.harvester.address);

  // // impersonate the vault and strategy
  // fixture.vaultSigner = await impersonateAndFund(fixture.vault.address);
  // fixture.strategySigner = await impersonateAndFund(
  //   fixture.cStandalone.address
  // );

  // await fixture.usdc.transfer(
  //   await fixture.matt.getAddress(),
  //   parseUnits("1000", 6)
  // );

  // return fixture;
}

/**
 * Configure a hacked Vault
 */
async function hackedVaultFixture() {
  const fixture = await defaultFixture();

  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { vault, oracleRouter } = fixture;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const oracleAddresses = await getOracleAddresses(hre.deployments);

  await deploy("MockEvilDAI", {
    from: governorAddr,
    args: [vault.address, assetAddresses.USDS],
  });

  const evilDAI = await ethers.getContract("MockEvilDAI");
  /* Mock oracle feeds report 0 for updatedAt data point. Set
   * maxStaleness to 100 years from epoch to make the Oracle
   * feeds valid
   */
  const maxStaleness = 24 * 60 * 60 * 365 * 100;

  await oracleRouter.setFeed(
    evilDAI.address,
    oracleAddresses.chainlink.DAI_USD,
    maxStaleness
  );
  await oracleRouter.cacheDecimals(evilDAI.address);

  await fixture.vault.connect(sGovernor).supportAsset(evilDAI.address, 0);

  fixture.evilDAI = evilDAI;

  return fixture;
}

/**
 * Instant rebase vault, for testing systems external to the vault
 */
async function instantRebaseVaultFixture() {
  const fixture = await defaultFixture();

  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("MockVaultCoreInstantRebase", {
    from: governorAddr,
  });
  const instantRebase = await ethers.getContract("MockVaultCoreInstantRebase");

  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sGovernor).upgradeTo(instantRebase.address);

  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  await cOETHVaultProxy.connect(sGovernor).upgradeTo(instantRebase.address);

  return fixture;
}

/**
 * Configure a reborn hack attack
 */
async function rebornFixture() {
  const fixture = await defaultFixture();

  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const { vault } = fixture;

  await deploy("Sanctum", {
    from: governorAddr,
    args: [assetAddresses.USDS, vault.address],
  });

  const sanctum = await ethers.getContract("Sanctum");

  const encodedCallbackAddress = defaultAbiCoder
    .encode(["address"], [sanctum.address])
    .slice(2);
  const initCode = (await ethers.getContractFactory("Reborner")).bytecode;
  const deployCode = `${initCode}${encodedCallbackAddress}`;

  const rebornAddress = await sanctum.computeAddress(12345, deployCode);
  const reborner = await ethers.getContractAt("Reborner", rebornAddress);

  // deploy the reborn contract and call a method
  const deployAndCall = async ({
    shouldAttack = true,
    targetMethod = null,
    shouldDestruct = false,
  }) => {
    await sanctum.setShouldAttack(shouldAttack);
    await sanctum.setShouldDesctruct(shouldDestruct);
    if (targetMethod) await sanctum.setTargetMethod(targetMethod);
    await sanctum.setOUSDAddress(fixture.ousd.address);
    await sanctum.deploy(12345, deployCode);
  };

  fixture.rebornAddress = rebornAddress;
  fixture.reborner = reborner;
  fixture.deployAndCall = deployAndCall;

  return fixture;
}

async function buybackFixture() {
  const fixture = await defaultFixture();

  const { ousd, oeth, oethVault, vault, weth, usds, josh, governor, timelock } =
    fixture;

  const ousdBuybackProxy = await ethers.getContract("BuybackProxy");
  const ousdBuyback = await ethers.getContractAt(
    "OUSDBuyback",
    ousdBuybackProxy.address
  );

  const oethBuybackProxy = await ethers.getContract("OETHBuybackProxy");
  const oethBuyback = await ethers.getContractAt(
    "OETHBuyback",
    oethBuybackProxy.address
  );

  let armBuyback;
  if (isFork) {
    const armBuybackProxy = await ethers.getContract("ARMBuybackProxy");
    armBuyback = await ethers.getContractAt(
      "ARMBuyback",
      armBuybackProxy.address
    );
    fixture.armBuyback = armBuyback;
  }

  fixture.ousdBuyback = ousdBuyback;
  fixture.oethBuyback = oethBuyback;

  const rewardsSourceAddress = await ousdBuyback.connect(josh).rewardsSource();
  fixture.rewardsSource = await ethers.getContractAt([], rewardsSourceAddress);

  if (isFork) {
    fixture.cvxLocker = await ethers.getContractAt(
      "ICVXLocker",
      addresses.mainnet.CVXLocker
    );
    fixture.uniswapRouter = await ethers.getContractAt(
      "IUniswapUniversalRouter",
      addresses.mainnet.uniswapUniversalRouter
    );

    // Load with funds to test swaps
    await setERC20TokenBalance(josh.address, weth, "10000");
    await setERC20TokenBalance(josh.address, usds, "10000");
    await weth.connect(josh).approve(oethVault.address, oethUnits("10000"));
    await usds.connect(josh).approve(vault.address, ousdUnits("10000"));

    // Mint & transfer oToken
    await oethVault.connect(josh).mint(weth.address, oethUnits("1.23"), "0");
    await oeth.connect(josh).transfer(oethBuyback.address, oethUnits("1.1"));

    await vault.connect(josh).mint(usds.address, oethUnits("1231"), "0");
    await ousd.connect(josh).transfer(ousdBuyback.address, oethUnits("1100"));
    await setERC20TokenBalance(armBuyback.address, weth, "100");

    // Compute splits
    await oethBuyback.connect(timelock).updateBuybackSplits();
    await ousdBuyback.connect(timelock).updateBuybackSplits();
    await armBuyback.connect(timelock).updateBuybackSplits();
  } else {
    fixture.mockSwapper = await ethers.getContract("MockSwapper");
    fixture.cvxLocker = await ethers.getContract("MockCVXLocker");

    // Mint some OUSD
    await usds.connect(josh).mint(ousdUnits("3000"));
    await usds.connect(josh).approve(vault.address, ousdUnits("3000"));
    await vault.connect(josh).mint(usds.address, ousdUnits("3000"), "0");

    // Mint some OETH
    await weth.connect(josh).mint(oethUnits("3"));
    await weth.connect(josh).approve(oethVault.address, oethUnits("3"));
    await oethVault.connect(josh).mint(weth.address, oethUnits("3"), "0");

    // Transfer those to the buyback contract
    await oeth.connect(josh).transfer(oethBuyback.address, oethUnits("3"));
    await ousd.connect(josh).transfer(ousdBuyback.address, ousdUnits("3000"));
    //await weth.connect(josh).transfer(armBuyback.address, oethUnits("3"));

    // Compute splits
    await oethBuyback.connect(governor).updateBuybackSplits();
    await ousdBuyback.connect(governor).updateBuybackSplits();
    //await armBuyback.connect(governor).updateBuybackSplits();
  }

  return fixture;
}

async function harvesterFixture() {
  let fixture;

  if (isFork) {
    fixture = await defaultFixture();
  } else {
    fixture = await compoundVaultFixture();

    const {
      vault,
      governor,
      harvester,
      usdc,
      aaveStrategy,
      comp,
      aaveToken,
      strategist,
      compoundStrategy,
    } = fixture;

    // Add Aave which only supports USDC
    await vault.connect(governor).approveStrategy(aaveStrategy.address);

    await harvester
      .connect(governor)
      .setSupportedStrategy(aaveStrategy.address, true);

    // Add direct allocation of USDC to Aave
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, aaveStrategy.address);

    // Let strategies hold some reward tokens
    await comp
      .connect(strategist)
      .mintTo(compoundStrategy.address, ousdUnits("120"));
    await aaveToken
      .connect(strategist)
      .mintTo(aaveStrategy.address, ousdUnits("150"));

    fixture.uniswapRouter = await ethers.getContract("MockUniswapRouter");
    fixture.balancerVault = await ethers.getContract("MockBalancerVault");
  }

  return fixture;
}

async function woethCcipZapperFixture() {
  const fixture = await defaultFixture();

  fixture.oethZapper = await resolveContract("OETHZapper");
  fixture.woethOnSourceChain = await resolveContract("WOETHProxy", "WOETH");
  fixture.woethZapper = await resolveContract("WOETHCCIPZapper");

  return fixture;
}

async function beaconChainFixture() {
  const fixture = await defaultFixture();

  fixture.beaconRoots = await ethers.getContractAt(
    "MockBeaconRoots",
    addresses.mainnet.beaconRoots
  );
  fixture.beaconOracle = await ethers.getContract("BeaconOracle");

  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();

  const { beaconConsolidationReplaced, beaconWithdrawalReplaced } =
    await enableExecutionLayerGeneralPurposeRequests();

  await deploy("MockBeaconConsolidation", {
    from: governorAddr,
  });

  await deploy("MockPartialWithdrawal", {
    from: governorAddr,
  });

  fixture.beaconConsolidationReplaced = beaconConsolidationReplaced;
  fixture.beaconWithdrawalReplaced = beaconWithdrawalReplaced;

  fixture.beaconConsolidation = await resolveContract(
    "MockBeaconConsolidation"
  );
  fixture.partialWithdrawal = await resolveContract("MockPartialWithdrawal");

  // fund the beacon communication contracts so they can pay the fee
  await hardhatSetBalance(fixture.beaconConsolidation.address, "100");
  await hardhatSetBalance(fixture.partialWithdrawal.address, "100");

  if (isFork) {
    fixture.beaconProofs = await resolveContract("BeaconProofs");
  } else {
    fixture.beaconProofs = await resolveContract("MockBeaconProofs");
  }

  return fixture;
}

/**
 * Harhdat doesn't have a support for execution layer general purpose requests to the
 * consensus layer. E.g. consolidation request and (partial) withdrawal request.
 */
async function enableExecutionLayerGeneralPurposeRequests() {
  const executionLayerConsolidation = await deployWithConfirmation(
    "ExecutionLayerConsolidation"
  );
  const executionLayerWithdrawal = await deployWithConfirmation(
    "ExecutionLayerWithdrawal"
  );

  await replaceContractAt(
    addresses.mainnet.toConsensus.consolidation,
    executionLayerConsolidation
  );

  await replaceContractAt(
    addresses.mainnet.toConsensus.withdrawals,
    executionLayerWithdrawal
  );

  const withdrawalAbi = `[
    {
      "inputs": [],
      "name": "lastAmount",
      "outputs": [
        {
          "internalType": "uint64",
          "name": "",
          "type": "uint64"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "lastPublicKey",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]`;

  const consolidationAbi = `[
    {
      "inputs": [],
      "name": "lastSource",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "lastTarget",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]`;

  const beaconConsolidationReplaced = await ethers.getContractAt(
    JSON.parse(consolidationAbi),
    addresses.mainnet.toConsensus.consolidation
  );

  const beaconWithdrawalReplaced = await ethers.getContractAt(
    JSON.parse(withdrawalAbi),
    addresses.mainnet.toConsensus.withdrawals
  );

  return {
    beaconConsolidationReplaced,
    beaconWithdrawalReplaced,
  };
}

/**
 * A fixture is a setup function that is run only the first time it's invoked. On subsequent invocations,
 * Hardhat will reset the state of the network to what it was at the point after the fixture was initially executed.
 * The returned `loadFixture` function is typically included in the beforeEach().
 * @example
 *   const loadFixture = createFixtureLoader(convexOETHMetaVaultFixture);
 *   beforeEach(async () => {
 *     fixture = await loadFixture();
 *   });
 * @example
 *   const loadFixture = createFixtureLoader(convexOETHMetaVaultFixture, {
 *     wethMintAmount: 5000,
 *     depositToStrategy: false,
 *   });
 *   beforeEach(async () => {
 *     fixture = await loadFixture();
 *   });
 * @param {*} fixture async function that sets up test data. eg users, contracts and protocols
 * @param {*} config optional config object passed to the fixture function
 * @returns loadFixture an async function that loads a fixture
 */
function createFixtureLoader(fixture, config) {
  return deployments.createFixture(async () => {
    return await fixture(config);
  });
}

/**
 * An async function that loads the default fixture for unit or fork tests
 * @example
 *   let fixture;
 *   beforeEach(async () => {
 *     fixture = await loadDefaultFixture();
 *   });
 */
async function loadDefaultFixture() {
  return await defaultFixture();
}

async function loadSimpleOETHFixture() {
  return await simpleOETHFixture();
}

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  createFixtureLoader,
  simpleOETHFixture,
  loadDefaultFixture,
  loadSimpleOETHFixture,
  resetAllowance,
  defaultFixture,
  oethDefaultFixture,
  loadTokenTransferFixture,
  mockVaultFixture,
  compoundFixture,
  compoundVaultFixture,
  convexVaultFixture,
  convexMetaVaultFixture,
  convexOETHMetaVaultFixture,
  convexGeneralizedMetaForkedFixture,
  makerSSRFixture,
  morphoSteakhouseUSDCFixture,
  morphoGauntletPrimeUSDCFixture,
  morphoGauntletPrimeUSDTFixture,
  morphoCompoundFixture,
  aaveFixture,
  morphoAaveFixture,
  hackedVaultFixture,
  instantRebaseVaultFixture,
  rebornFixture,
  balancerREthFixture,
  nativeStakingSSVStrategyFixture,
  compoundingStakingSSVStrategyFixture,
  oethMorphoAaveFixture,
  oeth1InchSwapperFixture,
  oethCollateralSwapFixture,
  ousdCollateralSwapFixture,
  buybackFixture,
  harvesterFixture,
  nodeSnapshot,
  nodeRevert,
  woethCcipZapperFixture,
  bridgeHelperModuleFixture,
  beaconChainFixture,
  claimRewardsModuleFixture,
};
