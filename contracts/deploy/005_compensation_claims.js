const {
  isMainnet,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const { log } = require("../utils/deploy");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

//
// 1. Deploy new Single Asset Staking contract
//
const compensationClaimsDeploy = async ({ getNamedAccounts, deployments }) => {
  console.log("Running 005_compensation_claims...");

  const { deploy } = deployments;
  const { governorAddr, deployerAddr, adjusterAddr } = await getNamedAccounts();

  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  const OUSD = await ethers.getContract("OUSDProxy");
  log(`Using OUSD address ${OUSD.address}`);

  // Deploy the claims contract proxy.
  let d = await deploy("CompensationClaims", {
    args: [OUSD.address, adjusterAddr],
    contract: "CompensationClaims",
    from: deployerAddr,
  });

  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CompensationClaims", d);

  const claimsContract = await ethers.getContract("CompensationClaims");

  //
  // Transfer governance of the CompensationClaims contract to the governor
  //  - On Mainnet the governance transfer gets executed separately, via the multi-sig wallet.
  //  - On other networks, this migration script can claim governance by the governor.
  //
  let t = await claimsContract
    .connect(sDeployer)
    .transferGovernance(governorAddr);
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log(`CompensationClaims transferGovernance(${governorAddr} called`);

  if (!isMainnetOrRinkebyOrFork) {
    t = await claimsContract
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance();
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log("Claimed governance for CompensationClaims");
  }

  console.log("005_compensation_claims deploy done.");

  return true;
};

compensationClaimsDeploy.id = "005_compensation_claims";
compensationClaimsDeploy.dependencies = ["core"];

// TODO(franck): enable Mainnet once we are ready to deploy.
compensationClaimsDeploy.skip = () => isMainnet || isRinkeby;

module.exports = compensationClaimsDeploy;
