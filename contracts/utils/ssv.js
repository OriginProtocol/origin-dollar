const { parseUnits, formatUnits } = require("ethers/lib/utils");
const { ClusterScanner, NonceScanner } = require("ssv-scanner");
const { SSVKeys, KeyShares, KeySharesItem } = require("ssv-keys");
const path = require("path");
const fsp = require("fs").promises;

const { isForkWithLocalNode } = require("../test/helpers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("utils:ssv");

const depositSSV = async (options) => {
  const { signer, chainId, nodeDelegator, ssvNetwork, amount, operatorIds } =
    options;
  const amountBN = parseUnits(amount.toString(), 18);

  // Cluster details
  const clusterInfo = await getClusterInfo({
    chainId,
    ssvNetwork,
    operatorIds,
    ownerAddress: nodeDelegator.address,
  });

  log(
    `About to deposit ${formatUnits(
      amountBN
    )} SSV tokens to the SSV Network for NodeDelegator ${
      nodeDelegator.address
    } with operator IDs ${operatorIds}`
  );
  log(`Cluster: ${JSON.stringify(clusterInfo.snapshot)}`);
  const tx = await nodeDelegator
    .connect(signer)
    .depositSSV(operatorIds, amountBN, clusterInfo.cluster);
  await logTxDetails(tx, "depositSSV");
};

const splitValidatorKey = async ({
  keystorelocation,
  keystorepass,
  operatorIds,
  operatorkeys,
  ownerAddress,
  chainId,
  ssvNetwork,
}) => {
  const operatorKeys = operatorkeys.split(".");
  const keystoreLocation = path.join(__dirname, "..", "..", keystorelocation);
  const nextNonce = await getClusterNonce({
    ownerAddress,
    operatorIds,
    chainId,
    ssvNetwork,
  });

  log(`Reading keystore location: ${keystoreLocation}`);
  log(`For operatorIds: ${operatorIds}`);
  log(
    `Next SSV register validator nonce for owner ${ownerAddress}: ${nextNonce}`
  );
  // TODO: 30+ start and end character of operators are the same. how to represent this?
  log(
    "Operator keys: ",
    operatorKeys.map((key) => `${key.slice(0, 10)}...${key.slice(-10)}`)
  );

  const keystoreJson = require(keystoreLocation);

  // 1. Initialize SSVKeys SDK and read the keystore file
  const ssvKeys = new SSVKeys();
  const { publicKey, privateKey } = await ssvKeys.extractKeys(
    keystoreJson,
    keystorepass
  );

  const operators = operatorKeys.map((operatorKey, index) => ({
    id: operatorIds[index],
    operatorKey,
  }));

  // 2. Build shares from operator IDs and public keys
  const encryptedShares = await ssvKeys.buildShares(privateKey, operators);
  const keySharesItem = new KeySharesItem();
  await keySharesItem.update({ operators });
  await keySharesItem.update({
    ownerAddress: ownerAddress,
    ownerNonce: nextNonce,
    publicKey,
  });

  // 3. Build final web3 transaction payload and update keyshares file with payload data
  await keySharesItem.buildPayload(
    {
      publicKey,
      operators,
      encryptedShares,
    },
    {
      ownerAddress: ownerAddress,
      ownerNonce: nextNonce,
      privateKey,
    }
  );

  const keyShares = new KeyShares();
  keyShares.add(keySharesItem);

  const keystoreFilePath = path.join(
    __dirname,
    "..",
    "..",
    "validator_key_data",
    "keyshares_data",
    `${publicKey.slice(0, 10)}_keyshares.json`
  );
  log(`Saving distributed validator shares_data into: ${keystoreFilePath}`);
  await fsp.writeFile(keystoreFilePath, keyShares.toJson(), {
    encoding: "utf-8",
  });
};

const getClusterInfo = async ({
  ownerAddress,
  operatorIds,
  chainId,
  ssvNetwork,
}) => {
  const ssvNetworkName = chainId === 1 ? "MAINNET" : "HOLESKY";
  log(`SSV network: ${ssvNetworkName}`);
  const providerUrl = isForkWithLocalNode
    ? "http://localhost:8545/"
    : process.env.PROVIDER_URL;
  log(`Provider URL: ${providerUrl}`);

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
    operatorIds, // this is a list of operator IDs chosen by the owner for their cluster
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
  operatorIds,
  chainId,
  ssvNetwork,
}) => {
  const ssvNetworkName = chainId === 1 ? "MAINNET" : "HOLESKY";
  const providerUrl = process.env.PROVIDER_URL;

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
    operatorIds, // this is a list of operator IDs chosen by the owner for their cluster
  };

  const nonceScanner = new NonceScanner(params);
  const nextNonce = await nonceScanner.run();
  return nextNonce;
};

const printClusterInfo = async (options) => {
  const cluster = await getClusterInfo(options);
  const nextNonce = await getClusterNonce(options);
  console.log(`block ${cluster.block}`);
  console.log(`Cluster: ${JSON.stringify(cluster.snapshot, null, "  ")}`);
  console.log("Next Nonce:", nextNonce);
};

module.exports = {
  depositSSV,
  printClusterInfo,
  getClusterInfo,
  splitValidatorKey,
};
