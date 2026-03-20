const path = require("path");
const { getSigner } = require("../utils/signers");

const addresses = require("../utils/addresses");
const { verifyBalances } = require("./beacon");
const { resolveContract } = require("../utils/resolvers");
const { writeSafeTransactionBuilderFile } = require("../utils/safe");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("utils:consolidation");

async function writeConfirmConsolidationSafeFile({
  controller,
  balanceProofs,
  pendingDepositProofs,
}) {
  const tx = await controller.populateTransaction.confirmConsolidation(
    balanceProofs,
    pendingDepositProofs
  );
  const safeOwner = await controller.owner();
  const safeFilePath = await writeSafeTransactionBuilderFile({
    filePath: path.resolve(__dirname, "../../logs/confirmConsol-safe.json"),
    safeAddress: safeOwner,
    name: "confirmConsol",
    transactions: [
      {
        to: controller.address,
        value: "0",
        data: tx.data,
      },
    ],
  });

  return { safeFilePath, safeOwner };
}

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

async function confirmConsolidation({ safe = false }) {
  const signer = await getSigner();
  const controller = await resolveContract("ConsolidationController");

  const { balanceProofs, pendingDepositProofs } = await verifyBalances({
    dryrun: true,
  });

  if (safe) {
    log(
      `Generating Safe file for confirmConsolidation via ConsolidationController ${controller.address}`
    );
    const { safeFilePath, safeOwner } = await writeConfirmConsolidationSafeFile(
      {
        controller,
        balanceProofs,
        pendingDepositProofs,
      }
    );

    console.log(`Safe owner                      : ${safeOwner}`);
    console.log(`Safe file                       : ${safeFilePath}`);
    return;
  }

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
