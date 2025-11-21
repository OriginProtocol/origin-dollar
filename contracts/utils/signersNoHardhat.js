const ethers = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const log = require("./logger")("utils:signers");

const getDefenderSigner = async () => {
  const speed = process.env.SPEED || "fastest";
  if (!["safeLow", "average", "fast", "fastest"].includes(speed)) {
    console.error(
      `Defender Relay Speed param must be either 'safeLow', 'average', 'fast' or 'fastest'. Not "${speed}"`
    );
    process.exit(2);
  }

  const { chainId } = await ethers.getDefaultProvider().getNetwork();

  const isMainnet = chainId === 1;

  const relayerApiKey = isMainnet
    ? process.env.DEFENDER_API_KEY
    : process.env.HOLESKY_DEFENDER_API_KEY || process.env.DEFENDER_API_KEY;
  const relayerApiSecret = isMainnet
    ? process.env.DEFENDER_API_SECRET
    : process.env.HOLESKY_DEFENDER_API_SECRET ||
      process.env.DEFENDER_API_SECRET;

  const credentials = {
    relayerApiKey,
    relayerApiSecret,
  };

  const client = new Defender(credentials);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });

  const signer = await client.relaySigner.getSigner(provider, {
    speed,
    ethersVersion: "v5",
  });
  log(
    `Using Defender Relayer account ${await signer.getAddress()} with speed "${speed}" from env vars DEFENDER_RELAYER_KEY and DEFENDER_RELAYER_SECRET`
  );

  return signer;
};

module.exports = {
  getDefenderSigner,
};
