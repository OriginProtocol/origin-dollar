const { NonceScanner } = require("ssv-scanner");
const { SSVKeys, KeyShares, KeySharesItem } = require("ssv-keys");
const path = require("path");
const fsp = require("fs").promises;
const axios = require("axios");

const log = require("../utils/logger")("utils:ssv");

const SSV_API_ENDPOINT = "https://api.ssv.network/api/v4";
const emptyCluster = {
  validatorCount: 0,
  networkFeeIndex: 0,
  index: 0,
  active: true,
  balance: 0,
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

const getClusterInfo = async ({ ownerAddress, operatorids, chainId }) => {
  // HTTP encode the operator IDs
  // the .toString() will convert the array to a comma-separated string if not already a string
  const encodedOperatorIds = encodeURIComponent(operatorids.toString());
  const network = chainId === 1 ? "mainnet" : "hoodi";
  const url = `${SSV_API_ENDPOINT}/${network}/clusters/owner/${ownerAddress}/operators/${encodedOperatorIds}`;
  log(`SSV url: ${url}`);

  try {
    // Call the SSV API to get the Cluster data
    const response = await axios.get(url);

    if (!response.data) {
      console.error(response.data);
      throw Error("response is missing data");
    }

    if (response.data.cluster === null) {
      log(
        `Cluster not found for network ${network}, owner ${ownerAddress} and operators ${operatorids}`
      );
      return {
        block: 0,
        cluster: emptyCluster,
      };
    }

    log("Cluster data from SSV API: ", JSON.stringify(response.data.cluster));

    return {
      block: response.data.cluster.blockNumber,
      cluster: response.data.cluster,
    };
  } catch (err) {
    if (err.response) {
      console.error("Response data  : ", err.response.data);
      console.error("Response status: ", err.response.status);
    }
    throw Error(`Call to SSV API failed: ${err.message}`);
  }
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
  const info = await getClusterInfo(options);
  const nextNonce = await getClusterNonce(options);
  console.log(`block ${info.block}`);
  console.log(`Cluster: ${JSON.stringify(info.cluster, null, "  ")}`);
  console.log("Next Nonce:", nextNonce);
};

module.exports = {
  printClusterInfo,
  getClusterInfo,
  getClusterNonce,
  splitValidatorKey,
};
