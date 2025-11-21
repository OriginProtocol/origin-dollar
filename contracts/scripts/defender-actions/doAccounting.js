const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");

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
  const networkName = network.chainId === 1 ? "mainnet" : "holesky";
  log(`Network: ${networkName} with chain id (${network.chainId})`);

  // await doAccounting("NativeStakingSSVStrategyProxy", networkName, signer);
  await doAccounting("NativeStakingSSVStrategy2Proxy", networkName, signer);
  await doAccounting("NativeStakingSSVStrategy3Proxy", networkName, signer);
};

const doAccounting = async (proxyName, networkName, signer) => {
  const nativeStakingProxyAddress = addresses[networkName][proxyName];
  log(`Resolved ${proxyName} address to ${nativeStakingProxyAddress}`);

  const nativeStakingStrategy = new ethers.Contract(
    nativeStakingProxyAddress,
    nativeStakingStrategyAbi,
    signer
  );

  const tx = await nativeStakingStrategy.connect(signer).doAccounting();
  await logTxDetails(tx, `doAccounting for ${proxyName}`);
};

module.exports = { handler };
