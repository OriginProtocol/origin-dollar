const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const log = require("../utils/logger")("task:block");

async function getBlock(block) {
  // Get the block to get all the data from
  const blockTag = !block ? await hre.ethers.provider.getBlockNumber() : block;
  log(`block: ${blockTag}`);

  return blockTag;
}

async function getDiffBlocks(taskArguments) {
  const output = taskArguments.output ? console.log : log;

  // Get the block to get all the data from
  const blockTag = !taskArguments.block
    ? await hre.ethers.provider.getBlockNumber()
    : taskArguments.block;
  output(`block: ${blockTag}`);
  const fromBlockTag = taskArguments.fromBlock || 0;
  const diffBlocks = fromBlockTag > 0;

  return {
    diffBlocks,
    blockTag,
    fromBlockTag,
  };
}

async function advanceBlocks(blocks) {
  log(`Advancing ${blocks} blocks`);
  await mine(blocks);
}

module.exports = {
  advanceBlocks,
  getBlock,
  getDiffBlocks,
};
