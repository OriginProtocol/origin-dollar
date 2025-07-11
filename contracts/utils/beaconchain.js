const fetch = require("node-fetch");
const API_URL = "https://beaconcha.in/api/v1/";
const log = require("./logger")("task:p2p");

const beaconchainRequest = async (endpoint) => {
  const apikey = process.env.BEACONCHAIN_API_KEY;
  const url = `${API_URL}${endpoint}`;
  if (!apikey) {
    throw new Error(
      "Set BEACONCHAIN_API_KEY in order to be able to query the API"
    );
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey,
  };

  log(`About to call Beaconcha.in API: ${url} `);

  const rawResponse = await fetch(url, {
    method: "GET",
    headers,
  });

  const response = await rawResponse.json();
  if (response.status != "OK") {
    log(`Call to Beaconcha.in API failed: ${url}`);
    log(`response: `, response);
    throw new Error(
      `Call to Beaconcha.in API failed. Error: ${JSON.stringify(
        response.status
      )}`
    );
  } else {
    log(`GET request to Beaconcha.in API succeeded. Response: `, response);
  }

  return response.data;
};

const getValidator = async (pubkey) => {
  return await beaconchainRequest(`validator/${pubkey}`);
};

const getValidators = async (pubkeys, beaconChainApiKey) => {
  const encodedPubkeys = encodeURIComponent(pubkeys);
  return await beaconchainRequest(
    `validator/${encodedPubkeys}`,
    beaconChainApiKey
  );
};

const getEpoch = async (epochId = "latest") => {
  return await beaconchainRequest(`epoch/${epochId}`);
};

module.exports = {
  getValidator,
  getValidators,
  getEpoch,
};
