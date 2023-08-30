const hre = require("hardhat");
const { nodeSnapshot, nodeRevert } = require("../test/_fixture");
/* Executes a (test) function in a temporary fork that is after the function executes reverted.
 * Useful for when preview of actions need to be executed and changes in oToken supply and vault
 * observed.
 */
const temporaryFork = async ({
  temporaryAction,
  vaultContract,
  oTokenContract,
}) => {
  const vaultValue = await vaultContract.totalValue();
  const totalSupply = await oTokenContract.totalSupply();
  const snapshotId = await nodeSnapshot();

  await temporaryAction();

  const vaultChange = (await vaultContract.totalValue()).sub(vaultValue);
  const supplyChange = (await oTokenContract.totalSupply()).sub(totalSupply);
  const profit = vaultChange.sub(supplyChange);

  await nodeRevert(snapshotId);
  return {
    vaultChange,
    supplyChange,
    profit,
  };
};

module.exports = temporaryFork;
