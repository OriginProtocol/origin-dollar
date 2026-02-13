const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");

require("./_global-hooks");

const { hotDeployOption } = require("./_hot-deploy.js");
const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
//const { setChainlinkOraclePrice } = require("../utils/oracle");

const {
  fundAccounts,
  fundAccountsForOETHUnitTests,
} = require("../utils/funding");
const { deployWithConfirmation } = require("../utils/deploy");

const { replaceContractAt } = require("../utils/hardhat");
const {
  getAssetAddresses,
  getOracleAddresses,
  oethUnits,
  ousdUnits,
  usdcUnits,
  units,
  isTest,
  isFork,
  isHolesky,
  isHoleskyFork,
} = require("./helpers");
const { hardhatSetBalance, setERC20TokenBalance } = require("./_fund");
const { getCreate2ProxyAddress } = require("../deploy/deployActions");

const usdsAbi = require("./abi/usds.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const erc20Abi = require("./abi/erc20.json");
const metamorphoAbi = require("./abi/metamorpho.json");
const merklDistributorAbi = require("./abi/merklDistributor.json");

const curveXChainLiquidityGaugeAbi = require("./abi/curveXChainLiquidityGauge.json");
const curveStableSwapNGAbi = require("./abi/curveStableSwapNG.json");
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

  const oethOracleRouter = await ethers.getContract(
    isFork ? "OETHOracleRouter" : "OracleRouter"
  );

  let weth,
    ssv,
    nativeStakingSSVStrategy,
    oethFixedRateDripper,
    simpleOETHHarvester;

  if (isFork) {
    let addressContext = addresses.mainnet;
    if (isHolesky || isHoleskyFork) {
      addressContext = addresses.holesky;
    }

    weth = await ethers.getContractAt("IWETH9", addressContext.WETH);
    ssv = await ethers.getContractAt(erc20Abi, addressContext.SSV);

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

    const simpleOETHHarvesterProxy = await ethers.getContract(
      "OETHSimpleHarvesterProxy"
    );
    simpleOETHHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      simpleOETHHarvesterProxy.address
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
    oethFixedRateDripper,
    simpleOETHHarvester,
    oethHarvester: simpleOETHHarvester,
  };
});

