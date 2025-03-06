const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");

const poolBoosterSwapXAbi = require("../../abi/poolBoosterSwapX.json");
const poolBoosterCentralRegistryAbi = require("../../abi/poolBoosterCentralRegistry.json");
const { logTxDetails } = require("../../utils/txLogger");
const log = require("../../utils/logger")("action:harvest");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  const poolBoosterCentralRegistryProxyAddress =
    "0x4F3B656Aa5Fb5E708bF7B63D6ff71623eb4a218A";
  const poolBoosterCentralRegistryProxy = new ethers.Contract(
    poolBoosterCentralRegistryProxyAddress,
    poolBoosterCentralRegistryAbi,
    signer
  );

  // Fetch all factories
  const factories = await poolBoosterCentralRegistryProxy.getAllFactories();
  log(`Factories: ${factories}`);

  for (const f of factories) {
    const factory = new ethers.Contract(f, poolBoosterSwapXAbi, signer);
    const tx = await factory.connect(signer).bribeAll([]);
    await logTxDetails(tx, `Bribed all pools in factory ${f}`);
  }
};

module.exports = { handler };
