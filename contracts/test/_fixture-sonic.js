const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isSonicFork, oethUnits } = require("./helpers");
const { deployWithConfirmation } = require("../utils/deploy.js");
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

  let dripper,
    zapper,
    poolBoosterDoubleFactoryV1,
    poolBoosterSingleFactoryV1,
    poolBoosterCentralRegistry;
  if (isFork) {
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
    await wS.connect(user).approve(oSonicVault.address, oethUnits("5000000"));
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
    poolBoosterDoubleFactoryV1,
    poolBoosterSingleFactoryV1,
    poolBoosterCentralRegistry,

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

const filterAndParseNotifyRewardEvents = async (tx) => {
  // keccak256("NotifyReward(address,address,uint256,uint256)")
  const notifyRewardTopic =
    "0x52977ea98a2220a03ee9ba5cb003ada08d394ea10155483c95dc2dc77a7eb24b";

  const { events } = await tx.wait();
  return events
    .filter((e) => e.topics[0] == notifyRewardTopic)
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
    });
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
  MINTER_ROLE,
  BURNER_ROLE,

  filterAndParseRewardAddedEvents,
  filterAndParseNotifyRewardEvents,
  getPoolBoosterContractFromPoolAddress,
};
