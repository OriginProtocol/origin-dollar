const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");

const { updateVotemarketEpochs } = require("../../tasks/votemarket");

const log = require("../../utils/logger")("action:updateVotemarketEpochs");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer (Arbitrum relayer)
  const client = new Defender(event);
  const arbitrumProvider = client.relaySigner.getProvider({
    ethersVersion: "v5",
  });
  const { chainId } = await arbitrumProvider.getNetwork();

  if (chainId !== 42161) {
    throw new Error(
      `Defender relayer must be on Arbitrum (42161), got chainId ${chainId}`
    );
  }

  const arbitrumSigner = await client.relaySigner.getSigner(arbitrumProvider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  // Create read-only Mainnet provider
  if (!event.secrets.PROVIDER_URL) {
    throw new Error("PROVIDER_URL secret required for Mainnet connection");
  }
  const mainnetProvider = new ethers.providers.JsonRpcProvider(
    event.secrets.PROVIDER_URL
  );

  const dryRun = event.request?.body?.dryRun ?? false;

  log(`Starting updateVotemarketEpochs, dryRun=${dryRun}`);

  await updateVotemarketEpochs({
    mainnetProvider,
    arbitrumProvider,
    arbitrumSigner,
    dryRun,
  });
};

module.exports = { handler };
