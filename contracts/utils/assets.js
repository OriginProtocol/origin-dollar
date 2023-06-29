const addresses = require("../utils/addresses");

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
    const asset = await ethers.getContractAt("IERC20", assetAddr);
    return asset;
  }
  const asset = await ethers.getContract("Mock" + symbol);
  if (!asset) {
    throw Error(`Failed to resolve symbol "${symbol}" to a mock contract`);
  }
  return asset;
};

module.exports = {
  resolveAsset,
};
