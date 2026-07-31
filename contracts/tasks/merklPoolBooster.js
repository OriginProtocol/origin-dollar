const { Contract } = require("ethers");

const addresses = require("../utils/addresses");
const { logTxDetails } = require("../utils/txLogger");
const log = require("../utils/logger")("task:merklPoolBooster");

// Minimal ABIs
const merklBribesModuleAbi = [
  "function bribeAll(address[] calldata _exclusionList) external",
  "function factory() external view returns (address)",
];

const poolBoosterFactoryAbi = [
  "function poolBoosterLength() external view returns (uint256)",
];

function resolveModuleAddress(chainId) {
  if (chainId === 1) return addresses.mainnet.MerklPoolBoosterBribesModule;
  if (chainId === 8453) return addresses.base.MerklPoolBoosterBribesModule;
  throw new Error(`Unsupported chain ${chainId}`);
}

/**
 * Calls bribeAll on the MerklPoolBoosterBribesModule
 * @param {Object} options
 * @param {ethers.Signer} options.signer
 * @param {ethers.providers.Provider} options.provider
 * @param {string[]} options.exclusionList - addresses to exclude from bribing
 * @param {string} [options.moduleAddress] - override module address (optional)
 */
async function manageMerklBribes({
  signer,
  provider,
  exclusionList = [],
  moduleAddress,
}) {
  const { chainId } = await provider.getNetwork();

  const resolvedModuleAddress = moduleAddress || resolveModuleAddress(chainId);

  log(`MerklPoolBoosterBribesModule: ${resolvedModuleAddress}`);
  log(`Exclusion list: [${exclusionList.join(", ")}]`);

  const bribesModule = new Contract(
    resolvedModuleAddress,
    merklBribesModuleAbi,
    signer
  );

  const factoryAddress = await bribesModule.factory();
  log(`PoolBoosterFactoryMerkl: ${factoryAddress}`);

  const factory = new Contract(factoryAddress, poolBoosterFactoryAbi, provider);
  const poolBoosterCount = await factory.poolBoosterLength();
  log(`Pool booster count: ${poolBoosterCount.toString()}`);

  log(`\n--- Calling bribeAll on MerklPoolBoosterBribesModule ---`);
  const tx = await bribesModule.bribeAll(exclusionList);
  const receipt = await logTxDetails(tx, "bribeAll");

  if (receipt.status !== 1) {
    throw new Error(
      `bribeAll transaction reverted - status: ${receipt.status}`
    );
  }

  log("SUCCESS: bribeAll executed successfully!");
}

/**
 * Hardhat task wrapper for manageMerklBribes
 */
async function manageMerklBribesTask(taskArguments) {
  const { getSigner } = require("../utils/signers");
  const signer = await getSigner();

  const exclusionList = taskArguments.exclusionList
    ? taskArguments.exclusionList
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  await manageMerklBribes({
    signer,
    provider: signer.provider,
    exclusionList,
    moduleAddress: taskArguments.moduleAddress,
  });
}

module.exports = {
  manageMerklBribes,
  manageMerklBribesTask,
};
