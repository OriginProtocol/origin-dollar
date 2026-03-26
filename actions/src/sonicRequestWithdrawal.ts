const { Defender } = require("@openzeppelin/defender-sdk");

const { undelegateValidator } = require("../../utils/sonicActions");

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

  // The vault buffer in basis points, so 100 = 1%
  const bufferPct = 50;

  await undelegateValidator({ signer, bufferPct });
};

module.exports = { handler };
