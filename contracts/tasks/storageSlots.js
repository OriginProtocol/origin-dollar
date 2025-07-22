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

const log = require("../utils/logger")("task:storage");

const isFork = process.env.FORK === "true";

const getStorageFileLocation = (hre, contractName, isUpgradeableProxy) => {
  const isMainnet = hre.network.name === "mainnet";
  const isArbitrum = hre.network.name === "arbitrumOne";
  const isSonic = hre.network.name === "sonic";
  const forkNetworkName = process.env.FORK_NETWORK_NAME;
  const isArbitrumFork = isFork && forkNetworkName == "arbitrumOne";
  const isSonicFork = isFork && forkNetworkName == "sonic";
  const isMainnetFork = isFork && forkNetworkName == "mainnet";
  const isPlume = hre.network.name == "plume";
  const isPlumeFork = isFork && forkNetworkName == "plume";
  const isBase = hre.network.name == "base";
  const isBaseFork = isFork && forkNetworkName == "base";

  let folder = "localhost";
  if (isMainnetFork || isMainnet) {
    folder = "mainnet";
  } else if (isArbitrumFork || isArbitrum) {
    folder = "arbitrumOne";
  } else if (isSonicFork || isSonic) {
    folder = "sonic";
  } else if (isPlumeFork || isPlume) {
    folder = "plume";
  } else if (isBaseFork || isBase) {
    folder = "base";
  }

  const layoutFolder = `./storageLayout/${folder}/`;
  if (!existsSync(layoutFolder)) {
    mkdirSync(layoutFolder);
  }

  return `${layoutFolder}${contractName}${
    isUpgradeableProxy ? "-impl" : ""
  }.json`;
};

const getStorageLayoutForContract = async (hre, contractName, contract) => {
  if (!contract) {
    contract = contractName;
  }
  const validations = await readValidations(hre);
  const implFactory = await hre.ethers.getContractFactory(contract);
  const unlinkedBytecode = getUnlinkedBytecode(
    validations,
    implFactory.bytecode
  );
  const version = getVersion(unlinkedBytecode, implFactory.bytecode);

  return getStorageLayout(validations, version);
};

const loadPreviousStorageLayoutForContract = async (
  hre,
  contractName,
  isUpgradeableProxy
) => {
  const location = getStorageFileLocation(
    hre,
    contractName,
    isUpgradeableProxy
  );

  // new contract
  if (!existsSync(location)) {
    return null;
  }

  return JSON.parse(await promises.readFile(location, "utf8"));
};

