const { Defender } = require("@openzeppelin/defender-sdk");

const { manageBribes } = require("../../tasks/poolBooster");

const log = require("../../utils/logger")("action:manageBribes");

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

  // Parse options from event
  const skipRewardPerVote = event.request?.body?.skipRewardPerVote ?? false;
  const targetEfficiency = event.request?.body?.targetEfficiency ?? 1;
  const chunkSize = event.request?.body?.chunkSize ?? 4;

  log(
    `Managing max reward per vote with target efficiency ${targetEfficiency}, skip reward per vote ${skipRewardPerVote}, and chunk size ${chunkSize}`
  );
  await manageBribes({
    provider,
    signer,
    targetEfficiency,
    skipRewardPerVote,
    chunkSize,
  });
};

module.exports = { handler };
