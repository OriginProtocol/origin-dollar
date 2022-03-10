const path = require("path");
const { promises, existsSync, mkdirSync } = require("fs");
const _ = require("lodash");

const {
  getStorageLayout,
  getVersion,
  getUnlinkedBytecode,
  isCurrentValidationData,
  assertStorageUpgradeSafe,
} = require("@openzeppelin/upgrades-core");
const isFork = process.env.FORK === "true";

const getStorageFileLocation = (hre, contractName) => {
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

const showStorageLayout = async (taskArguments, hre) => {
  const contractName = taskArguments.name;

  let layout = await getStorageLayoutForContract(hre, contractName);
  layout = enrichLayoutData(layout);
  visualizeLayoutData(layout);
};

const assertUpgradeIsSafe = async (hre, contractName) => {
  if (!isContractEligible(contractName)) {
    console.debug(`Skipping storage slot validation of ${contractName}.`);
    return true;
  }

  const layout = await getStorageLayoutForContract(hre, contractName);

  const oldLayout = await loadPreviousStorageLayoutForContract(
    hre,
    contractName
  );
  if (!oldLayout) {
    console.debug(
      `Previous storage layout for ${contractName} not found. Treating ${contractName} as a new contract.`
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

const visualizeLayoutData = (layout) => {
  const slotGroups = _.groupBy(
    layout.storage,
    (storageItem) => storageItem.startSlot
  );
  const printSlot = (startSlotNumber, slotVariables) => {
    const endSlotNumber = parseInt(
      _.max(slotVariables.map((sv) => sv.endSlot))
    );
    let title;

    if (parseInt(startSlotNumber) === endSlotNumber) {
      title = ` slot ${startSlotNumber} `;
    } else {
      title = ` slots ${startSlotNumber} - ${endSlotNumber} `;
    }

    const variableTexts = slotVariables.map((sv) => {
      const text = `${sv.contract}[${sv.label}]: ${
        layout.types[sv.type].label
      }`;
      return text;
    });

    const maxTextLength = _.max(variableTexts.map((text) => text.length));
    const boxSize = maxTextLength + 4;
    const titlePadding = boxSize - title.length - 2;

    console.log(
      ` ${"".padStart(
        Math.floor(titlePadding / 2.0),
        "_"
      )}${title}${"".padStart(Math.ceil(titlePadding / 2.0), "_")}`
    );
    console.log(`/${"".padStart(boxSize - 2, " ")}\\`);
    variableTexts.forEach((varText) =>
      console.log(
        `| ${varText}${"".padStart(boxSize - varText.length - 4, " ")} |`
      )
    );
    console.log(`\\${"".padStart(boxSize - 2, "_")}/`);
    console.log("");
  };

  Object.keys(slotGroups).forEach((startSlot) => {
    const slotVariables = slotGroups[startSlot];
    printSlot(startSlot, slotVariables);
  });
};

/* Description of how solidity slots behave:
 * - https://kubertu.com/blog/solidity-storage-in-depth/
 */
const enrichLayoutData = (layout) => {
  // assign how many bits each variable takes and if it requires a new slot
  layout.storage = layout.storage.map((sItem) => {
    // does storage item need to start a new slot
    sItem.newSlot = false;
    const arrayRegex = /^t_array\((.*)\)(.*)_storage$/;
    const contractRegex = /^t_contract\(.*$/;
    const structRegex = /^t_struct\(.*$/;
    const mappingRegex = /^t_mapping\((.*),(.*)\)$/;

    const itemToBytesMap = {
      t_address: 160,
      t_bool: 8,
      t_uint8: 8,
      t_uint16: 16,
      t_uint24: 24,
      t_uint32: 32,
      t_uint64: 64,
      t_uint128: 128,
      t_uint256: 256,
      t_int8: 8,
      t_int16: 16,
      t_int24: 24,
      t_int32: 32,
      t_int64: 64,
      t_int128: 128,
      t_int256: 256,
    };

    if (itemToBytesMap[sItem.type]) {
      sItem.bits = itemToBytesMap[sItem.type];
    } else if (arrayRegex.test(sItem.type)) {
      sItem.newSlot = true;
      const matchGroups = sItem.type.match(arrayRegex);
      const itemType = matchGroups[1];
      const arrayType = matchGroups[2];

      // dynamic array
      if (arrayType === "dyn") {
        // the first slot of the dynamic array only contains the length of the array
        sItem.bits = 256;
      } else {
        const fixedArraySize = parseInt(arrayType);
        sItem.bits = [...Array(fixedArraySize).keys()].map(
          (_) => itemToBytesMap[itemType]
        );
      }
    } else if (mappingRegex.test(sItem.type)) {
      sItem.newSlot = true;
      sItem.bits = 256;
    } else if (contractRegex.test(sItem.type)) {
      // TODO verify that reference to another contract takes as many bits as address type
      sItem.bits = 160;
    } else if (structRegex.test(sItem.type)) {
      throw new Error(
        "\x1b[31mStructures are not yet supported. Logic needs to be updated (probably with recursion) \x1b[0m"
      );
    } else {
      throw new Error(
        "\x1b[31mUnexpected solidity type: ",
        sItem.type,
        "\x1b[0m"
      );
    }

    return sItem;
  });

  let currentSlot = 0;
  let currentSlotBits = 0;
  // assign slots to mappings
  layout.storage = layout.storage.map((sItem, i) => {
    // current slot is not empty and new slot is required
    if (sItem.newSlot && currentSlotBits !== 0) {
      currentSlot += 1;
      currentSlotBits = 0;
    }

    const addBitsToSlot = (bits) => {
      if (currentSlotBits + bits > 256) {
        currentSlot += 1;
        currentSlotBits = bits;
      } else {
        currentSlotBits += bits;
      }
    };

    if (Array.isArray(sItem.bits)) {
      // arrays always start with a fresh slot and we can set it before the bits calculation
      sItem.startSlot = currentSlot;

      sItem.bits.forEach((bitItem) => {
        addBitsToSlot(bitItem);
      });
    } else {
      addBitsToSlot(sItem.bits);
      sItem.startSlot = currentSlot;
    }

    // storage slot span of the variable
    sItem.endSlot = currentSlot;
    return sItem;
  });

  return layout;
};

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
  showStorageLayout,
};
