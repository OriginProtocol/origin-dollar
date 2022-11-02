const fs = require("fs");
const { ethers } = require("hardhat");
const { deploy, deployArgs, toHex } = require("../../utils/governance-helpers");
const { verify } = require("./verify");

const epoch = 1657584000; // Start of rewards: Tuesday, July 12, 2022 12:00:00 AM UTC
const epoch_block = 15124542;
const end_block = ((60 * 60 * 24 * 30 * 3) / 13.2).toFixed(0) + epoch_block; // end of claims

deployContracts(1, 1657584000, end_block, end_block);

/**
 * Deploy Governance contracts:
 * OGV, veOGV, Governance, Timelock, Rewards Source and lockup contracts
 * Stores contract addresses in ./build/deployments
 * @param {Number | String} networkId id of the deployment network
 * @param {Number | String} rewardsStartTimestamp epoch of the rewards initiation
 * @param {Number | String} mandatoryEndBlock claim end block for mandatory merkle lockup
 * @param {Number | String} optionalEndBlock claim end block for optional merkle lockup
 */
async function deployContracts(
  networkId,
  rewardsStartTimestamp,
  mandatoryEndBlock,
  optionalEndBlock
) {
  const [admin] = await ethers.getSigners();
  console.log("Deploying Governance contracts from", admin.address);

  // Origin dollar governance token (OGV) deployment
  const ogvImpl = await deploy("OriginDollarGovernance");
  const ogvProxy = await deployArgs("ERC1967Proxy", ogvImpl.address, "0x");
  const ogv = await ethers.getContractAt(
    "OriginDollarGovernance",
    ogvProxy.address
  );
  await ogv.initialize();
  console.log("deployed ogv impl and proxy");

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
  console.log("deployed rewards source impl and proxy");

  // Deploy Staking (veOGV)
  const minStakingTime = 7 * 24 * 60 * 60;
  const veogvImpl = await deployArgs(
    "OgvStaking",
    ogv.address,
    rewardsStartTimestamp,
    minStakingTime,
    rewardsSource.address
  );
  const veogvProxy = await deploy("OgvStakingProxy");
  const veogv = await ethers.getContractAt("OgvStaking", veogvProxy.address);
  console.log("deployed veogv impl and proxy");

  // Initialize veOGV
  // Set deployer address as governor for testing
  await veogvProxy.initialize(veogvImpl.address, admin.address, "0x");
  // Deploy timelock
  const timelock = await deployArgs(
    "TimelockGovernance",
    [admin.address],
    [admin.address]
  );
  console.log("deployed timelock");

  // Deploy governance
  const governance = await deployArgs(
    "Governance",
    veogv.address,
    timelock.address
  );
  console.log("deployed governance");

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
  console.log("granted roles to governance");

  // Deploy lockups
  // Load merkle claims
  const optionalLockupClaims = require(`./${networkId}_data/optional_lockup_claims.json`);
  const mandatoryLockupClaims = require(`./${networkId}_data/mandatory_lockup_claims.json`);

  const optionalLockup = await deployArgs(
    "OptionalLockupDistributor",
    ogv.address,
    optionalLockupClaims.merkleRoot,
    veogv.address,
    optionalEndBlock
  );

  const mandatoryLockup = await deployArgs(
    "MandatoryLockupDistributor",
    ogv.address,
    mandatoryLockupClaims.merkleRoot,
    veogv.address,
    mandatoryEndBlock
  );
  console.log("deployed lockup claims");

  const deployment = {
    ogv: ogv.address,
    veogv: veogv.address,
    rewardsSource: rewardsSource.address,
    timelock: timelock.address,
    governance: governance.address,
    optionalLockup: optionalLockup.address,
    mandatoryLockup: mandatoryLockup.address,
    ogvImpl: ogvImpl.address,
    veogvImpl: veogvImpl.address,
    rewardsSourceImpl: rewardsSourceImpl.address,
  };

  const networkName = hre.network.name;
  fs.writeFileSync(
    `./deployments/governance/deployment_${networkName}.json`,
    JSON.stringify(deployment)
  );

  // Verify the contracts
  if (networkName !== "hardhat") {
    await verify(
      networkId,
      rewardsStartTimestamp,
      mandatoryEndBlock,
      optionalEndBlock
    );
  }
}
