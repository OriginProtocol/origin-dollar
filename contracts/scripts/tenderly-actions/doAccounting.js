const { ethers } = require("ethers");
const { Wallet } = require("ethers");
const { Network } = require('@tenderly/actions');
const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");

const log = require("../../utils/logger")("action:doAccounting");

// Entrypoint for the Tenderly Action - do not change the function name
const actionFn = async (context, periodicEvent) => {
  // To access project's storage
  // let value = await context.storage.getStr('MY-KEY')
  // await context.storage.putStr('MY-KEY', 'MY-VALUE')
  console.log("Network.MAINNET", Network.MAINNET);
  const defaultGatewayURL = context.gateways.getGateway(Network.MAINNET);
  console.log("defaultGatewayURL", defaultGatewayURL);
  console.log(periodicEvent);

  // const provider = new ethers.providers.JsonRpcProvider(
  //   defaultGatewayURL
  // );

  // // const secret = await context.secrets.get('ACTION_PK')
  // // const wallet = new Wallet(secret, provider);


  // console.log(
  //   `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  // );

  // // Initialize defender relayer provider and signer
  // let signer

  // const network = await provider.getNetwork();
  // const networkName = network.chainId === 1 ? "mainnet" : "holesky";
  // console.log(`Network: ${networkName} with chain id (${network.chainId})`);
  // log(`Network: ${networkName} with chain id (${network.chainId})`);

  // // await doAccounting("NativeStakingSSVStrategyProxy", networkName, signer);
  // await doAccounting("NativeStakingSSVStrategy2Proxy", networkName, signer);
  // //await doAccounting("NativeStakingSSVStrategy3Proxy", networkName, signer);
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

module.exports = { actionFn };
