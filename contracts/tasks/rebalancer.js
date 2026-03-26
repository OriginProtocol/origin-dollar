const { ethers } = require("ethers");

const { getSigner } = require("../utils/signers");
const { buildRebalancePlan } = require("../utils/rebalancer");

async function rebalancerTask() {
  const signer = await getSigner();
  const providers = { 1: signer.provider || signer };
  if (process.env.BASE_PROVIDER_URL) {
    providers[8453] = new ethers.providers.JsonRpcProvider(
      process.env.BASE_PROVIDER_URL
    );
  }
  if (process.env.HYPEREVM_PROVIDER_URL) {
    providers[999] = new ethers.providers.JsonRpcProvider(
      process.env.HYPEREVM_PROVIDER_URL
    );
  }
  await buildRebalancePlan(providers);
}

module.exports = {
  rebalancerTask,
};
