const { parseUnits, formatUnits } = require("ethers/lib/utils");
const { ClusterScanner, NonceScanner } = require("ssv-scanner");

const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:ssv");

const printClusterInfo = async (options) => {
  const cluster = await getClusterInfo(options);
  const nextNonce = await getClusterNonce(options);
  console.log(`block ${cluster.block}`);
  console.log(`Cluster: ${JSON.stringify(cluster.snapshot, null, "  ")}`);
  console.log("Next Nonce:", nextNonce);
};

const getClusterInfo = async ({
  ownerAddress,
  operatorids,
  chainId,
  ssvNetwork,
}) => {
  const operatorIds = operatorids.split(".").map((id) => parseInt(id));

  const ssvNetworkName = chainId === 1 ? "MAINNET" : "PRATER";
  const providerUrl =
    chainId === 1 ? process.env.PROVIDER_URL : process.env.HOLESKY_PROVIDER_URL;

  const params = {
    nodeUrl: providerUrl, // this can be an Infura, or Alchemy node, necessary to query the blockchain
    contractAddress: ssvNetwork, // this is the address of SSV smart contract
    ownerAddress, // this is the wallet address of the cluster owner
    /* Based on the network they fetch contract ABIs. See code: https://github.com/bloxapp/ssv-scanner/blob/v1.0.3/src/lib/contract.provider.ts#L16-L22
     * and the ABIs are fetched from here: https://github.com/bloxapp/ssv-scanner/tree/v1.0.3/src/shared/abi
     *
     * Prater seems to work for Goerli at the moment
     */
    network: ssvNetworkName,
    operatorIds: operatorIds, // this is a list of operator IDs chosen by the owner for their cluster
  };

  // ClusterScanner is initialized with the given parameters
  const clusterScanner = new ClusterScanner(params);
  // and when run, it returns the Cluster Snapshot
  const result = await clusterScanner.run(params.operatorIds);
  const cluster = {
    block: result.payload.Block,
    snapshot: result.cluster,
    cluster: Object.values(result.cluster),
  };
  log(`Cluster info ${JSON.stringify(cluster)}`);
  return cluster;
};

const getClusterNonce = async ({
  ownerAddress,
  operatorids,
  chainId,
  ssvNetwork,
}) => {
  const operatorIds = operatorids.split(".").map((id) => parseInt(id));

  const ssvNetworkName = chainId === 1 ? "MAINNET" : "PRATER";
  const providerUrl =
    chainId === 1 ? process.env.PROVIDER_URL : process.env.HOLESKY_PROVIDER_URL;

  const params = {
    nodeUrl: providerUrl, // this can be an Infura, or Alchemy node, necessary to query the blockchain
    contractAddress: ssvNetwork, // this is the address of SSV smart contract
    ownerAddress, // this is the wallet address of the cluster owner
    /* Based on the network they fetch contract ABIs. See code: https://github.com/bloxapp/ssv-scanner/blob/v1.0.3/src/lib/contract.provider.ts#L16-L22
     * and the ABIs are fetched from here: https://github.com/bloxapp/ssv-scanner/tree/v1.0.3/src/shared/abi
     *
     * Prater seems to work for Goerli at the moment
     */
    network: ssvNetworkName,
    operatorIds: operatorIds, // this is a list of operator IDs chosen by the owner for their cluster
  };

  const nonceScanner = new NonceScanner(params);
  const nextNonce = await nonceScanner.run();
  return nextNonce;
};

const depositSSV = async ({ amount, operatorids }, hre) => {
  const amountBN = parseUnits(amount.toString(), 18);
  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(".").map((id) => parseInt(id));

  const signer = await getSigner();

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );
  const ssvNetworkAddress = addresses[hre.network.name].SSVNetwork;
  const ssvNetwork = await resolveContract(ssvNetworkAddress, "ISSVNetwork");

  // Cluster details
  const clusterInfo = await getClusterInfo({
    chainId: hre.network.config.chainId,
    ssvNetwork: ssvNetwork.address,
    operatorIds,
    ownerAddress: strategy.address,
  });

  log(
    `About to deposit ${formatUnits(
      amountBN
    )} SSV tokens to the SSV Network for native staking strategy ${
      strategy.address
    } with operator IDs ${operatorIds}`
  );
  log(`Cluster: ${JSON.stringify(clusterInfo.snapshot)}`);
  const tx = await strategy
    .connect(signer)
    .depositSSV(operatorIds, amountBN, clusterInfo.cluster);
  await logTxDetails(tx, "depositSSV");
};

module.exports = {
  printClusterInfo,
  getClusterInfo,
  depositSSV,
};
