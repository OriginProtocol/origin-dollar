const { getSigner } = require("../utils/signers");

const addresses = require("../utils/addresses");
const { verifyBalances } = require("./beacon");
const { resolveContract } = require("../utils/resolvers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("utils:consolidation");

async function requestConsolidation({ source, target, cluster }) {
  const signer = await getSigner();
  const controller = await resolveContract("ConsolidationController");

  const sourcePublicKeys = source.split(",");

  const nativeStakingStrategyProxy =
    cluster === undefined
      ? "NativeStakingSSVStrategyProxy"
      : `NativeStakingSSVStrategy${cluster}Proxy`;
  const nativeStakingStrategy = await resolveContract(
    nativeStakingStrategyProxy,
    "NativeStakingSSVStrategy"
  );

  log(
    `About to request validator consolidation.\nsource: ${source}\ntarget: ${target}`
  );
  const tx = await controller.connect(signer).requestConsolidation(
    nativeStakingStrategy.address,
    sourcePublicKeys,
    target,
    { value: sourcePublicKeys.length } // 1 wei pre request
  );

  await logTxDetails(tx, "requestConsolidation");
}

async function failConsolidation({ source }) {
  const signer = await getSigner();
  const controller = await resolveContract("ConsolidationController");

  const sourcePublicKeys = source.split(",");

  log(`About to fail validator consolidations.\nsource: ${source}`);
  const tx = await controller
    .connect(signer)
    .failConsolidation(sourcePublicKeys);

  await logTxDetails(tx, "failConsolidation");
}

async function confirmConsolidation() {
  const signer = await getSigner();
  const controller = await resolveContract("ConsolidationController");

  const { balanceProofs, pendingDepositProofs } = await verifyBalances({
    dryrun: true,
  });

  log(`About to confirm validator consolidations`);
  const tx = await controller
    .connect(signer)
    .confirmConsolidation(balanceProofs, pendingDepositProofs);

  await logTxDetails(tx, "confirmConsolidation");
}

async function getConsolidationFee({ block }) {
  const blockTag = block ? block : "latest";
  const result = await hre.ethers.provider.call(
    {
      to: addresses.mainnet.toConsensus.consolidation,
      data: "0x",
    },
    blockTag
  );
  const fee = hre.ethers.BigNumber.from(result);
  console.log(
    `Consolidation request fee at block ${blockTag}: ${fee.toString()} wei`
  );
  return fee;
}

module.exports = {
  requestConsolidation,
  failConsolidation,
  confirmConsolidation,
  getConsolidationFee,
};
