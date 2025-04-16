const fetch = require("sync-fetch");
require("dotenv").config();

const isFork = process.env.FORK === "true";
const isArbitrum = process.env.NETWORK_NAME === "arbitrumOne";
const isArbitrumFork = process.env.FORK_NETWORK_NAME === "arbitrumOne";
const isHoleskyFork = process.env.FORK_NETWORK_NAME === "holesky";
const isHolesky = process.env.NETWORK_NAME === "holesky";
const isBase = process.env.NETWORK_NAME === "base";
const isBaseFork = process.env.FORK_NETWORK_NAME === "base";
const isSonic = process.env.NETWORK_NAME === "sonic";
const isSonicFork = process.env.FORK_NETWORK_NAME === "sonic";

const isPlume = process.env.NETWORK_NAME === "plume";
const isPlumeFork = process.env.FORK_NETWORK_NAME === "plume";

const isForkTest = isFork && process.env.IS_TEST === "true";
const isArbForkTest = isForkTest && isArbitrumFork;
const isHoleskyForkTest = isForkTest && isHoleskyFork;
const isBaseForkTest = isForkTest && isBaseFork;
const isBaseUnitTest = process.env.UNIT_TESTS_NETWORK === "base";
const isSonicForkTest = isForkTest && isSonicFork;
const isSonicUnitTest = process.env.UNIT_TESTS_NETWORK === "sonic";
const isPlumeForkTest = isForkTest && isPlumeFork;
const isPlumeUnitTest = process.env.UNIT_TESTS_NETWORK === "plume";

const providerUrl = `${
  process.env.LOCAL_PROVIDER_URL || process.env.PROVIDER_URL
}`;
const arbitrumProviderUrl = `${process.env.ARBITRUM_PROVIDER_URL}`;
const holeskyProviderUrl = `${process.env.HOLESKY_PROVIDER_URL}`;
const baseProviderUrl = `${process.env.BASE_PROVIDER_URL}`;
const sonicProviderUrl = `${process.env.SONIC_PROVIDER_URL}`;
const plumeProviderUrl = `${process.env.PLUME_PROVIDER_URL}`;
const standaloneLocalNodeRunning = !!process.env.LOCAL_PROVIDER_URL;

/**
 * - Reads the fork block number from environmental variables depending on the context of the run
 * - In case a local node is running (and it could have deployments executed) the updated block number is queried
 *   from the node and that one is used.
 * - Local node is forwarded by 40 blocks
 */
const adjustTheForkBlockNumber = () => {
  let forkBlockNumber = undefined;

  if (isForkTest) {
    if (isArbForkTest) {
      forkBlockNumber = process.env.ARBITRUM_BLOCK_NUMBER
        ? Number(process.env.ARBITRUM_BLOCK_NUMBER)
        : undefined;
    } else if (isHoleskyForkTest) {
      forkBlockNumber = process.env.HOLESKY_BLOCK_NUMBER
        ? Number(process.env.HOLESKY_BLOCK_NUMBER)
        : undefined;
    } else if (isBaseForkTest) {
      forkBlockNumber = process.env.BASE_BLOCK_NUMBER
        ? process.env.BASE_BLOCK_NUMBER
        : undefined;
    } else if (isSonicForkTest) {
      forkBlockNumber = process.env.SONIC_BLOCK_NUMBER
        ? process.env.SONIC_BLOCK_NUMBER
        : undefined;
    } else if (isPlumeForkTest) {
      forkBlockNumber = process.env.PLUME_BLOCK_NUMBER
        ? process.env.PLUME_BLOCK_NUMBER
        : undefined;
    } else {
      forkBlockNumber = process.env.BLOCK_NUMBER
        ? Number(process.env.BLOCK_NUMBER)
        : undefined;
    }
  }

  if (isForkTest && standaloneLocalNodeRunning) {
    const jsonResponse = fetch(providerUrl, {
      method: "post",
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        id: 1,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }).json();

    /*
     * We source the block number from the hardhat context rather than from
     * node-test.sh startup script, so that block number from an already
     * running local node can be fetched after the deployments have already
     * been applied.
     *
     */
    forkBlockNumber = parseInt(jsonResponse.result, 16);

    console.log(`Connecting to local node on block: ${forkBlockNumber}`);

    // Mine 40 blocks so hardhat wont complain about block fork being too recent
    // On Holesky running this causes repeated tests connecting to a local node
    // to fail
    if (!isHoleskyFork && !isHolesky) {
      fetch(providerUrl, {
        method: "post",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "hardhat_mine",
          params: ["0x28"], // 40
          id: 1,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }).json();
    }
  } else if (isForkTest) {
    console.log(`Starting a fresh node on block: ${forkBlockNumber}`);
  }

  return forkBlockNumber;
};

// returns hardhat network chainId and provider
const getHardhatNetworkProperties = () => {
  let chainId = 1337;
  if (isArbitrumFork && isFork) {
    chainId = 42161;
  } else if (isHoleskyFork && isFork) {
    chainId = 17000;
  } else if (isBaseFork && isFork) {
    chainId = 8453;
  } else if (isSonicFork && isFork) {
    chainId = 146;
  } else if (isPlumeFork && isFork) {
    // TODO: Plume Network ID
    chainId = 98866;
  } else if (isFork) {
    // is mainnet fork
    chainId = 1;
  }

  let provider = providerUrl;
  if (!providerUrl.includes("localhost")) {
    if (isArbForkTest) {
      provider = arbitrumProviderUrl;
    } else if (isHoleskyForkTest) {
      provider = holeskyProviderUrl;
    } else if (isBaseForkTest) {
      provider = baseProviderUrl;
    } else if (isSonicForkTest) {
      provider = sonicProviderUrl;
    } else if (isPlumeForkTest) {
      provider = plumeProviderUrl;
    }
  }

  return { chainId, provider };
};

const networkMap = {
  1: "mainnet",
  17000: "holesky",
  42161: "arbitrumOne",
  1337: "hardhat",
  8453: "base",
  146: "sonic",
  98866: "plume",
};

module.exports = {
  isFork,
  isArbitrum,
  isArbitrumFork,
  isBase,
  isBaseFork,
  isBaseForkTest,
  isBaseUnitTest,
  isSonic,
  isSonicFork,
  isSonicForkTest,
  isSonicUnitTest,
  isHoleskyFork,
  isHolesky,
  isForkTest,
  isArbForkTest,
  isHoleskyForkTest,
  isPlume,
  isPlumeFork,
  isPlumeForkTest,
  isPlumeUnitTest,

  providerUrl,
  arbitrumProviderUrl,
  holeskyProviderUrl,
  baseProviderUrl,
  sonicProviderUrl,
  plumeProviderUrl,

  adjustTheForkBlockNumber,
  getHardhatNetworkProperties,
  networkMap,
};
