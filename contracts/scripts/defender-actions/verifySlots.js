const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");

const { verifySlot } = require("../../tasks/beacon");
const addresses = require("../../utils/addresses");

const beaconOracleAbi = require("../../abi/beaconOracle.json");
const { getNetworkName } = require("../../utils/hardhat-helpers");

const log = require("../../utils/logger")("action:verifySlots");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  const networkName = await getNetworkName(provider);
  const beaconOracleAddress = addresses[networkName].beaconOracle;
  log(`Resolved Beacon Oracle address to ${beaconOracleAddress}`);

  const oracle = new ethers.Contract(
    beaconOracleAddress,
    beaconOracleAbi,
    signer
  );

  await verifySlot({
    signer,
    oracle,
  });
};

module.exports = { handler };
