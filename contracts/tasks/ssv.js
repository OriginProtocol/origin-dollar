const { parseUnits, formatUnits, solidityPack } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { getClusterInfo } = require("../utils/ssv");
const { networkMap } = require("../utils/hardhat-helpers");
const { logTxDetails } = require("../utils/txLogger");
const { resolveNativeStakingStrategyProxy } = require("./validator");
const { checkPubkeyFormat } = require("./taskUtils");

const log = require("../utils/logger")("task:ssv");

async function removeValidator({ index, pubkey, operatorids }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const strategy = await resolveNativeStakingStrategyProxy(index);

  const { chainId } = await ethers.provider.getNetwork();

  // Cluster details
  const { cluster } = await getClusterInfo({
    chainId,
    ssvNetwork: hre.network.name.toUpperCase(),
    operatorids,
    ownerAddress: strategy.address,
  });

  log(`About to remove validator`);
  pubkey = checkPubkeyFormat(pubkey);
  const tx = await strategy
    .connect(signer)
    .removeSsvValidator(pubkey, operatorIds, cluster);
  await logTxDetails(tx, "removeSsvValidator");
}

const printClusterInfo = async (options) => {
  const cluster = await getClusterInfo(options);
  // const nextNonce = await getClusterNonce(options);
  console.log(`block ${cluster.block}`);
  console.log(`Cluster: ${JSON.stringify(cluster.snapshot, null, "  ")}`);
  // console.log("Next Nonce:", nextNonce);
};

const depositSSV = async ({ amount, index, operatorids }) => {
  const amountBN = parseUnits(amount.toString(), 18);
  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const signer = await getSigner();

  const strategy = await resolveNativeStakingStrategyProxy(index);

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

const calcDepositRoot = async ({ pubkey, sig }, hre) => {
  if (hre.network.name !== "hardhat") {
    throw new Error("This task can only be run in hardhat network");
  }

  const factory = await ethers.getContractFactory("DepositContractUtils");
  const depositContractUtils = await factory.deploy();

  const withdrawalCredentials = solidityPack(
    ["bytes1", "bytes11", "address"],
    [
      "0x01",
      "0x0000000000000000000000",
      addresses.mainnet.NativeStakingSSVStrategyProxy,
    ]
  );
  log(`Withdrawal Credentials: ${withdrawalCredentials}`);

  log(
    `About to calculate deposit data root for pubkey ${pubkey} and sig ${sig}`
  );
  const depositDataRoot = await depositContractUtils.calculateDepositDataRoot(
    pubkey,
    withdrawalCredentials,
    sig
  );

  console.log(`Deposit Root Data: ${depositDataRoot}`);
};

module.exports = {
  printClusterInfo,
  depositSSV,
  calcDepositRoot,
  removeValidator,
};
