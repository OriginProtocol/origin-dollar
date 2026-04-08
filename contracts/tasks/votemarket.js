const { Contract } = require("ethers");

const { Wallet } = require("ethers");

const addresses = require("../utils/addresses");
const log = require("../utils/logger")("task:votemarket");

// Contract addresses
const BRIBES_MODULE = addresses.mainnet.CurvePoolBoosterBribesModule;
const VOTEMARKET = addresses.votemarket;

// Minimal ABIs
const bribesModuleAbi = [
  "function getPoolBoosters() external view returns (address[])",
];

const curvePoolBoosterAbi = [
  "function campaignId() external view returns (uint256)",
];

const votemarketAbi = [
  "function currentEpoch() external view returns (uint256)",
  "function getPeriodPerCampaign(uint256 campaignId, uint256 epoch) external view returns (uint256 rewardPerPeriod, uint256 rewardPerVote, uint256 leftover, bool updated)",
  "function updateEpoch(uint256 campaignId, uint256 epoch, bytes calldata hookData) external",
];

/**
 * Update Votemarket epochs for all Curve Pool Booster campaigns on Arbitrum.
 *
 * @param {Object} params
 * @param {ethers.providers.Provider} params.mainnetProvider - Mainnet provider (to read BribesModule and campaignIds)
 * @param {ethers.providers.Provider} params.arbitrumProvider - Arbitrum provider (to read Votemarket state)
 * @param {ethers.Signer} params.arbitrumSigner - Arbitrum signer (to send updateEpoch txs)
 * @param {boolean} params.dryRun - If true, skip sending transactions
 */
async function updateVotemarketEpochs({
  mainnetProvider,
  arbitrumProvider,
  arbitrumSigner,
  dryRun,
}) {
  const { chainId } = await arbitrumProvider.getNetwork();
  if (chainId !== 42161) {
    throw new Error(`Arbitrum provider must be on chain 42161, got ${chainId}`);
  }

  log(`VOTEMARKET address: ${VOTEMARKET}`);
  log(`BRIBES_MODULE address: ${BRIBES_MODULE}`);
  log(`dryRun: ${dryRun}`);

  // Fetch pool boosters from BribesModule on Mainnet
  const bribesModule = new Contract(
    BRIBES_MODULE,
    bribesModuleAbi,
    mainnetProvider
  );
  const poolBoosters = await bribesModule.getPoolBoosters();
  log(`Found ${poolBoosters.length} pool boosters`);

  // Collect campaignIds from pool boosters
  const campaignIds = [];
  for (const poolBoosterAddress of poolBoosters) {
    if (poolBoosterAddress === addresses.zero) {
      log(`Skipping zero address pool booster`);
      continue;
    }

    const poolBooster = new Contract(
      poolBoosterAddress,
      curvePoolBoosterAbi,
      mainnetProvider
    );

    let campaignId;
    try {
      campaignId = await poolBooster.campaignId();
    } catch (err) {
      log(`Error reading campaignId for ${poolBoosterAddress}: ${err.message}`);
      continue;
    }

    if (campaignId.eq(0)) {
      log(`Skipping pool booster ${poolBoosterAddress} with campaignId 0`);
      continue;
    }

    log(`Pool booster ${poolBoosterAddress} has campaignId ${campaignId}`);
    campaignIds.push(campaignId);
  }

  log(`\nChecking ${campaignIds.length} campaigns on Votemarket (Arbitrum)`);

  const votemarket = new Contract(VOTEMARKET, votemarketAbi, arbitrumProvider);
  const epoch = await votemarket.currentEpoch();
  log(`Current Votemarket epoch: ${epoch}`);

  let needsUpdate = 0;
  let updated = 0;
  let errors = 0;

  for (const campaignId of campaignIds) {
    let period;
    try {
      period = await votemarket.getPeriodPerCampaign(campaignId, epoch);
    } catch (err) {
      log(`Error reading period for campaignId ${campaignId}: ${err.message}`);
      errors++;
      continue;
    }

    if (period.updated) {
      log(`Campaign ${campaignId}: epoch already updated`);
      continue;
    }

    needsUpdate++;
    if (dryRun) {
      log(`[DRY RUN] Would update epoch for campaignId ${campaignId}`);
      continue;
    }

    try {
      const votemarketWithSigner = votemarket.connect(arbitrumSigner);
      const tx = await votemarketWithSigner.updateEpoch(
        campaignId,
        epoch,
        "0x"
      );
      log(`Sent updateEpoch tx for campaignId ${campaignId}: ${tx.hash}`);
      const receipt = await tx.wait();
      if (receipt.status !== 1) {
        log(`FAILURE: updateEpoch reverted for campaignId ${campaignId}`);
        errors++;
      } else {
        log(`SUCCESS: updated epoch for campaignId ${campaignId}`);
        updated++;
      }
    } catch (err) {
      log(`Error updating epoch for campaignId ${campaignId}: ${err.message}`);
      errors++;
    }
  }

  log(`\n=== SUMMARY ===`);
  log(`Total campaigns checked: ${campaignIds.length}`);
  if (dryRun) {
    log(`Campaigns needing update: ${needsUpdate} (dry run, no txs sent)`);
  } else {
    log(`Campaigns updated: ${updated}`);
    log(`Campaigns that needed update: ${needsUpdate}`);
  }
  if (errors > 0) {
    log(`Errors encountered: ${errors}`);
  }
}

/**
 * Hardhat task to update Votemarket epochs for all Curve Pool Booster campaigns.
 */
async function updateVotemarketEpochsTask(taskArguments) {
  const dryRun = taskArguments.dryRun !== false;

  // Detect mainnet vs fork from hardhat's ethers provider
  const mainnetProvider = ethers.provider;

  // Create Arbitrum provider from env var
  const arbitrumRpcUrl =
    process.env.ARBITRUM_PROVIDER_URL || process.env.PROVIDER_URL;
  if (!arbitrumRpcUrl) {
    throw new Error(
      "ARBITRUM_PROVIDER_URL or PROVIDER_URL env var required for Arbitrum connection"
    );
  }

  const { ethers: ethersLib } = require("ethers");
  const arbitrumProvider = new ethersLib.providers.JsonRpcProvider(
    arbitrumRpcUrl
  );

  let arbitrumSigner = null;
  if (!dryRun) {
    const pk = process.env.DEPLOYER_PK || process.env.GOVERNOR_PK;
    if (!pk) {
      throw new Error(
        "DEPLOYER_PK or GOVERNOR_PK env var required for non-dry-run mode"
      );
    }
    arbitrumSigner = new Wallet(pk, arbitrumProvider);
  }

  await updateVotemarketEpochs({
    mainnetProvider,
    arbitrumProvider,
    arbitrumSigner,
    dryRun,
  });
}

module.exports = {
  updateVotemarketEpochs,
  updateVotemarketEpochsTask,
};
