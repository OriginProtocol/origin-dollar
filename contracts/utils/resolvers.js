const addresses = require("./addresses");
const { ethereumAddress } = require("./regex");
const { getNetworkName } = require("../tasks/lib/network");
const { getContract, getContractAt } = require("../tasks/lib/contracts");

const log = require("./logger")("task:assets");

/**
 * Resolves a token symbol to a ERC20 token contract.
 * This relies on Hardhat so can't be used for Defender Actions.
 * @param {string} symbol token symbol of the asset. eg OUSD, USDT, stETH, CRV...
 */
const resolveAsset = async (symbol) => {
  const networkName = await getNetworkName();

  // If not a unit test or task running against the hardhat network
  if (networkName != "hardhat") {
    const assetAddr =
      addresses[networkName][symbol + "Proxy"] ||
      addresses[networkName][symbol];
    if (!assetAddr) {
      throw Error(
        `Failed to resolve symbol "${symbol}" to an address on the "${networkName}" network`
      );
    }
    log(`Resolved ${symbol} to ${assetAddr} on the ${networkName} network`);
    const asset = await getContractAt("IERC20Metadata", assetAddr);
    return asset;
  }
  const asset = await getContract("Mock" + symbol);
  if (!asset) {
    throw Error(`Failed to resolve symbol "${symbol}" to a mock contract`);
  }
  return asset;
};

/**
 * Returns a contract instance.
 * This relies on Hardhat so can't be used for Defender Actions.
 * @param {string} proxy Address or name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper
 * @param {string} [abiName=proxy] ABI name. Will default to proxy is not used. eg VaultAdmin, VaultCore, Governable or IERC20Metadata
 * @returns
 */
const resolveContract = async (proxy, abiName) => {
  const networkName = await getNetworkName();

  // If proxy is an address
  if (proxy.match(ethereumAddress)) {
    if (!abiName) {
      throw Error(`Must pass an ABI name if the proxy is an address`);
    }
    const contract = await getContractAt(abiName, proxy);
    if (!contract) {
      throw Error(`Failed find ABI for "${abiName}"`);
    }
    return contract;
  }

  const proxyContract = await getContract(proxy);
  if (!proxyContract) {
    throw Error(`Failed find proxy "${proxy}" on the ${networkName} network`);
  }
  log(
    `Resolved proxy ${proxy} on the ${networkName} network to ${proxyContract.address}`
  );

  if (abiName) {
    const contract = await getContractAt(abiName, proxyContract.address);
    if (!contract) {
      throw Error(`Failed find ABI for "${abiName}"`);
    }
    return contract;
  }

  return proxyContract;
};

module.exports = {
  resolveAsset,
  resolveContract,
};
