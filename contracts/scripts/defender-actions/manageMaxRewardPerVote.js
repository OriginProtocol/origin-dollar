const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { formatUnits } = require("ethers/lib/utils");

const {
  calculateRewardsPerVote,
  BRIBES_MODULE,
  bribesModuleAbi,
} = require("../../tasks/poolBooster");
const { logTxDetails } = require("../../utils/txLogger");

const log = require("../../utils/logger")("action:manageMaxRewardPerVote");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const client = new Defender(event);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });
  const signer = await client.relaySigner.getSigner(provider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  const { chainId } = await provider.getNetwork();
  if (chainId !== 1) {
    throw new Error(
      `Action should only be run on mainnet, not on network with chainId ${chainId}`
    );
  }

  // Parse options from event
  const skipRewardPerVote = event.request?.body?.skipRewardPerVote ?? false;
  const targetEfficiency = event.request?.body?.targetEfficiency ?? 1;

  // Calculate rewards per vote using shared utility
  const { rewardsPerVote } = await calculateRewardsPerVote(provider, {
    targetEfficiency,
    skipRewardPerVote,
    log,
  });

  if (rewardsPerVote.length === 0) {
    log("No pools registered in BribesModule, nothing to do");
    return;
  }

  // Call manageBribes on the SafeModule
  log(`\n--- Calling manageBribes on BribesModule ---`);
  log(
    `Rewards per vote: [${rewardsPerVote
      .map((r) => formatUnits(r, 18))
      .join(", ")}]`
  );

  const bribesModule = new ethers.Contract(
    BRIBES_MODULE,
    bribesModuleAbi,
    signer
  );
  const tx = await bribesModule.manageBribes(rewardsPerVote);
  await logTxDetails(tx, "manageBribes");
};

module.exports = { handler };
