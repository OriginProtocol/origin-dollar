const addresses = require("../utils/addresses");
const { parseUnits } = require("ethers/lib/utils");

const { getSigner } = require("../utils/signers");
const { resolveContract } = require("../utils/resolvers");
const { getClusterInfo } = require("../utils/ssv");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:validator:compounding");

async function registerValidator({ pubkey, shares, operatorids, ssv }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${(operatorids, ssv)}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const ssvAmount = parseUnits(ssv.toString(), 18);
  const { chainId } = await ethers.provider.getNetwork();

  // Cluster details
  const { cluster } = await getClusterInfo({
    chainId,
    ssvNetwork: hre.network.name.toUpperCase(),
    operatorids,
    // Hard code to the old 3rd native staking strategy for now
    ownerAddress: addresses.mainnet.NativeStakingSSVStrategy3Proxy,
  });

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const reg = await strategy.validatorRegistrator();
  console.log(`Validator registrator for compounding strategy is ${reg}`);

  log(`About to register validator with pubkey ${pubkey}`);
  const tx = await strategy
    .connect(signer)
    .registerSsvValidator(pubkey, operatorIds, shares, ssvAmount, cluster);
  await logTxDetails(tx, "registerValidator");
}

module.exports = { registerValidator };
