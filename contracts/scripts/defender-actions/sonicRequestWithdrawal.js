const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");

const { undelegateValidator } = require("../../utils/sonicActions");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  // The vault buffer in basis points, so 100 = 1%
  const bufferPct = 50;

  await undelegateValidator({ signer, bufferPct });
};

module.exports = { handler };
