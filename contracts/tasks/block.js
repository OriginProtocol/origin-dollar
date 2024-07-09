const log = require("../utils/logger")("task:block");

async function getBlock(block) {
  // Get the block to get all the data from
  if (!block) {
    const currentBlock = await hre.ethers.provider.getBlock();
    block = currentBlock.number;
  }
  log(`block: ${block}`);

  return block;
}

async function getDiffBlocks(taskArguments) {
  const output = taskArguments.output ? console.log : log;

  // Get the block to get all the data from
  const blockTag = !taskArguments.block
    ? await ethers.getDefaultProvider().getBlockNumber()
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

module.exports = {
  getBlock,
  getDiffBlocks,
};
