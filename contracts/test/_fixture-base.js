const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isBaseFork, oethUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");

const log = require("../utils/logger")("test:fixtures-arb");

const aeroVoterAbi = require("./abi/aerodromeVoter.json");
const aeroSwapRouterAbi = require("./abi/aerodromeSwapRouter.json");
const slipstreamPoolAbi = require("./abi/aerodromeSlipstreamPool.json")

const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const BURNER_ROLE =
  "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848";

let snapshotId;
const defaultBaseFixture = deployments.createFixture(async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isBaseFork && isFork) {
    // Only works for Base fork
    return;
  }

  if (isFork) {
    // Fund deployer account
    const { deployerAddr } = await getNamedAccounts();
    await impersonateAndFund(deployerAddr);
  }

  log(
    `Before deployments with param "${isFork ? ["base"] : ["base_unit_tests"]}"`
  );

  // Run the contract deployments
  await deployments.fixture(isFork ? ["base"] : ["base_unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  // OETHb
  const oethbProxy = await ethers.getContract("OETHBaseProxy");
  const oethb = await ethers.getContractAt("OETH", oethbProxy.address);

  // wOETHb (4626)
  const wOETHbProxy = await ethers.getContract("WOETHBaseProxy");
  const wOETHb = await ethers.getContractAt("WOETHBase", wOETHbProxy.address);

  // OETHb Vault
  const oethbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
  const oethbVault = await ethers.getContractAt(
    "IVault",
    oethbVaultProxy.address
  );

  // Aerodrome AMO Strategy
  const aerodromeAmoStrategyProxy = await ethers.getContract("AerodromeAMOStrategyProxy");
  const aerodromeAmoStrategy = await ethers.getContractAt("AerodromeAMOStrategy", aerodromeAmoStrategyProxy.address);

  // Bridged wOETH
  const woethProxy = await ethers.getContract("BridgedBaseWOETHProxy");
  const woeth = await ethers.getContractAt("BridgedWOETH", woethProxy.address);

  const oracleRouter = await ethers.getContract(
    isFork ? "OETHBaseOracleRouter" : "MockOracleRouter"
  );

  // WETH
  const weth = isFork
    ? await ethers.getContractAt("IWETH9", addresses.base.WETH)
    : await ethers.getContract("MockWETH");

  const signers = await hre.ethers.getSigners();

  const [minter, burner, rafael, nick] = signers.slice(4); // Skip first 4 addresses to avoid conflict
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  const governor = await ethers.getSigner(governorAddr);
  const strategist = await impersonateAndFund(strategistAddr);
  const woethGovernor = await ethers.getSigner(await woethProxy.governor());


  // Make sure we can print bridged WOETH for tests
  if (isBaseFork) {
    await impersonateAndFund(woethGovernor.address);

    const woethImplAddr = await woethProxy.implementation();
    const latestImplAddr = (await ethers.getContract("BridgedWOETH")).address;

    if (woethImplAddr != latestImplAddr) {
      await woethProxy.connect(woethGovernor).upgradeTo(latestImplAddr);
    }
  }

  await woeth.connect(woethGovernor).grantRole(MINTER_ROLE, minter.address);
  await woeth.connect(woethGovernor).grantRole(BURNER_ROLE, burner.address);

  for (const user of [rafael, nick]) {
    // Mint some bridged WOETH
    await woeth.connect(minter).mint(user.address, oethUnits("1"));
    await weth.connect(user).deposit({ value: oethUnits("100") });

    // Set allowance on the vault
    await weth.connect(user).approve(oethbVault.address, oethUnits("50"));
  }

  await woeth.connect(minter).mint(woethGovernor.address, oethUnits("1"));

  if (isFork) {
    // Governor opts in for rebasing
    await oethb.connect(governor).rebaseOptIn();
  }

  const aeroSwapRouter = await ethers.getContractAt(aeroSwapRouterAbi, addresses.base.swapRouter);

  // TODO delete once we have gauge on the mainnet
  await setupAerodromeOEthbWETHGauge(oethb.address, aerodromeAmoStrategy, governor);

  return {
    // Aerodrome
    aeroSwapRouter,
    // OETHb
    oethb,
    oethbVault,
    wOETHb,

    // Bridged WOETH
    woeth,
    woethProxy,
    oracleRouter,

    // Strategies
    aerodromeAmoStrategy,

    // WETH
    weth,

    // Signers
    governor,
    strategist,
    woethGovernor,
    minter,
    burner,

    rafael,
    nick,
  };
});

/**
 * This is needed only as long as the gauge isn't created on the base mainnet
 */
const setupAerodromeOEthbWETHGauge = async (oethbAddress, aerodromeAmoStrategy, governor) => {
  const voter = await ethers.getContractAt(aeroVoterAbi, addresses.base.aeroVoterAddress);
  const amoPool = await ethers.getContractAt(slipstreamPoolAbi, addresses.base.aerodromeOETHbWETHClPool);

  const aeroGaugeSigner = await impersonateAndFund(addresses.base.aeroGaugeGovernorAddress);

  // whitelist OETHb
  await voter
    .connect(aeroGaugeSigner)
    .whitelistToken(
      oethbAddress,
      true
    );
    
  // create a gauge
  await voter
    .connect(aeroGaugeSigner)
    .createGauge(
      // 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A
      addresses.base.slipstreamPoolFactory,
      // 0x6446021F4E396dA3df4235C62537431372195D38
      addresses.base.aerodromeOETHbWETHClPool
    );


  await aerodromeAmoStrategy
    .connect(governor)
    .setGauge(await amoPool.gauge());
};

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultBaseFixture,
  MINTER_ROLE,
  BURNER_ROLE,
};
