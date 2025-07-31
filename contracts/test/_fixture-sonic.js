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
const { resolveAsset } = require("../utils/resolvers.js");
const merklDistributorAbi = require("./abi/merklDistributor.json");

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
    poolBoosterCentralRegistry,
    poolBoosterMerklFactory,
    poolBoosterFactoryMetropolis;
  let merklDistributor;
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

    poolBoosterMerklFactory = await ethers.getContract(
      "PoolBoosterFactoryMerkl"
    );

    merklDistributor = await ethers.getContractAt(
      merklDistributorAbi,
      addresses.sonic.MerklDistributor
    );

    poolBoosterFactoryMetropolis = await ethers.getContract(
      "PoolBoosterFactoryMetropolis"
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
    await hhHelpers.setBalance(user.address, oethUnits("100000100"));
    await wS.connect(user).deposit({ value: oethUnits("100000000") });

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
    poolBoosterFactoryMetropolis,
    poolBoosterMerklFactory,

    // Merkl distributor
    merklDistributor,

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

  let swapXAMOStrategy, swapXPool, swapXGauge, swpx;

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

    swpx = await resolveAsset("SWPx");
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

  return { ...fixture, swapXAMOStrategy, swapXPool, swapXGauge, swpx };
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

const filterAndParseRewardAddedEvents = async (tx) => {
  // keccak256("RewardAdded(address,uint256,uint256)")
  const rewardAddedTopic =
    "0x6a6f77044107a33658235d41bedbbaf2fe9ccdceb313143c947a5e76e1ec8474";

  const { events } = await tx.wait();
  return events
    .filter((e) => e.topics[0] == rewardAddedTopic)
    .map((e) => {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "uint256", "uint256"],
        e.data
      );
      return {
        rewardToken: decoded[0],
        amount: decoded[1],
        startTimestamp: decoded[2],
      };
    });
};

const filterAndParseNotifyRewardEvents = async (tx, gaugeAddress) => {
  // keccak256("NotifyReward(address,address,uint256,uint256)")
  const notifyRewardTopic =
    "0x52977ea98a2220a03ee9ba5cb003ada08d394ea10155483c95dc2dc77a7eb24b";

  const { events } = await tx.wait();

  return (
    events
      // gauge address filter is required because FeeDistributor contract in Shadow emits
      // the event with the same signature
      .filter(
        (e) => e.topics[0] == notifyRewardTopic && e.address == gaugeAddress
      )
      .map((e) => {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ["uint256", "uint256"],
          e.data
        );

        const briber = ethers.utils.defaultAbiCoder.decode(
          ["address"],
          e.topics[1]
        )[0];

        const rewardToken = ethers.utils.defaultAbiCoder.decode(
          ["address"],
          e.topics[2]
        )[0];

        return {
          briber,
          rewardToken,
          amount: decoded[0],
          period: decoded[1],
        };
      })
  );
};

const getPoolBoosterContractFromPoolAddress = async (factory, poolAddress) => {
  const poolBoosterEntry = await factory.poolBoosterFromPool(poolAddress);
  const poolBoosterType = poolBoosterEntry.boosterType;

  if (poolBoosterType == 0) {
    return await ethers.getContractAt(
      "PoolBoosterSwapxDouble",
      poolBoosterEntry.boosterAddress
    );
  } else if (poolBoosterType == 1) {
    return await ethers.getContractAt(
      "PoolBoosterSwapxSingle",
      poolBoosterEntry.boosterAddress
    );
  } else {
    throw new Error(`Unrecognised pool booster type: ${poolBoosterType}`);
  }
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

  filterAndParseRewardAddedEvents,
  filterAndParseNotifyRewardEvents,
  getPoolBoosterContractFromPoolAddress,
};
