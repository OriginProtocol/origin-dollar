const log = require("../utils/logger")("task:block");

// Works in both runtimes: the standalone action CLI (ambient provider from
// tasks/lib/network) and legacy hardhat dev tasks (the `hre` global). Prefer
// the standalone provider; fall back to hre when the network isn't initialized.
function currentProvider() {
  try {
    return require("./lib/network").getProvider();
  } catch {
    // eslint-disable-next-line no-undef
    return hre.ethers.provider;
  }
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
  // hardhat-only (test/dev) — required lazily so the standalone action runtime
  // never loads hardhat just to import this module.
  const { mine } = require("@nomicfoundation/hardhat-network-helpers");
  await mine(blocks);
}

module.exports = {
  advanceBlocks,
  getBlock,
  getDiffBlocks,
};
