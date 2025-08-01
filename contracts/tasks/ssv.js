const { parseUnits, formatUnits, hexlify } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { getClusterInfo } = require("../utils/ssv");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { logTxDetails } = require("../utils/txLogger");
const { resolveNativeStakingStrategyProxy } = require("./validator");

const log = require("../utils/logger")("task:ssv");

async function removeValidators({ index, pubkeys, operatorids }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = await sortOperatorIds(operatorids);

  const strategy = await resolveNativeStakingStrategyProxy(index);

  const { chainId } = await ethers.provider.getNetwork();

  // Cluster details
  const { cluster } = await getClusterInfo({
    chainId,
    ssvNetwork: hre.network.name.toUpperCase(),
    operatorids,
    ownerAddress: strategy.address,
  });

  log(`Splitting public keys ${pubkeys}`);
  const pubKeys = pubkeys.split(",").map((pubkey) => hexlify(pubkey));

  log(`About to remove validators: ${pubKeys}`);
  const tx = await strategy
    .connect(signer)
    .removeSsvValidators(pubKeys, operatorIds, cluster);
  await logTxDetails(tx, "removeSsvValidators");
}

const printClusterInfo = async (options) => {
  options.operatorids = await sortOperatorIds(options.operatorids);
  const cluster = await getClusterInfo(options);
  console.log(`block ${cluster.block}`);
  console.log(`Cluster: ${JSON.stringify(cluster.cluster, null, "  ")}`);
};

const depositSSV = async ({ amount, index, operatorids }) => {
  const amountBN = parseUnits(amount.toString(), 18);
  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = await sortOperatorIds(operatorids);

  const signer = await getSigner();

  const strategy = await resolveNativeStakingStrategyProxy(index);

  const { chainId } = await ethers.provider.getNetwork();
  const networkName = await getNetworkName();
  const ssvNetworkAddress = addresses[networkName].SSVNetwork;
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
  log(`Cluster: ${JSON.stringify(clusterInfo.cluster)}`);
  const tx = await strategy
    .connect(signer)
    .depositSSV(operatorIds, amountBN, clusterInfo.cluster);
  await logTxDetails(tx, "depositSSV");
};

const withdrawSSV = async ({ amount, index, operatorids }) => {
  const amountBN = parseUnits(amount.toString(), 18);
  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = await sortOperatorIds(operatorids);

  const signer = await getSigner();

  const strategy = await resolveNativeStakingStrategyProxy(index);

  const { chainId } = await ethers.provider.getNetwork();
  const networkName = await getNetworkName();
  const ssvNetworkAddress = addresses[networkName].SSVNetwork;
  const ssvNetwork = await resolveContract(ssvNetworkAddress, "ISSVNetwork");

  // Cluster details
  const clusterInfo = await getClusterInfo({
    chainId,
    ssvNetwork: ssvNetwork.address,
    operatorids,
    ownerAddress: strategy.address,
  });

  log(
    `About to withdraw ${formatUnits(
      amountBN
    )} SSV tokens from the SSV Network for native staking strategy ${
      strategy.address
    } with operator IDs ${operatorIds}`
  );
  log(`Cluster: ${JSON.stringify(clusterInfo.cluster)}`);
  const tx = await strategy
    .connect(signer)
    .withdrawSSV(operatorIds, amountBN, clusterInfo.cluster);
  await logTxDetails(tx, "withdrawSSV");
};

const sortOperatorIds = (operatorIdsString) => {
  const operatorIds = operatorIdsString.split(",").map((id) => parseInt(id));
  operatorIds.sort((a, b) => a - b);

  return operatorIds.join(",");
};

module.exports = {
  sortOperatorIds,
  printClusterInfo,
  depositSSV,
  withdrawSSV,
  removeValidators,
};
