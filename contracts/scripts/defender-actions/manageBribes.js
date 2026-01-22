const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { formatUnits } = require("ethers/lib/utils");

const {
  manageBribes
} = require("../../tasks/poolBooster");

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

  log(`Managing max reward per vote with target efficiency ${targetEfficiency} and skip reward per vote ${skipRewardPerVote}`);
  await manageBribes({ provider, signer, targetEfficiency, skipRewardPerVote });
};

module.exports = { handler };
