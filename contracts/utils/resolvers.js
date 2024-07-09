const addresses = require("./addresses");
const { ethereumAddress } = require("./regex");
const { networkMap } = require("./hardhat-helpers");

const log = require("./logger")("task:assets");

/**
 * Resolves a token symbol to a ERC20 token contract.
 * This relies on Hardhat so can't be used for Defender Actions.
 * @param {string} symbol token symbol of the asset. eg OUSD, USDT, stETH, CRV...
 */
const resolveAsset = async (symbol) => {
  // This uses the Hardhat Runtime Environment (HRE)
  const { chainId } = await hre.ethers.provider.getNetwork();

  // If not a unit test or task running against the hardhat network
  if (chainId != networkMap.hardhat) {
    const network = networkMap[chainId];
    if (!network) {
      throw Error(`Failed to resolve network with chain Id "${chainId}"`);
    }

    const assetAddr =
      addresses[network][symbol + "Proxy"] || addresses[network][symbol];
    if (!assetAddr) {
      throw Error(
        `Failed to resolve symbol "${symbol}" to an address on the "${network}" network`
      );
    }
    log(`Resolved ${symbol} to ${assetAddr} on the ${network} network`);
    const asset = await ethers.getContractAt("IERC20Metadata", assetAddr);
    return asset;
  }
  const asset = await ethers.getContract("Mock" + symbol);
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
  // This uses the Hardhat Runtime Environment (HRE)
  const { chainId } = await hre.ethers.provider.getNetwork();
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
  resolveAsset,
  resolveContract,
};
