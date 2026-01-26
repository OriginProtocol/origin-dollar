const { Defender } = require("@openzeppelin/defender-sdk");
const { processCctpBridgeTransactions } = require("../../tasks/crossChain");

const log = require("../../utils/logger")("action:crossChainRelay");

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

  await processCctpBridgeTransactions({ signer, provider: signer.provider, store: client.keyValueStore });
};

module.exports = { handler };
