const fs = require("fs");
const path = require("path");

async function buildSafeTransactionBuilderJson({
  safeAddress,
  name,
  transactions,
  description = "",
}) {
  const { chainId } = await ethers.provider.getNetwork();

  return {
    version: "1.0",
    chainId: chainId.toString(),
    createdAt: Math.floor(Date.now() / 1000),
    meta: {
      name,
      description,
      txBuilderVersion: "1.16.1",
      createdFromSafeAddress: safeAddress,
      createdFromOwnerAddress: "",
    },
    transactions: transactions.map((tx) => ({
      to: tx.to,
      value: tx.value ?? "0",
      data: tx.data ?? null,
      contractMethod: tx.contractMethod ?? null,
      contractInputsValues: tx.contractInputsValues ?? null,
    })),
  };
}

async function writeSafeTransactionBuilderFile({
  filePath,
  safeAddress,
  name,
  transactions,
  description = "",
}) {
  const resolvedFilePath = path.resolve(filePath);
  const safeJson = await buildSafeTransactionBuilderJson({
    safeAddress,
    name,
    transactions,
    description,
  });

  fs.mkdirSync(path.dirname(resolvedFilePath), { recursive: true });
  fs.writeFileSync(resolvedFilePath, JSON.stringify(safeJson, null, 2));

  return resolvedFilePath;
}

module.exports = {
  buildSafeTransactionBuilderJson,
  writeSafeTransactionBuilderFile,
};
