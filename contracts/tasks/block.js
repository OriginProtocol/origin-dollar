const log = require("../utils/logger")("task:block");

// Uses the ambient provider initialized by the standalone CLI.
function currentProvider() {
  return require("./lib/network").getProvider();
}

async function getBlock(block) {
  // Get the block to get all the data from
  const blockTag = !block ? await currentProvider().getBlockNumber() : block;
  log(`block: ${blockTag}`);

  return blockTag;
}

async function getDiffBlocks(taskArguments) {
  const output = taskArguments.output ? console.log : log;

  // Get the block to get all the data from
  const blockTag = !taskArguments.block
    ? await currentProvider().getBlockNumber()
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
  await currentProvider().send("anvil_mine", [`0x${blocks.toString(16)}`]);
}

module.exports = {
  advanceBlocks,
  getBlock,
  getDiffBlocks,
};
