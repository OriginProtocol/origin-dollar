const { formatUnits } = require("ethers/lib/utils");
const { ethers } = hre;
const addresses = require("./addresses");
const { replaceContractAt } = require("./hardhat");

const log = require("./logger")("utils:fork:mockOracle");

const feedConfig = {
  [addresses.mainnet.rETH]: {
    feed: "0x536218f9E9Eb48863970252233c8F271f554C2d0",
    decimals: 18,
  },
  [addresses.mainnet.frxETH]: {
    feed: "0xC58F3385FBc1C8AD2c0C9a061D7c13b141D7A5Df",
    decimals: 18,
  },
  [addresses.mainnet.stETH]: {
    feed: "0x86392dC19c0b719886221c78AB11eb8Cf5c52812",
    decimals: 18,
  },
};

/**
 * Sets the price of any chainlink oracle feed used by
 * the OracleRouter.
 * @param {BigNumber} price The price with 18 decimals
 */
const setChainlinkOraclePrice = async (asset, price) => {
  const { feed, decimals } = feedConfig[asset];
  const { deploy } = deployments;
  if (!feed || !decimals) {
    throw new Error(`Can not mock oracle for asset: ${asset}`);
  }

  const contractName = `MockChainlinkOracleFeed_${asset}`;
  console.log(
    `About to set Oracle price for asset: ${asset} to ${formatUnits(price)}`
  );

  // deploy mocked feed address
  await deploy(contractName, {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: "MockChainlinkOracleFeed",
    args: [price, decimals],
  });

  await replaceContractAt(feed, await ethers.getContract(contractName));

  const contract = await ethers.getContractAt("MockChainlinkOracleFeed", feed);
  contract.setPrice(price);
};

module.exports = {
  setChainlinkOraclePrice,
};
