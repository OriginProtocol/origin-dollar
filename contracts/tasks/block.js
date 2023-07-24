const log = require("../utils/logger")("task:block");

async function getBlock(block) {
  // Get the block to get all the data from
  const blockTag = !block ? await hre.ethers.provider.getBlockNumber() : block;
  log(`block: ${blockTag}`);

  return blockTag;
}

module.exports = {
  getBlock,
};
