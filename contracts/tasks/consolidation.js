const { getSigner } = require("../utils/signers");

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

module.exports = { requestConsolidation };
