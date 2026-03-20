const { Defender } = require("@openzeppelin/defender-sdk");

const { manageMerklBribes } = require("../../tasks/merklPoolBooster");

const log = require("../../utils/logger")("action:manageMerklBribes");

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
  const exclusionList = event.request?.body?.exclusionList ?? [];

  log(`Calling bribeAll with exclusion list: [${exclusionList.join(", ")}]`);
  await manageMerklBribes({
    provider,
    signer,
    exclusionList,
  });
};

module.exports = { handler };
