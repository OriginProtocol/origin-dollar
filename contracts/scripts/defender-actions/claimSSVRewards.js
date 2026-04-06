const { Defender } = require("@openzeppelin/defender-sdk");

const { claimSSVRewards } = require("../../tasks/ssvRewards");

const log = require("../../utils/logger")("action:claimSSVRewards");

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

  log("Claiming SSV rewards from CumulativeMerkleDrop");
  await claimSSVRewards(signer);
};

module.exports = { handler };
