const addresses = require("./addresses");
const { ethereumAddress } = require("./regex");
const { networkMap } = require("./hardhat-helpers");
const { resolveContract } = require("./resolversNoHardhat");

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
    const { chainId } = await ethers.getDefaultProvider().getNetwork();
    const network = networkMap[chainId] || "mainnet";

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

module.exports = {
  resolveAsset,
  resolveContract,
};
