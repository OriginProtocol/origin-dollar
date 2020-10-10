
async function _governorArgs({ contract, value = 0, signature, args=[]}) {
  const method = signature
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10) ;
  return [tx.to, value, signature, data];
}

/**
 * Utility to build the arguments to pass to the governor's propose method.
 * @param governorArgsArray
 * @returns {Promise<*[]>}
 */
async function proposeArgs(governorArgsArray) {
  const targets=[], values=[], sigs=[], datas=[];
  for (const g of governorArgsArray) {
    const [t, v, s, d] = await _governorArgs(g);
    targets.push(t);
    values.push(v);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, values, sigs, datas];
}

module.exports = {
  proposeArgs
}