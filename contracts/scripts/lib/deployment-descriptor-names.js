const REPEG_DESCRIPTORS = {
  OUSD_CURVE_AMO_REPEG_MODULE: "OUSDCurveAmoRepegModule",
  OETH_CURVE_AMO_REPEG_MODULE: "OETHCurveAmoRepegModule",
  SUPER_OETH_CURVE_AMO_REPEG_MODULE: "SuperOETHCurveAmoRepegModule",
};

function deploymentDescriptorName(contractName, address, registrations) {
  if (contractName !== "CurveAmoRepegModule") return contractName;
  const bindings = registrations.filter(
    (entry) =>
      Object.hasOwn(REPEG_DESCRIPTORS, entry.name) &&
      entry.implementation.toLowerCase() === address.toLowerCase()
  );
  if (bindings.length !== 1) {
    throw new Error(
      `Expected one asset binding for CurveAmoRepegModule at ${address}; found ${bindings.length}`
    );
  }
  return REPEG_DESCRIPTORS[bindings[0].name];
}

module.exports = { deploymentDescriptorName };
