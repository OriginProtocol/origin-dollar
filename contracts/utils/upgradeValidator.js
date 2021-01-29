const path = require('path');
const { promises } = require('fs');

const {
  getStorageLayout,
  getVersion,
  getUnlinkedBytecode,
  Manifest,
  getImplementationAddress,
  getStorageLayoutForAddress,
  isCurrentValidationData,
  assertStorageUpgradeSafe
} = require('@openzeppelin/upgrades-core');

const checkStorageSlots = async (hre, proxyAddress, ImplFactory) => {
	const { provider } = hre.network;
  const manifest = await Manifest.forNetwork(provider);
  const validations = await readValidations(hre);
  const unlinkedBytecode = getUnlinkedBytecode(validations, ImplFactory.bytecode);
  const version = getVersion(unlinkedBytecode, ImplFactory.bytecode);

  const currentImplAddress = await getImplementationAddress(provider, proxyAddress);
  //const deploymentLayout = await getStorageLayoutForAddress(manifest, validations, currentImplAddress);
  const layout = getStorageLayout(validations, version);
  // 3rd param is opts.unsafeAllowCustomTypes
  assertStorageUpgradeSafe(layout, layout, false);
}

function getValidationsCachePath(hre) {
  return path.join(hre.config.paths.cache, 'validations.json');
}

class ValidationsCacheNotFound extends Error {
  constructor() {
    super('Validations cache not found. Recompile with `hardhat compile --force`');
  }
}

class ValidationsCacheOutdated extends Error {
  constructor() {
    super('Validations cache is outdated. Recompile with `hardhat compile --force`');
  }
}

const readValidations = async (hre) => {
  const cachePath = getValidationsCachePath(hre);
  try {
    const data = JSON.parse(await promises.readFile(cachePath, 'utf8'));
    if (!isCurrentValidationData(data)) {
      await promises.unlink(cachePath);
      throw new ValidationsCacheOutdated();
    }
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new ValidationsCacheNotFound();
    } else {
      throw e;
    }
  }
}


module.exports = {
	checkStorageSlots
}