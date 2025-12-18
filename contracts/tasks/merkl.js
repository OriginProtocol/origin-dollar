const axios = require("axios");
const { formatUnits } = require("ethers/lib/utils");

const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:merkl");

const MERKL_API_ENDPOINT = "https://api.merkl.xyz/v4";

const getMerklRewards = async ({ userAddress, chainId = 1 }) => {
  const url = `${MERKL_API_ENDPOINT}/users/${userAddress}/rewards?chainId=${chainId}`;
  try {
    log(`Getting Merkl rewards data from ${url}`);

    const response = await axios.get(url);

    if (response.data.length === 0 || response.data[0].rewards.length === 0) {
      return {
        amount: 0n,
        token: null,
        proofs: [],
      };
    }

    return {
      amount: response.data[0].rewards[0].amount,
      token: response.data[0].rewards[0].token.address,
      proofs: response.data[0].rewards[0].proofs,
    };
  } catch (err) {
    if (err.response) {
      console.error("Response data  : ", err.response.data);
      console.error("Response status: ", err.response.status);
      console.error("Response status: ", err.response.statusText);
    }
    throw Error(`Call to Merkl API failed: ${err.message}`);
  }
};

async function claimMerklRewards(strategyAddress, signer) {
  const result = await getMerklRewards({
    userAddress: strategyAddress,
    chainId: 1,
  });

  log(
    `${formatUnits(result.amount, 18)} ${
      result.token
    } rewards available to claim.`
  );

  const strategy = await ethers.getContractAt(
    "Generalized4626Strategy",
    strategyAddress,
    signer
  );

  const tx = await strategy.merkleClaim(
    result.token,
    result.amount,
    result.proofs
  );
  await logTxDetails(tx, "merkleClaim");
}

module.exports = { claimMerklRewards, getMerklRewards };