const getVaultAndTokenContracts = async () => {
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
    const usdc = await ethers.getContract("MockUSDC");
    await usdc.connect(matt).approve(vault.address, usdcUnits("1000"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("1000"), 0);
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

  // Allow matt to burn OUSD
  await vault.connect(governor).setStrategistAddr(matt.address);
  // matt burn remaining OUSD
  await vault.connect(matt).requestWithdrawal(ousd.balanceOf(matt.address));

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

  const vaultAndTokenContracts = await getVaultAndTokenContracts();

  const signers = await hre.ethers.getSigners();
  let governor = signers[1];
  let strategist = signers[0];

  log("Creating account types...");
  const accountTypes = await createAccountTypes({
    ousd: vaultAndTokenContracts.ousd,
    ousdUnlocked: vaultAndTokenContracts.ousdUnlocked,
    vault: vaultAndTokenContracts.vault,
    deploy: deployments.deploy,
  });
  log("Account types created.");

  return {
    ...vaultAndTokenContracts,
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

  const vaultAndTokenConracts = await getVaultAndTokenContracts();

  const dripperProxy = isFork
    ? await ethers.getContract("DripperProxy")
    : undefined;
  const dripper = isFork
    ? await ethers.getContractAt("Dripper", dripperProxy.address)
    : undefined;
  const wousdProxy = await ethers.getContract("WrappedOUSDProxy");
  const wousd = await ethers.getContractAt("WrappedOusd", wousdProxy.address);

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

  const morphoOUSDv2StrategyProxy = !isFork
    ? undefined
    : await ethers.getContract("OUSDMorphoV2StrategyProxy");
  const morphoOUSDv2Strategy = !isFork
    ? undefined
    : await ethers.getContractAt(
        "Generalized4626Strategy",
        morphoOUSDv2StrategyProxy.address
      );

  const curvePoolBooster = isFork
    ? await ethers.getContractAt(
        "CurvePoolBooster",
        "0xF4c001dfe53C584425d7943395C7E57b10BD1DC8" // hardcoded as generated with CreateX.
      )
    : undefined;

  const simpleHarvesterProxy = await ethers.getContract(
    "OETHSimpleHarvesterProxy"
  );
  const simpleOETHHarvester = await ethers.getContractAt(
    "OETHHarvesterSimple",
    simpleHarvesterProxy.address
  );

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

  const mockStrategy = isFork
    ? undefined
    : await ethers.getContract("MockStrategy");

  let usdt,
    usds,
    usdc,
    weth,
    ogn,
    nonStandardToken,
    morphoSteakHouseUSDCVault,
    morphoGauntletPrimeUSDCVault,
    morphoGauntletPrimeUSDTVault,
    morphoOUSDv2Vault,
    ssv;

  let chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedUSDS,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    depositContractUtils,
    oethZapper,
    vaultValueChecker,
    oethVaultValueChecker,
    poolBoosterCentralRegistry,
    poolBoosterMerklFactory,
    merklDistributor;

  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    usds = await ethers.getContractAt(usdsAbi, addresses.mainnet.USDS);
    usdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.USDC);
    weth = await ethers.getContractAt("IWETH9", addresses.mainnet.WETH);
    ogn = await ethers.getContractAt(erc20Abi, addresses.mainnet.OGN);
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
    morphoOUSDv2Vault = await ethers.getContractAt(
      metamorphoAbi,
      addresses.mainnet.MorphoOUSDv2Vault
    );
    ssv = await ethers.getContractAt(erc20Abi, addresses.mainnet.SSV);

    oethZapper = await ethers.getContract("OETHZapper");

    vaultValueChecker = await ethers.getContract("VaultValueChecker");
    oethVaultValueChecker = await ethers.getContract("OETHVaultValueChecker");

    poolBoosterCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      (
        await ethers.getContract("PoolBoostCentralRegistryProxy")
      ).address
    );
    poolBoosterMerklFactory = await ethers.getContract(
      "PoolBoosterFactoryMerkl"
    );

    merklDistributor = await ethers.getContractAt(
      merklDistributorAbi,
      addresses.mainnet.CampaignCreator
    );
  } else {
    usdt = await ethers.getContract("MockUSDT");
    usds = await ethers.getContract("MockUSDS");
    usdc = await ethers.getContract("MockUSDC");
    weth = await ethers.getContractAt("MockWETH", addresses.mainnet.WETH);
    ogn = await ethers.getContract("MockOGN");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
    ssv = await ethers.getContract("MockSSV");
    depositContractUtils = await ethers.getContract("DepositContractUtils");

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
  }

  if (!isFork) {
    const sGovernor = await ethers.provider.getSigner(governorAddr);

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
      await usdc
        .connect(user)
        .approve(vaultAndTokenConracts.vault.address, usdcUnits("100"));
      await vaultAndTokenConracts.vault
        .connect(user)
        .mint(usdc.address, usdcUnits("100"), 0);

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
    dripper,
    // Oracle
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedUSDS,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    oracleRouter,
    oethOracleRouter,
    // Assets
    usdt,
    usds,
    usdc,
    ogn,
    ssv,
    weth,
    nonStandardToken,
    depositContractUtils,
    wousd,
    morphoSteakhouseUSDCStrategy,
    morphoSteakHouseUSDCVault,
    morphoGauntletPrimeUSDCStrategy,
    morphoGauntletPrimeUSDCVault,
    morphoGauntletPrimeUSDTStrategy,
    morphoGauntletPrimeUSDTVault,
    morphoOUSDv2Strategy,
    morphoOUSDv2Vault,
    curvePoolBooster,
    simpleOETHHarvester,
    oethHarvester: simpleOETHHarvester,
    oethFixedRateDripper,
    OUSDCurveAMO,
    curvePoolOusdUsdc,
    curveGaugeOusdUsdc,
    OETHCurveAMO,
    curvePoolOETHWETH,
    curveGaugeOETHWETH,

    // OETH
    oethVaultValueChecker,
    nativeStakingSSVStrategy,
    nativeStakingFeeAccumulator,
    oethFixedRateDripperProxy,
    oethZapper,

    poolBoosterCentralRegistry,
    poolBoosterMerklFactory,
    merklDistributor,

    mockStrategy,
  };
});

// Default fixture that has pool booster code updated and replaced to the latest version
async function poolBoosterCodeUpdatedFixture() {
  const fixture = await defaultFixture();
  const poolBoosterAddress = "0xF4c001dfe53C584425d7943395C7E57b10BD1DC8";

  const curvePoolBoosterProxy = await ethers.getContractAt(
    "CurvePoolBoosterProxy",
    poolBoosterAddress
  );
  const curvePoolBoosterFactory = await ethers.getContract(
    "CurvePoolBoosterFactory"
  );

  const implementationAddress = await curvePoolBoosterProxy.implementation();

  const rewardToken = addresses.mainnet.OUSDProxy;
  const gauge = addresses.mainnet.CurveOUSDUSDTGauge;

  const UpdatedPoolBooster = await deployWithConfirmation("CurvePoolBooster", [
    rewardToken,
    gauge,
  ]);

  await replaceContractAt(implementationAddress, UpdatedPoolBooster);
  fixture.curvePoolBoosterFactory = curvePoolBoosterFactory;

  return fixture;
}

