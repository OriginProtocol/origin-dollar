const { parseUnits, formatUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { getClusterInfo } = require("../utils/ssv");
const { networkMap } = require("../utils/hardhat-helpers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:ssv");

const printClusterInfo = async (options) => {
  const cluster = await getClusterInfo(options);
  // const nextNonce = await getClusterNonce(options);
  console.log(`block ${cluster.block}`);
  console.log(`Cluster: ${JSON.stringify(cluster.snapshot, null, "  ")}`);
  // console.log("Next Nonce:", nextNonce);
};

const depositSSV = async ({ amount, operatorids }) => {
  const amountBN = parseUnits(amount.toString(), 18);
  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const signer = await getSigner();

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );
  const { chainId } = await ethers.provider.getNetwork();
  const network = networkMap[chainId];
  const ssvNetworkAddress = addresses[network].SSVNetwork;
  const ssvNetwork = await resolveContract(ssvNetworkAddress, "ISSVNetwork");

  // Cluster details
  const clusterInfo = await getClusterInfo({
    chainId,
    ssvNetwork: ssvNetwork.address,
    operatorids,
    ownerAddress: strategy.address,
  });

  log(
    `About to deposit ${formatUnits(
      amountBN
    )} SSV tokens to the SSV Network for native staking strategy ${
      strategy.address
    } with operator IDs ${operatorIds}`
  );
  log(`Cluster: ${JSON.stringify(clusterInfo.snapshot)}`);
  const tx = await strategy
    .connect(signer)
    .depositSSV(operatorIds, amountBN, clusterInfo.cluster);
  await logTxDetails(tx, "depositSSV");
};

module.exports = {
  printClusterInfo,
  depositSSV,
};
