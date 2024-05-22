const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isBaseFork, oethUnits, fundAccount } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");

const log = require("../utils/logger")("test:fixtures-base");

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

  log(
    `Before deployments with param "${isFork ? ["base"] : ["base_unit_tests"]}"`
  );
  const { deployerAddr, governorAddr } = await hre.getNamedAccounts();

  await fundAccount(deployerAddr);
  await fundAccount(governorAddr);

  const sGovernor = await ethers.getSigner(governorAddr);
  const sDeployer = await ethers.getSigner(deployerAddr);

  // Run the contract deployments
  await deployments.fixture(isFork ? ["base"] : ["base_unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  const woethProxy = await ethers.getContract("BridgedBaseWOETHProxy");
  const woeth = await ethers.getContractAt("BridgedWOETH", woethProxy.address);

  const oethProxy = await ethers.getContract("OETHProxy");
  const oeth = await ethers.getContractAt("OETH", oethProxy.address);
  const weth = await ethers.getContractAt(
    "IWETH9",
    addresses.base.wethTokenAddress
  );

  const oethDripperProxy = await ethers.getContract("OETHDripperProxy");
  const oethDripper = await ethers.getContractAt(
    "OETHDripper",
    oethDripperProxy.address
  );

  const oethVaultProxy = await ethers.getContract("OETHVaultProxy");
  const oethVault = await ethers.getContractAt(
    "IVault",
    oethVaultProxy.address
  );
  const oethVaultSigner = await impersonateAndFund(oethVault.address);

  const oethVaultCore = await ethers.getContract("OETHVaultCore");

  const aeroHarvesterProxy = await ethers.getContract("AeroHarvesterProxy");
  const aeroHarvester = await ethers.getContractAt(
    "AeroHarvester",
    aeroHarvesterProxy.address
  );

  const oracleRouter = await ethers.getContract("BaseOETHOracleRouter");

  const aerodromeEthStrategyProxy = await ethers.getContract(
    "AerodromeEthStrategyProxy"
  );
  const aerodromeEthStrategy = await ethers.getContractAt(
    "AerodromeEthStrategy",
    aerodromeEthStrategyProxy.address
  );

  const signers = await hre.ethers.getSigners();

  const [minter, burner, josh, rafael, nick] = signers.slice(4); // Skip first 4 addresses to avoid conflict
  const governor = await ethers.getSigner(await woeth.governor());

  if (isBaseFork) {
    await impersonateAndFund(governor.address);

    const woethImplAddr = await woethProxy.implementation();
    const latestImplAddr = (await ethers.getContract("BridgedWOETH")).address;

    if (woethImplAddr != latestImplAddr) {
      await woethProxy.connect(governor).upgradeTo(latestImplAddr);
    }
    await aeroHarvester
      .connect(governor)
      .setSupportedStrategy(aerodromeEthStrategy.address, true);
  }

  await woeth.connect(governor).grantRole(MINTER_ROLE, minter.address);
  await woeth.connect(governor).grantRole(BURNER_ROLE, burner.address);

  // Mint some WOETH
  await woeth.connect(minter).mint(rafael.address, oethUnits("1"));
  await woeth.connect(minter).mint(nick.address, oethUnits("1"));

  // Loading the AeroRouter instance
  const aeroRouter = await ethers.getContractAt(
    "IRouter",
    addresses.base.aeroRouterAddress
  );
  let poolAddress = await aeroRouter.poolFor(
    weth.address,
    oeth.address,
    true,
    addresses.base.aeroFactoryAddress
  );
  let pool = await ethers.getContractAt("IPool", poolAddress, josh);
  // Create gauge
  const aeroVoter = await ethers.getContractAt(
    "IVoter",
    addresses.base.aeroVoterAddress
  );

  const gaugeAddress = await aeroVoter.gauges(poolAddress);
  const aeroGauge = await ethers.getContractAt("IGauge", gaugeAddress, josh);
  const wethReserveIndex =
    weth.address === (await pool.token0()) ? "_reserve0" : "_reserve1";

  const oethReserveIndex =
    wethReserveIndex === "_reserve1" ? "_reserve0" : "_reserve1";

  if (config?.wethMintAmount > 0) {
    const wethAmount = parseUnits(config.wethMintAmount.toString());

    // Set vault balance. This will sit in the vault, not the strategy
    await weth.connect(josh).transfer(oethVault.address, wethAmount);

    log(`Vault weth balance set to: ${wethAmount}`);
    // Add ETH to the pool
    if (config?.depositToStrategy) {
      // The strategist deposits the WETH to the AMO strategy
      await oethVault
        .connect(josh)
        .depositToStrategy(
          aerodromeEthStrategy.address,
          [weth.address],
          [wethAmount]
        );
      log(`Deposited ${wethAmount} WETH to the strategy contract`);
    }
  }

  return {
    woeth,
    woethProxy,
    oeth,
    oethProxy,
    oethDripper,
    oethDripperProxy,
    oethVault,
    oracleRouter,
    oethVaultProxy,
    oethVaultCore,
    aeroHarvester,
    aeroHarvesterProxy,
    weth,
    aerodromeEthStrategy,
    governor,
    minter,
    burner,

    rafael,
    nick,
    josh,

    pool,
    wethReserveIndex,
    oethReserveIndex,
    aeroRouter,
    aeroGauge,
    oethVaultSigner,
    sGovernor,
    sDeployer,
  };
});

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