async function oethDefaultFixture() {
  const fixture = await defaultFixture();

  const { weth } = fixture;
  const { matt, josh, domen, daniel, franck, oethVault } = fixture;

  if (isFork) {
    for (const user of [matt, josh, domen, daniel, franck]) {
      await setERC20TokenBalance(user.address, weth, "1000000", hre);
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

  return fixture;
}

async function oethCollateralSwapFixture() {
  const fixture = await oethDefaultFixture();
  return fixture;
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
 * Configure a Vault with default USDC strategy to Yearn's Morpho OUSD v2 Vault.
 */
async function morphoOUSDv2Fixture(
  config = {
    usdcMintAmount: 0,
    depositToStrategy: false,
  }
) {
  const fixture = await defaultFixture();

  if (isFork) {
    const { usdc, josh, morphoOUSDv2Strategy, strategist, vault } = fixture;

    // TODO remove once Yearn has done this on mainnet
    // // Whitelist the strategy
    // const gateOwner = await impersonateAndFund(
    //   "0x50B75d586929Ab2F75dC15f07E1B921b7C4Ba8fA"
    // );
    // const gate = await ethers.getContractAt(
    //   ["function setIsWhitelisted(address,bool) external"],
    //   "0x6704aB7aF6787930c60DFa422104E899E823e657"
    // );
    // await gate
    //   .connect(gateOwner)
    //   .setIsWhitelisted(morphoOUSDv2Strategy.address, true);

    // Impersonate the OUSD Vault
    fixture.vaultSigner = await impersonateAndFund(vault.address);

    const morphoToken = await ethers.getContractAt(
      "MintableERC20",
      addresses.mainnet.MorphoToken
    );
    fixture.morphoToken = morphoToken;

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
            morphoOUSDv2Strategy.address,
            [usdc.address],
            [usdcMintAmount]
          );
      }
    }
  } else {
    throw new Error(
      "Yearn's Morpho OUSD v2 strategy only supported in forked test environment"
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
    const { oethVault, nativeStakingSSVStrategy } = fixture;
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
      .setDefaultStrategy(nativeStakingSSVStrategy.address);

    await nativeStakingSSVStrategy
      .connect(sGovernor)
      .setFuseInterval(fuseStartBn, fuseEndBn);

    await nativeStakingSSVStrategy
      .connect(sGovernor)
      .setRegistrator(governorAddr);

    // Set harvester address on the strategy
    await nativeStakingSSVStrategy
      .connect(sGovernor)
      .setHarvesterAddress(fixture.simpleOETHHarvester.address);

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
      addresses.unitTests.CompoundingStakingStrategyProxy
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

  fixture.compoundingStakingStrategyView = await ethers.getContract(
    "CompoundingStakingStrategyView"
  );

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
    const { governorAddr, registratorAddr } = await getNamedAccounts();
    const { oethVault } = fixture;
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const sRegistrator = await ethers.provider.getSigner(registratorAddr);

    // Approve Strategy
    await oethVault
      .connect(sGovernor)
      .approveStrategy(compoundingStakingSSVStrategy.address);

    // Set as default
    await oethVault
      .connect(sGovernor)
      .setDefaultStrategy(compoundingStakingSSVStrategy.address);

    await compoundingStakingSSVStrategy
      .connect(sGovernor)
      .setRegistrator(registratorAddr);

    await compoundingStakingSSVStrategy
      .connect(sGovernor)
      .setHarvesterAddress(fixture.simpleOETHHarvester.address);

    fixture.validatorRegistrator = sRegistrator;
  }

  return fixture;
}

async function compoundingStakingSSVStrategyMerkleProofsMockedFixture() {
  const fixture = await compoundingStakingSSVStrategyFixture();

  const beaconProofsAddress =
    await fixture.compoundingStakingSSVStrategy.BEACON_PROOFS();

  const mockBeaconProof = await ethers.getContract("MockBeaconProofs");

  // replace beacon proofs library with the mocked one
  await replaceContractAt(beaconProofsAddress, mockBeaconProof);

  fixture.mockBeaconProof = await ethers.getContractAt(
    "MockBeaconProofs",
    beaconProofsAddress
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
async function instantRebaseVaultFixture(tokenName) {
  const fixture = await defaultFixture();

  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Default to "usdc" if tokenName not provided
  const name = tokenName ? tokenName.toLowerCase() : "usdc";
  let deployTokenAddress;
  if (name === "usdc") {
    deployTokenAddress = fixture.usdc.address;
  } else if (name === "weth") {
    deployTokenAddress = fixture.weth.address;
  } else {
    throw new Error(`Unsupported token name: ${name}`);
  }

  await deploy("MockVaultCoreInstantRebase", {
    from: governorAddr,
    args: [deployTokenAddress],
  });
  const instantRebase = await ethers.getContract("MockVaultCoreInstantRebase");

  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sGovernor).upgradeTo(instantRebase.address);

  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  await cOETHVaultProxy.connect(sGovernor).upgradeTo(instantRebase.address);

  return fixture;
}

// Unit test cross chain fixture where both contracts are deployed on the same chain for the
// purposes of unit testing
async function crossChainFixtureUnit() {
  const fixture = await defaultFixture();
  const { governor, vault } = fixture;

  const crossChainMasterStrategyProxy = await ethers.getContract(
    "CrossChainMasterStrategyProxy"
  );
  const crossChainRemoteStrategyProxy = await ethers.getContract(
    "CrossChainRemoteStrategyProxy"
  );

  const cCrossChainMasterStrategy = await ethers.getContractAt(
    "CrossChainMasterStrategy",
    crossChainMasterStrategyProxy.address
  );

  const cCrossChainRemoteStrategy = await ethers.getContractAt(
    "CrossChainRemoteStrategy",
    crossChainRemoteStrategyProxy.address
  );

  await vault
    .connect(governor)
    .approveStrategy(cCrossChainMasterStrategy.address);

  const messageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock"
  );
  const tokenMessenger = await ethers.getContract("CCTPTokenMessengerMock");

  // In unit test environment it is not the off-chain defender action that calls the "relay"
  // to relay the messages but rather the message transmitter.
  await cCrossChainMasterStrategy
    .connect(governor)
    .setOperator(messageTransmitter.address);
  await cCrossChainRemoteStrategy
    .connect(governor)
    .setOperator(messageTransmitter.address);

  const morphoVault = await ethers.getContract("MockERC4626Vault");

  // Impersonate the OUSD Vault
  fixture.vaultSigner = await impersonateAndFund(vault.address);

  // Fund extra USDC for cross-chain tests that require large mints
  if (!isFork) {
    const usdc = await ethers.getContract("MockUSDC");
    for (const user of [fixture.josh, fixture.matt]) {
      await usdc.connect(user).mint(usdcUnits("100000"));
    }
  }

  return {
    ...fixture,
    crossChainMasterStrategy: cCrossChainMasterStrategy,
    crossChainRemoteStrategy: cCrossChainRemoteStrategy,
    messageTransmitter: messageTransmitter,
    tokenMessenger: tokenMessenger,
    morphoVault: morphoVault,
  };
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
    args: [assetAddresses.USDC, vault.address],
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
    fixture.beaconProofs = await resolveContract("EnhancedBeaconProofs");
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

async function crossChainFixture() {
  const fixture = await defaultFixture();

  const crossChainStrategyProxyAddress = await getCreate2ProxyAddress(
    "CrossChainStrategyProxy"
  );
  const cCrossChainMasterStrategy = await ethers.getContractAt(
    "CrossChainMasterStrategy",
    crossChainStrategyProxyAddress
  );

  await deployWithConfirmation("CCTPMessageTransmitterMock2", [
    fixture.usdc.address,
  ]);
  const mockMessageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock2"
  );
  await deployWithConfirmation("CCTPTokenMessengerMock", [
    fixture.usdc.address,
    mockMessageTransmitter.address,
  ]);
  const mockTokenMessenger = await ethers.getContract("CCTPTokenMessengerMock");
  await mockMessageTransmitter.setCCTPTokenMessenger(
    addresses.CCTPTokenMessengerV2
  );

  await setERC20TokenBalance(
    fixture.matt.address,
    fixture.usdc,
    usdcUnits("1000000")
  );

  return {
    ...fixture,
    crossChainMasterStrategy: cCrossChainMasterStrategy,
    mockMessageTransmitter: mockMessageTransmitter,
    mockTokenMessenger: mockTokenMessenger,
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
  poolBoosterCodeUpdatedFixture,
  loadTokenTransferFixture,
  mockVaultFixture,
  morphoOUSDv2Fixture,
  hackedVaultFixture,
  instantRebaseVaultFixture,
  rebornFixture,
  nativeStakingSSVStrategyFixture,
  compoundingStakingSSVStrategyFixture,
  compoundingStakingSSVStrategyMerkleProofsMockedFixture,
  oethCollateralSwapFixture,
  ousdCollateralSwapFixture,
  nodeSnapshot,
  nodeRevert,
  woethCcipZapperFixture,
  bridgeHelperModuleFixture,
  beaconChainFixture,
  claimRewardsModuleFixture,
  crossChainFixtureUnit,
  crossChainFixture,
};
