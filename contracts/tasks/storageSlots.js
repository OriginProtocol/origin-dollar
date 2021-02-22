const path = require("path");
const { promises, existsSync, mkdirSync } = require("fs");

const {
  getStorageLayout,
  getVersion,
  getUnlinkedBytecode,
  Manifest,
  getStorageLayoutForAddress,
  isCurrentValidationData,
  assertStorageUpgradeSafe,
} = require("@openzeppelin/upgrades-core");
const isFork = process.env.FORK === "true";

const getStorageFileLocation = (hre, contractName) => {
  const isLocalhost = !isFork && hre.network.name === "localhost";
  const isRinkeby = hre.network.name === "rinkeby";
  const isMainnet = hre.network.name === "mainnet";

  let folder = "localhost";
  if (isFork || isMainnet) {
    folder = "mainnet";
  } else if (isRinkeby) {
    folder = "rinkeby";
  }

  const layoutFolder = `./storageLayout/${folder}/`;
  if (!existsSync(layoutFolder)) {
    mkdirSync(layoutFolder);
  }

  return `${layoutFolder}${contractName}.json`;
};

const getStorageLayoutForContract = async (hre, contractName) => {
  const { provider } = hre.network;
  const manifest = await Manifest.forNetwork(provider);
  const validations = await readValidations(hre);
  const implFactory = await hre.ethers.getContractFactory(contractName);
  const unlinkedBytecode = getUnlinkedBytecode(
    validations,
    implFactory.bytecode
  );
  const version = getVersion(unlinkedBytecode, implFactory.bytecode);

  return getStorageLayout(validations, version);
};

const loadPreviousStorageLayoutForContract = async (hre, contractName) => {
  const location = getStorageFileLocation(hre, contractName);

  // new contract
  if (!existsSync(location)) {
    return null;
  }

  return JSON.parse(await promises.readFile(location, "utf8"));
};

const storeStorageLayoutForContract = async (hre, contractName) => {
  const layout = await getStorageLayoutForContract(hre, contractName);
  const storageLayoutFile = getStorageFileLocation(hre, contractName);

  // pretty print storage layout for the contract
  await promises.writeFile(storageLayoutFile, JSON.stringify(layout, null, 2));
  console.log(
    `Storage slots layout for ${contractName} saved to ${storageLayoutFile} `
  );
};

const getAllEligibleContractNames = async (hre) => {
  const contractNames = Object.keys(await hre.deployments.all());

  return contractNames.filter(isContractEligible);
};

const isContractEligible = (contractName) => {
  // These contracts have been deprecated source files are no longer in repo but are still under deployments.
  // For that reason they need to be excluded.
  const excludeContracts = [
    "CurveUSDCStrategy",
    "CurveUSDTStrategy",
    "MinuteTimelock",
    "OpenUniswapOracle",
    "RebaseHooks",
  ];

  // Need to exclude proxies as well since they are not upgradeable
  return (
    !contractName.endsWith("Proxy") &&
    !contractName.startsWith("Mock") &&
    !excludeContracts.includes(contractName)
  );
};

const storeStorageLayoutForAllContracts = async (taskArguments, hre) => {
  const allContracts = await getAllEligibleContractNames(hre);

  for (let i = 0; i < allContracts.length; i++) {
    await storeStorageLayoutForContract(hre, allContracts[i]);
  }
};

const assertStorageLayoutChangeSafeForAll = async (taskArguments, hre) => {
  const allContracts = await getAllEligibleContractNames(hre);

  for (let i = 0; i < allContracts.length; i++) {
    await assertUpgradeIsSafe(hre, allContracts[i]);
  }
};

const assertStorageLayoutChangeSafe = async (taskArguments, hre) => {
  const contractName = taskArguments.name;

  await assertUpgradeIsSafe(hre, contractName);
};

const assertUpgradeIsSafe = async (hre, contractName) => {
  if (!isContractEligible(contractName)) {
    console.warn(`Skipping storage slot validation of ${contractName}.`);
    return true;
  }

  const layout = await getStorageLayoutForContract(hre, contractName);

  const oldLayout = await loadPreviousStorageLayoutForContract(
    hre,
    contractName
  );
  if (!oldLayout) {
    console.warn(
      `Previous storage layout for ${contractName} not found. Treating ${contractName} as a new contract`
    );
  } else {
    // 3rd param is opts.unsafeAllowCustomTypes
    assertStorageUpgradeSafe(oldLayout, layout, false);
    console.log(`[storage-slots] Contract ${contractName} is safe for upgrade`);
  }
};

function getValidationsCachePath(hre) {
  return path.join(hre.config.paths.cache, "validations.json");
}

class ValidationsCacheNotFound extends Error {
  constructor() {
    super(
      "Validations cache not found. Recompile with `hardhat compile --force`"
    );
  }
}

class ValidationsCacheOutdated extends Error {
  constructor() {
    super(
      "Validations cache is outdated. Recompile with `hardhat compile --force`"
    );
  }
}

const readValidations = async (hre) => {
  const cachePath = getValidationsCachePath(hre);
  try {
    const data = JSON.parse(await promises.readFile(cachePath, "utf8"));
    if (!isCurrentValidationData(data)) {
      await promises.unlink(cachePath);
      throw new ValidationsCacheOutdated();
    }
    return data;
  } catch (e) {
    if (e.code === "ENOENT") {
      throw new ValidationsCacheNotFound();
    } else {
      throw e;
    }
  }
};

module.exports = {
  storeStorageLayoutForAllContracts,
  assertStorageLayoutChangeSafe,
  assertStorageLayoutChangeSafeForAll,
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
};
