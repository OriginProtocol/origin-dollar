const { getSigner } = require("../utils/signers");

const { verifyBalances } = require("./beacon");
const { resolveContract } = require("../utils/resolvers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("utils:consolidation");

async function requestConsolidation({ source, target, cluster }) {
  const signer = await getSigner();
  const controller = await resolveContract("ConsolidationController");

  const sourcePublicKey = source.split(",");

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
  const tx = await controller
    .connect(signer)
    .requestConsolidation(
      nativeStakingStrategy.address,
      sourcePublicKey,
      target
    );

  await logTxDetails(tx, "requestConsolidation");
}

async function failConsolidation({ source }) {
  const signer = await getSigner();
  const controller = await resolveContract("ConsolidationController");

  const sourcePublicKey = source.split(",");

  log(`About to fail validator consolidations.\nsource: ${source}`);
  const tx = await controller
    .connect(signer)
    .requestConsolidation(sourcePublicKey);

  await logTxDetails(tx, "requestConsolidation");
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

  await logTxDetails(tx, "requestConsolidation");
}

module.exports = {
  requestConsolidation,
  failConsolidation,
  confirmConsolidation,
};
