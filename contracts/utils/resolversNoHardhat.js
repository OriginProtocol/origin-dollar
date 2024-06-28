/* this file contains the resolvers without importing hardhat. We need
 * this version of clean import file, so that build size of the defender
 * action remains small
 */
const { ethereumAddress } = require("./regex");
const { networkMap } = require("./hardhat-helpers");

const log = require("./logger")("task:assets");

/**
 * Returns a contract instance.
 * @param {string} proxy Address or name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper
 * @param {string} [abiName=proxy] ABI name. Will default to proxy is not used. eg VaultAdmin, VaultCore, Governable or IERC20Metadata
 * @returns
 */
const resolveContract = async (proxy, abiName) => {
  const { chainId } = await ethers.getDefaultProvider().getNetwork();
  const networkName = networkMap[chainId];

  // If proxy is an address
  if (proxy.match(ethereumAddress)) {
    if (!abiName) {
      throw Error(`Must pass an ABI name if the proxy is an address`);
    }
    const contract = await ethers.getContractAt(abiName, proxy);
    if (!contract) {
      throw Error(`Failed find ABI for "${abiName}"`);
    }
    return contract;
  }

  const proxyContract = await ethers.getContract(proxy);
  if (!proxyContract) {
    throw Error(`Failed find proxy "${proxy}" on the ${networkName} network`);
  }
  log(
    `Resolved proxy ${proxy} on the ${networkName} network to ${proxyContract.address}`
  );

  if (abiName) {
    const contract = await ethers.getContractAt(abiName, proxyContract.address);
    if (!contract) {
      throw Error(`Failed find ABI for "${abiName}"`);
    }
    return contract;
  }

  return proxyContract;
};

module.exports = {
  resolveContract,
};
