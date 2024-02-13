const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isArbFork, oethUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");

const log = require("../utils/logger")("test:fixtures-arb");

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
      isFork ? ["arbitrum"] : ["arbitrum_unit_tests"]
    }"`
  );

  // Run the contract deployments
  await deployments.fixture(isFork ? ["arbitrum"] : ["unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  const woethProxy = await ethers.getContract("BridgedWOETHProxy");
  const woeth = await ethers.getContractAt("BridgedWOETH", woethProxy.address);

  const signers = await hre.ethers.getSigners();

  const [minter, burner, rafael, nick] = signers.slice(4); // Skip first 4 addresses to avoid conflict
  const governor = await ethers.getSigner(await woeth.governor());

  if (isArbFork) {
    await impersonateAndFund(governor.address);
  }

  await woeth.connect(governor).grantRole(MINTER_ROLE, minter.address);
  await woeth.connect(governor).grantRole(BURNER_ROLE, burner.address);

  // Mint some WOETH
  await woeth.connect(minter).mint(rafael.address, oethUnits("1"));
  await woeth.connect(minter).mint(nick.address, oethUnits("1"));

  return {
    woeth,
    woethProxy,

    governor,
    minter,
    burner,

    rafael,
    nick,
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
