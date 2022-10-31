const { ethers, deployments } = require("hardhat");
const {
  deploy,
  deployArgs,
  bnDecimal,
  toHex,
  getBlockNumber,
  testMerkleData,
  getMerkleClaimer,
} = require("../../utils/governance-helpers");

/**
 * Deployment fixture
 * Deploys OGV, veOGV, Governance, Timelock, Rewards Source and lockup contracts
 * Sets up a whale voting address
 */
const deploymentFixture = deployments.createFixture(async () => {
  const [admin, , , voter] = await ethers.getSigners();

  // Origin dollar governance token (OGV) deployment
  const ogvImpl = await deploy("OriginDollarGovernance");
  const ogvProxy = await deployArgs("ERC1967Proxy", ogvImpl.address, "0x");
  const ogv = await ethers.getContractAt(
    "OriginDollarGovernance",
    ogvProxy.address
  );
  await ogv.initialize();

  // Deploy rewards source
  const rewardsSourceImpl = await deployArgs("RewardsSource", ogv.address);
  const rewardsSourceProxy = await deploy("RewardsSourceProxy");
  const rewardsSource = await ethers.getContractAt(
    "RewardsSource",
    rewardsSourceProxy.address
  );
  // Init rewards source
  // Set deployer address as governor for testing
  await rewardsSourceProxy.initialize(
    rewardsSourceImpl.address,
    admin.address,
    "0x"
  );

  // Deploy Staking (veOGV)
  const minStakingTime = 7 * 24 * 60 * 60;
  const day = 24 * 60 * 60;
  const veogvImpl = await deployArgs(
    "OgvStaking",
    ogv.address,
    day,
    minStakingTime,
    rewardsSource.address
  );
  const veogvProxy = await deploy("OgvStakingProxy");
  const veogv = await ethers.getContractAt("OgvStaking", veogvProxy.address);
  // Initialize veOGV
  // Set deployer address as governor for testing
  await veogvProxy.initialize(veogvImpl.address, admin.address, "0x");
  // Deploy timelock
  const timelock = await deployArgs(
    "TimelockGovernance",
    [admin.address],
    [admin.address]
  );

  // Deploy governance
  const governance = await deployArgs(
    "Governance",
    veogv.address,
    timelock.address
  );
  // Add governance roles to timelock
  await timelock.grantRole(
    ethers.utils.keccak256(toHex("PROPOSER_ROLE")),
    governance.address
  );
  await timelock.grantRole(
    ethers.utils.keccak256(toHex("EXECUTOR_ROLE")),
    governance.address
  );
  await timelock.grantRole(
    ethers.utils.keccak256(toHex("CANCELLER_ROLE")),
    governance.address
  );

  // Deploy lockups
  let blockNumber = await getBlockNumber();
  let optionalLockup = await deployArgs(
    "OptionalLockupDistributor",
    ogv.address,
    testMerkleData.merkle_root,
    veogv.address,
    blockNumber + 100
  );

  let mandatoryLockup = await deployArgs(
    "MandatoryLockupDistributor",
    ogv.address,
    testMerkleData.merkle_root,
    veogv.address,
    blockNumber + 100
  );

  // Get account used to claim lockups
  let claimer = await getMerkleClaimer();

  // Set up a whale voter address with more than quorum voting power
  let amount = bnDecimal(1000000); // 1M
  const week = 7 * 24 * 60 * 60;
  await ogv.approve(veogv.address, amount);
  await veogv["stake(uint256,uint256,address)"](
    amount,
    week * 52 * 4,
    voter.address
  );
  await veogv.connect(voter).delegate(voter.address);

  return {
    ogv,
    veogv,
    rewardsSource,
    timelock,
    governance,
    optionalLockup,
    mandatoryLockup,
    claimer,
  };
});

module.exports = { deploymentFixture };
