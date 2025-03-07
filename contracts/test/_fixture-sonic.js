const hre = require("hardhat");
const { ethers } = hre;
const { parseUnits } = ethers.utils;
const mocha = require("mocha");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");

const { isFork, isSonicFork, oethUnits } = require("./helpers");
const { deployWithConfirmation } = require("../utils/deploy.js");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");

const erc20Abi = require("./abi/erc20.json");
const curveXChainLiquidityGaugeAbi = require("./abi/curveXChainLiquidityGauge.json");
const curveStableSwapNGAbi = require("./abi/curveStableSwapNG.json");
const curveChildLiquidityGaugeFactoryAbi = require("./abi/curveChildLiquidityGaugeFactory.json");

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

  const { deployerAddr, strategistAddr, timelockAddr, governorAddr } =
    await getNamedAccounts();

  if (isFork) {
    // Fund deployer account
    await impersonateAndFund(deployerAddr);
  }

  // Impersonate governor
  const governorAddress = isFork ? addresses.sonic.timelock : governorAddr;
  const governor = await impersonateAndFund(governorAddress);
  governor.address = governorAddress;

  // Impersonate strategist
  const strategist = await impersonateAndFund(strategistAddr);
  strategist.address = strategistAddr;

  // Impersonate strategist
  const timelock = await impersonateAndFund(timelockAddr);
  timelock.address = timelockAddr;

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

  const oSonicVaultSigner = await impersonateAndFund(oSonicVault.address);

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

  let harvester,
    dripper,
    zapper,
    poolBoosterDoubleFactoryV1,
    poolBoosterSingleFactoryV1,
    poolBoosterCentralRegistry;
  if (isFork) {
    // Harvester
    const harvesterProxy = await ethers.getContract("OSonicHarvesterProxy");
    harvester = await ethers.getContractAt(
      "OSonicHarvester",
      harvesterProxy.address
    );

    // Dripper
    const dripperProxy = await ethers.getContract("OSonicDripperProxy");
    dripper = await ethers.getContractAt(
      "FixedRateDripper",
      dripperProxy.address
    );

    zapper = await ethers.getContract("OSonicZapper");

    poolBoosterDoubleFactoryV1 = await ethers.getContract(
      "PoolBoosterFactorySwapxDouble_v1"
    );

    poolBoosterCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      (
        await ethers.getContract("PoolBoostCentralRegistryProxy")
      ).address
    );

    poolBoosterSingleFactoryV1 = await deployPoolBoosterFactorySwapxSingle(
      poolBoosterCentralRegistry,
      governor
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

  let validatorRegistrator,
    curveAMOStrategy,
    curvePool,
    curveGauge,
    curveChildLiquidityGaugeFactory,
    crv;
  if (isFork) {
    validatorRegistrator = await impersonateAndFund(
      addresses.sonic.validatorRegistrator
    );
    validatorRegistrator.address = addresses.sonic.validatorRegistrator;

    await sonicStakingStrategy.connect(strategist).setDefaultValidatorId(18);

    // Curve AMO
    const curveAMOProxy = await ethers.getContract(
      "SonicCurveAMOStrategyProxy"
    );
    curveAMOStrategy = await ethers.getContractAt(
      "SonicCurveAMOStrategy",
      curveAMOProxy.address
    );

    curvePool = await ethers.getContractAt(
      curveStableSwapNGAbi,
      addresses.sonic.WS_OS.pool
    );

    curveGauge = await ethers.getContractAt(
      curveXChainLiquidityGaugeAbi,
      addresses.sonic.WS_OS.gauge
    );

    curveChildLiquidityGaugeFactory = await ethers.getContractAt(
      curveChildLiquidityGaugeFactoryAbi,
      addresses.sonic.childLiquidityGaugeFactory
    );

    crv = await ethers.getContractAt(erc20Abi, addresses.sonic.CRV);
  }

  for (const user of [rafael, nick, clement]) {
    // Mint some Sonic Wrapped S
    await hhHelpers.setBalance(user.address, oethUnits("100000000"));
    await wS.connect(user).deposit({ value: oethUnits("10000000") });

    // Set allowance on the vault
    await wS.connect(user).approve(oSonicVault.address, oethUnits("100000000"));
  }

  return {
    // Origin S
    oSonic,
    oSonicVault,
    wOSonic,
    harvester,
    sonicStakingStrategy,
    dripper,
    zapper,
    poolBoosterDoubleFactoryV1,
    poolBoosterSingleFactoryV1,
    poolBoosterCentralRegistry,

    // Wrapped S
    wS,

    // Curve
    curveAMOStrategy,
    curvePool,
    curveGauge,
    curveChildLiquidityGaugeFactory,
    crv,

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

/**
 * Configure a Vault with only the OETH/(W)ETH Curve Metastrategy.
 */
async function swapXAMOFixture(
  config = {
    wsMintAmount: 0,
    depositToStrategy: false,
    balancePool: false,
    poolAddwSAmount: 0,
    poolAddOSAmount: 0,
  }
) {
  const fixture = await defaultSonicFixture();

  const { oSonic, oSonicVault, rafael, nick, strategist, timelock, wS } =
    fixture;

  let swapXAMOStrategy, swapXPool, swapXGauge;

  if (isFork) {
    const swapXAMOProxy = await ethers.getContract(
      "SonicSwapXAMOStrategyProxy"
    );
    swapXAMOStrategy = await ethers.getContractAt(
      "SonicSwapXAMOStrategy",
      swapXAMOProxy.address
    );

    swapXPool = await ethers.getContractAt(
      "IPair",
      addresses.sonic.SwapXWSOS.pool
    );

    swapXGauge = await ethers.getContractAt(
      "IGauge",
      addresses.sonic.SwapXWSOS.gauge
    );
  }

  await oSonicVault
    .connect(timelock)
    .setAssetDefaultStrategy(wS.address, addresses.zero);

  // mint some OS using wS if configured
  if (config?.wsMintAmount > 0) {
    const wsAmount = parseUnits(config.wsMintAmount.toString());
    await oSonicVault.connect(nick).rebase();
    await oSonicVault.connect(nick).allocate();

    // Calculate how much to mint based on the wS in the vault,
    // the withdrawal queue, and the wS to be sent to the strategy
    const wsBalance = await wS.balanceOf(oSonicVault.address);
    const queue = await oSonicVault.withdrawalQueueMetadata();
    const available = wsBalance.add(queue.claimed).sub(queue.queued);
    const mintAmount = wsAmount.sub(available);

    if (mintAmount.gt(0)) {
      // Approve the Vault to transfer wS
      await wS.connect(nick).approve(oSonicVault.address, mintAmount);

      // Mint OS with wS
      // This will sit in the vault, not the strategy
      await oSonicVault.connect(nick).mint(wS.address, mintAmount, 0);
    }

    // Add ETH to the Metapool
    if (config?.depositToStrategy) {
      // The strategist deposits the WETH to the AMO strategy
      await oSonicVault
        .connect(strategist)
        .depositToStrategy(swapXAMOStrategy.address, [wS.address], [wsAmount]);
    }
  }

  if (config?.balancePool) {
    const { _reserve0: wsReserves, _reserve1: osReserves } =
      await swapXPool.getReserves();

    const diff = parseInt(
      wsReserves.sub(osReserves).div(oethUnits("1")).toString()
    );

    if (diff > 0) {
      config.poolAddOSAmount = (config.poolAddOSAmount || 0) + diff;
    } else if (diff < 0) {
      config.poolAddwSAmount = (config.poolAddwSAmount || 0) - diff;
    }
  }

  // Add wS to the pool
  if (config?.poolAddwSAmount > 0) {
    log(`Adding ${config.poolAddwSAmount} wS to the pool`);
    // transfer wS to the pool
    const wsAmount = parseUnits(config.poolAddwSAmount.toString(), 18);
    await wS.connect(nick).transfer(swapXPool.address, wsAmount);
  }

  // Add OS to the pool
  if (config?.poolAddOSAmount > 0) {
    log(`Adding ${config.poolAddOSAmount} OS to the pool`);

    const osAmount = parseUnits(config.poolAddOSAmount.toString(), 18);

    // Mint OS with wS
    await oSonicVault.connect(rafael).mint(wS.address, osAmount, 0);

    // transfer OS to the pool
    await oSonic.connect(rafael).transfer(swapXPool.address, osAmount);
  }

  // force reserves to match balances
  await swapXPool.sync();

  return { ...fixture, swapXAMOStrategy, swapXPool, swapXGauge };
}

const deployPoolBoosterFactorySwapxSingle = async (
  poolBoosterCentralRegistry,
  governor
) => {
  const dPoolBoosterFactory = await deployWithConfirmation(
    "PoolBoosterFactorySwapxSingle_v1",
    [
      addresses.sonic.OSonicProxy,
      addresses.sonic.timelock,
      poolBoosterCentralRegistry.address,
    ],
    "PoolBoosterFactorySwapxSingle"
  );

  // approve the pool booster on the factory
  await poolBoosterCentralRegistry
    .connect(governor)
    .approveFactory(dPoolBoosterFactory.address);

  console.log(
    `Deployed Pool Booster Single Factory to ${dPoolBoosterFactory.address}`
  );

  return await ethers.getContract("PoolBoosterFactorySwapxSingle_v1");
};

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultSonicFixture,
  swapXAMOFixture,
  MINTER_ROLE,
  BURNER_ROLE,
};
