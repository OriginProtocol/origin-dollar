const { ethers } = require("ethers");

const { getSigner } = require("../utils/signers");
const { buildRebalancePlan } = require("../utils/rebalancer");

async function rebalancerTask() {
  const signer = await getSigner();
  const baseProvider = new ethers.providers.JsonRpcProvider(
    process.env.BASE_PROVIDER_URL
  );
  await buildRebalancePlan({
    1: signer.provider || signer,
    8453: baseProvider,
  });
}

module.exports = {
  rebalancerTask,
};
