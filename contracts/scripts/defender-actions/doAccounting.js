const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const {
  address: mainnetConsolidationControllerAddress,
  abi: consolidationControllerAbi,
} = require("../../deployments/mainnet/ConsolidationController.json");
const {
  address: hoodiConsolidationControllerAddress,
} = require("../../deployments/hoodi/ConsolidationController.json");

const log = require("../../utils/logger")("action:doAccounting");

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

  const network = await provider.getNetwork();
  const networkName =
    network.chainId === 1
      ? "mainnet"
      : network.chainId === 560048
      ? "hoodi"
      : undefined;
  if (!networkName) {
    throw new Error(
      `Action only supports mainnet and hoodi, not chainId ${network.chainId}`
    );
  }
  log(`Network: ${networkName} with chain id (${network.chainId})`);

  const consolidationControllerAddress =
    networkName === "mainnet"
      ? mainnetConsolidationControllerAddress
      : hoodiConsolidationControllerAddress;
  log(
    `Resolved ConsolidationController address to ${consolidationControllerAddress}`
  );
  const consolidationController = new ethers.Contract(
    consolidationControllerAddress,
    consolidationControllerAbi,
    signer
  );

  await doAccounting(
    "NativeStakingSSVStrategy2Proxy",
    networkName,
    signer,
    consolidationController
  );
  await doAccounting(
    "NativeStakingSSVStrategy3Proxy",
    networkName,
    signer,
    consolidationController
  );
};

const doAccounting = async (
  proxyName,
  networkName,
  signer,
  consolidationController
) => {
  const nativeStakingProxyAddress = addresses[networkName][proxyName];
  if (!nativeStakingProxyAddress) {
    throw new Error(
      `Failed to resolve ${proxyName} on the ${networkName} network`
    );
  }
  log(`Resolved ${proxyName} address to ${nativeStakingProxyAddress}`);

  const tx = await consolidationController
    .connect(signer)
    .doAccounting(nativeStakingProxyAddress);
  await logTxDetails(tx, `doAccounting for ${proxyName} via controller`);
};

module.exports = { handler };
