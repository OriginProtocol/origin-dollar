const addresses = require("./addresses");

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
  const isFork = process.env.FORK === "true";
  const isMainnet = hre.network.name === "mainnet";
  const isMainnetOrFork = isMainnet || isFork;

  if (isMainnetOrFork) {
    const assetAddr =
      addresses.mainnet[symbol] || addresses.mainnet[symbol + "Proxy"];
    if (!assetAddr) {
      throw Error(`Failed to resolve symbol "${symbol}" to an address`);
    }
    log(`Resolved ${symbol} to ${assetAddr}`);
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
 * @param {string} proxyName Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper
 * @param {string} abiName ABI name. eg VaultAdmin, VaultCore, Governable or IERC20Metadata
 * @returns
 */
const resolveContract = async (proxyName, abiName) => {
  // dynamically load in function so this function can be used by tasks
  // if put outside this function, the following error occurs:
  // "Hardhat can't be initialized while its config is being defined"
  const hre = require("hardhat");

  const proxy = await ethers.getContract(proxyName);
  if (!proxy) {
    throw Error(
      `Failed find proxy "${proxyName}" on the ${hre.network.name} network`
    );
  }
  log(
    `Resolved proxy ${proxyName} on the ${hre.network.name} network to ${proxy.address}`
  );

  if (abiName) {
    const contract = await ethers.getContractAt(abiName, proxy.address);
    if (!contract) {
      throw Error(`Failed find ABI for "${abiName}"`);
    }
    return contract;
  }

  return proxy;
};

module.exports = {
  resolveAsset,
  resolveContract,
};