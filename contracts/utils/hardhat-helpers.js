require("dotenv").config();

const isFork = process.env.FORK === "true";
const isArbitrumFork = process.env.FORK_NETWORK_NAME === "arbitrumOne";
const isBaseFork = process.env.FORK_NETWORK_NAME === "base";
const isSonicFork = process.env.FORK_NETWORK_NAME === "sonic";
const isPlumeFork = process.env.FORK_NETWORK_NAME === "plume";
const isHoodiFork = process.env.FORK_NETWORK_NAME === "hoodi";
const isHyperEVMFork = process.env.FORK_NETWORK_NAME === "hyperevm";

const arbitrumProviderUrl = `${process.env.ARBITRUM_PROVIDER_URL}`;
const baseProviderUrl = `${process.env.BASE_PROVIDER_URL}`;
const sonicProviderUrl = `${process.env.SONIC_PROVIDER_URL}`;
const plumeProviderUrl = `${process.env.PLUME_PROVIDER_URL}`;
const hoodiProviderUrl = `${process.env.HOODI_PROVIDER_URL}`;
const hyperEVMProviderUrl = `${process.env.HYPEREVM_PROVIDER_URL}`;

// Returns the chain ID used by the in-process Hardhat network.
const getHardhatNetworkChainId = () => {
  let chainId = 1337;
  if (isArbitrumFork && isFork) {
    chainId = 42161;
  } else if (isBaseFork && isFork) {
    chainId = 8453;
  } else if (isSonicFork && isFork) {
    chainId = 146;
  } else if (isPlumeFork && isFork) {
    chainId = 98866;
  } else if (isHoodiFork && isFork) {
    chainId = 560048;
  } else if (isHyperEVMFork && isFork) {
    chainId = 999;
  } else if (isFork) {
    // is mainnet fork
    chainId = 1;
  }

  return chainId;
};

const networkMap = {
  1: "mainnet",
  42161: "arbitrumOne",
  1337: "hardhat",
  8453: "base",
  146: "sonic",
  98866: "plume",
  560048: "hoodi",
  999: "hyperevm",
};

/**
 * Returns the network name based on the chain ID of the connected network.
 * @param {ethers.Provider} [provider] - Optional ethers provider. Defaults to the Hardhat provider if not supplied.
 * The provider is required by standalone automation code that does not load Hardhat.
 * @returns {Promise<string>} The network name. e.g. `mainnet`, `sonic`, `base`
 */
const getNetworkName = async (provider) => {
  // use the provider if passed, otherwise use the Hardhat provider
  const localProvider = provider ?? hre.ethers.provider;
  const { chainId } = await localProvider.getNetwork();
  const network = networkMap[chainId];
  if (!network) {
    throw Error(`Failed to resolve network with chain Id "${chainId}"`);
  }

  return network;
};

module.exports = {
  isBaseFork,
  getNetworkName,
  isSonicFork,
  isPlumeFork,
  isHoodiFork,
  isHyperEVMFork,
  arbitrumProviderUrl,
  baseProviderUrl,
  sonicProviderUrl,
  plumeProviderUrl,
  hoodiProviderUrl,
  hyperEVMProviderUrl,
  getHardhatNetworkChainId,
};
