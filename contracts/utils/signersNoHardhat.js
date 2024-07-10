const ethers = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");
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

  const apiKey = isMainnet
    ? process.env.DEFENDER_API_KEY
    : process.env.HOLESKY_DEFENDER_API_KEY || process.env.DEFENDER_API_KEY;
  const apiSecret = isMainnet
    ? process.env.DEFENDER_API_SECRET
    : process.env.HOLESKY_DEFENDER_API_SECRET ||
      process.env.DEFENDER_API_SECRET;

  const credentials = { apiKey, apiSecret };

  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed,
  });

  log(
    `Using Defender Relayer account ${await signer.getAddress()} with key ${apiKey} and speed ${speed}`
  );
  return signer;
};

module.exports = {
  getDefenderSigner,
};
