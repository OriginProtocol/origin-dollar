const BigNumber = require("ethers").BigNumber;

async function _governorArgs({ contract, signature, args = [] }) {
  const method = signature;
  if (!contract.populateTransaction[method]) {
    throw Error(
      `Check that the contract has the following method signature: ${method}`
    );
  }
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10);
  return [tx.to, signature, data];
}

/**
 * Utility to build the arguments to pass to the governor's propose method.
 * @param governorArgsArray
 * @returns {Promise<*[]>}
 */
async function proposeArgs(governorArgsArray) {
  const targets = [],
    sigs = [],
    datas = [];
  for (const g of governorArgsArray) {
    const [t, s, d] = await _governorArgs(g);
    targets.push(t);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, sigs, datas];
}

/**
 * Utility to build the arguments to pass to the OGV governor's propose method.
 * @param governorArgsArray
 * @returns {Promise<*[]>}
 */
async function proposeGovernanceArgs(governorArgsArray) {
  const args = await proposeArgs(governorArgsArray);

  return [
    args[0],
    Array(governorArgsArray).fill(BigNumber.from(0)),
    args[1],
    args[2],
  ];
}

module.exports = {
  proposeArgs,
  proposeGovernanceArgs,
};
