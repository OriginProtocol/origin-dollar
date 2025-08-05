const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const { getNetworkName } = require("./hardhat-helpers");
const log = require("./logger")("task:validator:compounding");

P2P_URL_MAINNET = "https://api.p2p.org";
P2P_URL_HOODI = "https://api-test.p2p.org";
INITIAL_DEPOSIT_SIZE = "32000000000"; // 32 ETH

const _p2pRequest = async (uri, method, body) => {
  const networkName = await getNetworkName();
  let baseUrl, api_key;

  if (networkName == "mainnet") {
    baseUrl = P2P_URL_MAINNET;
    api_key = process.env.P2P_MAINNET_API_KEY;
  } else if (networkName == "hoodi") {
    baseUrl = P2P_URL_HOODI;
    api_key = process.env.P2P_HOODIE_API_KEY;
  } else {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const url = `${baseUrl}${uri}`;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${api_key}`,
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const bodyString = JSON.stringify(body);
  log(
    `About to call P2P API: ${method} ${url} `,
    body != undefined ? ` and body: ${bodyString}` : ""
  );

  const rawResponse = await fetch(url, {
    method,
    headers,
    body: bodyString,
  });

  const response = await rawResponse.json();
  if (response.error != null) {
    log(`Call to P2P API failed: ${method} ${url}`);
    throw new Error(
      `Failed to call to P2P API. Error: ${JSON.stringify(response.error)}`
    );
  } else {
    log(`${method} request to P2P API succeeded:`);
  }

  return response;
};

const _getStakingContract = async () => {
  return await ethers.getContract("CompoundingStakingSSVStrategy");
};

const getValidatorRequestStatus = async ({ uuid }) => {
  log(`Fetching the p2p status of SSV validator create request: ${uuid}`);

  const response = await _p2pRequest(
    `/api/v1/eth/staking/ssv/request/status/${uuid}`,
    "GET"
  );

  if (response.result.status == "processing") {
    throw new Error("The create request is still processing");
  } else if (response.result.status != "ready") {
    log(`Response`, response);
    throw new Error(`Unexpected request status: ${response.result.status}`);
  }

  const validatorShare = response.result.encryptedShares[0];
  const operators = response.result.clusters[0].operators;
  return {
    pubkey: validatorShare.publicKey,
    shares: validatorShare.sharesData,
    operatorids: operators.join(","),
  };
};

const createValidatorRequest = async ({
  validatorSpawnOperationalPeriodInDays,
}) => {
  const uuid = uuidv4();
  log(`About to create a SSV validator request with uuid: ${uuid}`);

  const stakingContractAddress = (await _getStakingContract()).address;
  await _p2pRequest("/api/v1/eth/staking/ssv/request/create", "POST", {
    id: uuid,
    validatorsCount: 1,
    amountPerValidator: INITIAL_DEPOSIT_SIZE,
    withdrawalCredentialsType: "0x02",
    withdrawalAddress: stakingContractAddress,
    feeRecipientAddress: stakingContractAddress,
    ssvOwnerAddress: stakingContractAddress,
    type: "without-encrypt-key",
    operationPeriodInDays: validatorSpawnOperationalPeriodInDays,
    //ecdhPublicKey: "",
  });

  console.log(`Validator request created uuid: ${uuid}`);
};

module.exports = {
  createValidatorRequest,
  getValidatorRequestStatus,
};
