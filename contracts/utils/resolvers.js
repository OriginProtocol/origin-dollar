const addresses = require("./addresses");
const { ethereumAddress } = require("./regex");

const log = require("./logger")("task:assets");

/**
 * Resolves a token symbol to a ERC20 token contract.
 * @param {string} symbol token symbol of the asset. eg OUSD, USDT, stETH, CRV...
 */
const resolveAsset = async (symbol) => {
  // dynamically load in function so this function can be used by tasks
  // if put outside this function, the following error occurs:
  // "Hardhat can't be initialized while its config is being defined"
  const hre = require("hardhat");

  // Not using helpers here as they import hardhat which won't work for Hardhat tasks
  if (process.env.FORK === "true" || hre.network.name != "hardhat") {
    const network =
      hre.network.name != "hardhat"
        ? hre.network.name != "hardhat"
        : hre.network.config.chainId == 17000
        ? "holesky"
        : "mainnet";

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
 * @param {string} proxy Address or name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper
 * @param {string} [abiName=proxy] ABI name. Will default to proxy is not used. eg VaultAdmin, VaultCore, Governable or IERC20Metadata
 * @returns
 */
const resolveContract = async (proxy, abiName) => {
  // dynamically load in function so this function can be used by tasks
  // if put outside this function, the following error occurs:
  // "Hardhat can't be initialized while its config is being defined"
  const hre = require("hardhat");

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
    throw Error(
      `Failed find proxy "${proxy}" on the ${hre.network.name} network`
    );
  }
  log(
    `Resolved proxy ${proxy} on the ${hre.network.name} network to ${proxyContract.address}`
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
