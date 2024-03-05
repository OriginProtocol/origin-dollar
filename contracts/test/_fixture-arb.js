const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isArbFork, oethUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");
const { setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");

const log = require("../utils/logger")("test:fixtures-arb");

const ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const BURNER_ROLE =
  "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848";

let snapshotId;
const defaultArbitrumFixture = deployments.createFixture(async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isArbFork && isFork) {
    // Only works for Arbitrum One fork
    return;
  }

  log(
    `Before deployments with param "${
      isFork ? ["arbitrumOne"] : ["arb_unit_tests"]
    }"`
  );

  // Run the contract deployments
  await deployments.fixture(isFork ? ["arbitrumOne"] : ["arb_unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  const woethProxy = await ethers.getContract("BridgedWOETHProxy");
  const woeth = await ethers.getContractAt("BridgedWOETH", woethProxy.address);

  const signers = await hre.ethers.getSigners();

  const mainnetGovernor = signers[1];

  const [minter, burner, rafael, nick] = signers.slice(4); // Skip first 4 addresses to avoid conflict

  // L2 Governance
  const l2GovernanceProxy = await ethers.getContract("L2GovernanceProxy");
  const l2Governance = await ethers.getContractAt(
    "L2Governance",
    l2GovernanceProxy.address
  );

  // The actual L2Governor contract
  const l2Governor = await ethers.getContract("L2Governor");

  // Impersonated L2Governor contract's signer for tests
  const governor = await impersonateAndFund(l2Governor.address);

  if (isFork) {
    let woethGov = await woeth.governor();
    if (woethGov != governor.address) {
      woethGov = await impersonateAndFund(woethGov);

      // Transfer WOETH governance on fork
      await setStorageAt(
        woethProxy.address,
        "0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a",
        ethers.utils.defaultAbiCoder.encode(["address"], [l2Governor.address])
      );

      // Grant admin role
      await woeth.connect(woethGov).grantRole(ADMIN_ROLE, l2Governor.address);
    }
  }

  // Executor
  const executor = await ethers.getContractAt(
    "MainnetGovernanceExecutor",
    isFork
      ? addresses.mainnet.MainnetGovernanceExecutorProxy
      : (
          await ethers.getContract("MainnetGovernanceExecutorProxy")
        ).address
  );

  await woeth.connect(governor).grantRole(MINTER_ROLE, minter.address);
  await woeth.connect(governor).grantRole(BURNER_ROLE, burner.address);

  // Mint some WOETH
  await woeth.connect(minter).mint(rafael.address, oethUnits("1"));
  await woeth.connect(minter).mint(nick.address, oethUnits("1"));

  let mockCCIPRouter;
  if (!isFork) {
    mockCCIPRouter = await ethers.getContract("MockCCIPRouter");
  }

  const ccipRouterSigner = !isFork
    ? undefined
    : await impersonateAndFund(addresses.mainnet.CCIPRouter);

  return {
    l2GovernanceProxy,
    l2Governance,
    l2Governor,
    executor,

    woeth,
    woethProxy,

    governor,
    minter,
    burner,
    mainnetGovernor,

    rafael,
    nick,
    ccipRouterSigner,
    mockCCIPRouter,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultArbitrumFixture,

  MINTER_ROLE,
  BURNER_ROLE,
};