// @dev   contractName and contract can be different when the deploy procedure wants to
//        store a certain contract deployment under a different name as is the name of
//        the contract in the source code.
// @param contract the name of the contract as is in the source code of the contract
// @param contractName a potential override of the contract as is to be stored in the
//        deployment descriptors
const storeStorageLayoutForContract = async (
  hre,
  contractName,
  contract,
  isUpgradeableProxy
) => {
  const layout = await getStorageLayoutForContract(hre, contractName, contract);
  const storageLayoutFile = getStorageFileLocation(
    hre,
    contractName,
    isUpgradeableProxy
  );

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
    "LidoWithdrawalStrategy",
    "SingleAssetStaking",
    "ThreePoolStrategy",
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
    log(`Skipping storage slot validation of ${contractName}.`);
    return true;
  }

  const layout = await getStorageLayoutForContract(hre, contractName);

  const oldLayout = await loadPreviousStorageLayoutForContract(
    hre,
    contractName
  );
  if (!oldLayout) {
    log(
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
          () => itemToBytesMap[itemType]
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
    } else if (sItem.type === "t_string_storage") {
      sItem.newSlot = true;
      sItem.bits = 256;
    } else {
      throw new Error(
        `\x1b[31mUnexpected solidity type: ${sItem.type}  for item: ${sItem.label} located in ${sItem.src}\x1b[0m`
      );
    }

    return sItem;
  });

  let currentSlot = 0;
  let currentSlotBits = 0;
  // assign slots to mappings
  layout.storage = layout.storage.map((sItem) => {
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

const getStorageLayoutForProxy = async (hre, proxyName) => {
  if (proxyName.startsWith("Mock")) {
    console.error(
      `Skipping storage slot validation for mock contract: ${proxyName}.`
    );
    return false;
  }

  const deployments = await hre.deployments.all();
  const dProxy = deployments[proxyName];

  if (!dProxy) {
    throw new Error(`Proxy contract ${proxyName} not found`);
  }

  const cProxy = await hre.ethers.getContractAt(
    ["function implementation() view returns (address)"],
    dProxy.address
  );
  const implAddr = await cProxy.implementation();

  if (implAddr == "0x0000000000000000000000000000000000000000") {
    console.error(
      `Skipping storage slot validation for proxy with no implementation: ${proxyName}.`
    );
    return false;
  }

  // We used the same artifact name for different contracts. This is a mapping of
  // implementation addresses to the contract name to resolve any conflicts.
  const implementationNamesForDuplicateArtifacts = {
    // SSR Strategy
    "0xb3155b7eb46e75ae20c9562af697c144f34c2509": "Generalized4626Strategy",
    // DSR Strategy
    "0x8a3b6d3739461137d20825c36ed6016803d3104f": "Generalized4626Strategy",
    // MetaMorpho Strategy:
    "0x41bd943923c31d277aa1becbc702b825f2bb8639": "Generalized4626Strategy",
    // FeeAccumulator for second Native Staking Strategy
    "0x9178a430b0fc78adec0ae1686557a53ebb382361": "FeeAccumulator",
    // FeeAccumulator for third Native Staking Strategy
    "0xebb078722b231a889351e13e05f1a694d89ce8a9": "FeeAccumulator",
    // Second NativeStakingStrategy
    "0x0643b19f9f978322b4f2f13b091a13e60ecbbce3": "NativeStakingSSVStrategy",
    // Third NativeStakingStrategy
    "0x492500a6cfb1248b5b6b7c674fd66c66ca57b905": "NativeStakingSSVStrategy",
    // OUSDCurveAMO
    "0xd7e36afe9dac8424b180b850616ba34be57277f9": "CurveAMOStrategy",
  };

  const implName =
    Object.keys(deployments).find(
      (x) => deployments[x].address.toLowerCase() == implAddr.toLowerCase()
    ) || implementationNamesForDuplicateArtifacts[implAddr.toLowerCase()];
  if (!implName) {
    throw new Error(
      `Implementation not found in artifacts for Proxy: ${proxyName} -> ${implAddr}`
    );
  }

  if (!isContractEligible(implName)) {
    console.error(
      `Skipping storage slot validation for deprecated contract: ${proxyName} -> ${implName}.`
    );
    return false;
  }

  return await getStorageLayoutForContract(hre, implName);
};

const storeStorageLayoutForProxy = async (hre, proxyName) => {
  const layout = await getStorageLayoutForProxy(hre, proxyName);
  if (!layout) {
    return;
  }

  const storageLayoutFile = getStorageFileLocation(hre, proxyName, true);
  await promises.writeFile(storageLayoutFile, JSON.stringify(layout, null, 2));
  console.log(
    `Storage slots layout for ${proxyName} saved to ${storageLayoutFile} `
  );
};

const getAllEligibleProxyNames = async (hre) => {
  const deployments = await hre.deployments.all();
  const proxyNames = [];
  for (const deploymentName of Object.keys(deployments)) {
    if (await isProxyContractEligible(hre, deploymentName)) {
      proxyNames.push(deploymentName);
    }
  }
  return proxyNames;
};

const isProxyContractEligible = async (hre, proxyName) => {
  // These contracts have been deprecated and we no longer have the
  // source code of implementation in our repo.
  const excludeContracts = [
    "LidoWithdrawalStrategyProxy",
    "MakerDsrStrategyProxy",
    "CurveUSDTStrategyProxy",
    "CurveUSDCStrategyProxy",
  ];

  if (excludeContracts.includes(proxyName) || !proxyName.endsWith("Proxy")) {
    return false;
  }

  const deployments = await hre.deployments.all();
  return Boolean(deployments[proxyName]);
};

const storeStorageLayoutForAllProxies = async (hre) => {
  const proxyNames = await getAllEligibleProxyNames(hre);
  for (const proxyName of proxyNames) {
    await storeStorageLayoutForProxy(hre, proxyName);
  }
};

const assertStorageLayoutForProxy = async (hre, proxyName) => {
  const storageLayout = await getStorageLayoutForProxy(hre, proxyName);
  if (!storageLayout) {
    return;
  }

  const oldLayout = await loadPreviousStorageLayoutForContract(
    hre,
    proxyName,
    true
  );
  if (!oldLayout) {
    throw new Error(
      `Cannot find storage layout for ${proxyName}. Run "npx hardhat storeStorageLayoutForProxy --network ${hre.network.name} --proxy ${proxyName}"`
    );
  } else {
    // 3rd param is opts.unsafeAllowCustomTypes
    assertStorageUpgradeSafe(oldLayout, storageLayout, false);
    console.log(`[storage-slots] Contract ${proxyName} is safe for upgrade`);
  }
};

const assertStorageLayoutForAllProxies = async (hre) => {
  const proxyNames = await getAllEligibleProxyNames(hre);
  for (const proxyName of proxyNames) {
    await assertStorageLayoutForProxy(hre, proxyName);
  }
};

module.exports = {
  storeStorageLayoutForAllContracts,
  assertStorageLayoutChangeSafe,
  assertStorageLayoutChangeSafeForAll,
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
  showStorageLayout,
  getStorageLayoutForProxy,
  storeStorageLayoutForProxy,
  storeStorageLayoutForAllProxies,
  assertStorageLayoutForProxy,
  assertStorageLayoutForAllProxies,
};
