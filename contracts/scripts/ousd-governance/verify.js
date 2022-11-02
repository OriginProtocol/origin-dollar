const { ethers } = require("hardhat");
const {
  verifyContractWithArgs,
  verifyContractNoArgs,
  week,
} = require("../../utils/governance-helpers");

/**
 * Verify Governance contracts:
 * @param {Number | String} networkId id of the deployment network
 * @param {Number | String} rewardsStartTimestamp epoch of the rewards initiation
 * @param {Number | String} mandatoryEndBlock claim end block for mandatory merkle lockup
 * @param {Number | String} optionalEndBlock claim end block for optional merkle lockup
 */
async function verify(
  networkId,
  rewardsStartTimestamp,
  mandatoryEndBlock,
  optionalEndBlock
) {
  const deployment = require(`../build/deployments/deployment_${networkId}.json`);
  const networkName = hre.network.name;
  if (networkName == "hardhat") {
    console.log("network must be different than hardhat to verify contracts");
    return;
  }
  const [admin] = await ethers.getSigners();

  try {
    await verifyContractNoArgs(deployment.ogvImpl);
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractNoArgs(deployment.rewardsSource);
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractNoArgs(deployment.veogv);
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractWithArgs(deployment.ogv, deployment.ogvImpl, "0x");
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractWithArgs(deployment.rewardsSourceImpl, deployment.ogv);
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractWithArgs(
      deployment.veogvImpl,
      deployment.ogv,
      rewardsStartTimestamp,
      week,
      deployment.rewardsSource
    );
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractWithArgs(
      deployment.timelock,
      [admin.address],
      [admin.address]
    );
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractWithArgs(
      deployment.governance,
      deployment.veogv,
      deployment.timelock
    );
  } catch (err) {
    console.log(err.message);
  }
  // Load merkle claims
  const optionalLockupClaims = require(`./${networkId}_data/optional_lockup_claims.json`);
  const mandatoryLockupClaims = require(`./${networkId}_data/mandatory_lockup_claims.json`);
  try {
    await verifyContractWithArgs(
      deployment.optionalLockup,
      deployment.ogv,
      optionalLockupClaims.merkleRoot,
      deployment.veogv,
      optionalEndBlock
    );
  } catch (err) {
    console.log(err.message);
  }
  try {
    await verifyContractWithArgs(
      deployment.mandatoryLockup,
      deployment.ogv,
      mandatoryLockupClaims.merkleRoot,
      deployment.veogv,
      mandatoryEndBlock
    );
  } catch (err) {
    console.log(err.message);
  }
}

module.exports = { verify };
