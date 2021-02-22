async function _governorArgs({ contract, signature, args = [] }) {
  const method = signature;
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

module.exports = {
  proposeArgs,
};
