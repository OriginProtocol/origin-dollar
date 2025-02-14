const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isSonicFork, oethUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");

const log = require("../utils/logger")("test:fixtures-sonic");

const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const BURNER_ROLE =
  "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848";

let snapshotId;
const defaultSonicFixture = deployments.createFixture(async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isSonicFork && isFork) {
    // Only works for Sonic fork
    return;
  }

  let deployerAddr;
  if (isFork) {
    // Fund deployer account
    const namedAccounts = await getNamedAccounts();
    deployerAddr = namedAccounts.deployerAddr;
    await impersonateAndFund(deployerAddr);
  }

  log(
    `Before deployments with param "${
      isFork ? ["sonic"] : ["sonic_unit_tests"]
    }"`
  );

  // Run the contract deployments
  await deployments.fixture(isFork ? ["sonic"] : ["sonic_unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  // Origin S token
  const oSonicProxy = await ethers.getContract("OSonicProxy");
  const oSonic = await ethers.getContractAt("OSonic", oSonicProxy.address);

  // Wrapped Origin S (4626)
  const wOSonicProxy = await ethers.getContract("WOSonicProxy");
  const wOSonic = await ethers.getContractAt("WOSonic", wOSonicProxy.address);

  // Origin S Vault
  const oSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
  const oSonicVault = await ethers.getContractAt(
    "IVault",
    oSonicVaultProxy.address
  );

  // Sonic staking strategy
  const sonicStakingStrategyProxy = await ethers.getContract(
    "SonicStakingStrategyProxy"
  );
  const sonicStakingStrategy = await ethers.getContractAt(
    "SonicStakingStrategy",
    sonicStakingStrategyProxy.address
  );

  const nodeDriver = await ethers.getContractAt(
    "INodeDriver",
    addresses.sonic.nodeDriver
  );

  const sfc = await ethers.getContractAt("ISFC", addresses.sonic.SFC);

  let dripper, zapper, poolBoosterFactory;
  if (isFork) {
    // Dripper
    const dripperProxy = await ethers.getContract("OSonicDripperProxy");
    dripper = await ethers.getContractAt(
      "FixedRateDripper",
      dripperProxy.address
    );

    zapper = await ethers.getContract("OSonicZapper");

    const poolBoosterFactoryProxy = await ethers.getContract("PoolBoosterFactoryProxy");
    poolBoosterFactory = await ethers.getContractAt(
      "PoolBoosterFactory",
      poolBoosterFactoryProxy.address
    );
  }

  // Sonic's wrapped S token
  let wS;

  if (isFork) {
    wS = await ethers.getContractAt("IWrappedSonic", addresses.sonic.wS);
  } else {
    wS = await ethers.getContract("MockWS");
  }

  const signers = await hre.ethers.getSigners();

  const [minter, burner, rafael, nick, clement] = signers.slice(4); // Skip first 4 addresses to avoid conflict
  const { strategistAddr, timelockAddr } =
    await getNamedAccounts();
  // Impersonate governor
  const governor = await impersonateAndFund(addresses.sonic.timelock);
  governor.address = addresses.sonic.timelock;

  // Impersonate strategist
  const strategist = await impersonateAndFund(strategistAddr);
  strategist.address = strategistAddr;

  // Impersonate strategist
  const timelock = await impersonateAndFund(timelockAddr);
  timelock.address = timelockAddr;

  const oSonicVaultSigner = await impersonateAndFund(oSonicVault.address);

  let validatorRegistrator;
  if (isFork) {
    validatorRegistrator = await impersonateAndFund(
      addresses.sonic.validatorRegistrator
    );
    validatorRegistrator.address = addresses.sonic.validatorRegistrator;

    await sonicStakingStrategy.connect(strategist).setDefaultValidatorId(18);
  }

  for (const user of [rafael, nick, clement]) {
    // Mint some Sonic Wrapped S
    await hhHelpers.setBalance(user.address, oethUnits("100000000"));
    await wS.connect(user).deposit({ value: oethUnits("10000000") });

    // Set allowance on the vault
    await wS.connect(user).approve(oSonicVault.address, oethUnits("5000"));
  }

  return {
    // Origin S
    oSonic,
    oSonicVault,
    wOSonic,
    // harvester,
    // dripper,
    sonicStakingStrategy,
    dripper,
    zapper,
    poolBoosterFactory,

    // Wrapped S
    wS,

    // Signers
    governor,
    strategist,
    timelock,
    minter,
    burner,
    oSonicVaultSigner,
    validatorRegistrator,

    rafael,
    nick,
    clement,

    nodeDriver,
    sfc,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultSonicFixture,
  MINTER_ROLE,
  BURNER_ROLE,
};
