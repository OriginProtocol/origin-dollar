const {
  isFork,
  isArbFork,
  isBaseFork,
  isSonicFork,
  isPlumeFork,
  advanceTime,
  advanceBlocks,
} = require("../test/helpers");
const {
  deployWithConfirmation,
  withConfirmation,
  impersonateGuardian,
  buildGnosisSafeJson,
  constructContractMethod,
} = require("./deploy");
const { proposeGovernanceArgs } = require("./governor");
const { isForkTest } = require("./hardhat-helpers");
const { impersonateAndFund } = require("./signers");
const { getTxOpts } = require("./tx");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const { keccak256, toUtf8Bytes } = require("ethers/lib/utils.js");

const fs = require("fs");
const path = require("path");

function log(msg, deployResult = null) {
  if (isBaseFork || isArbFork || process.env.VERBOSE) {
    if (deployResult && deployResult.receipt) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

function getNetworkName() {
  if (isForkTest) {
    return "hardhat";
  } else if (isFork) {
    return "localhost";
  } else {
    return process.env.NETWORK_NAME || "mainnet";
  }
}

async function buildAndSimulateTimelockOperations(
  deployName,
  propDesc,
  propArgs
) {
  console.log("Building and simulating timelock operations for", deployName);
  const networkName = getNetworkName();
  const { guardianAddr, timelockAddr } = await getNamedAccounts();

  const timelock = await ethers.getContractAt(
    "ITimelockController",
    timelockAddr
  );

  const payloads = propArgs[2].map((sig, i) => {
    return `${keccak256(toUtf8Bytes(sig)).slice(0, 10)}${propArgs[3][i].slice(
      2
    )}`;
  });
  const salt = keccak256(toUtf8Bytes(propDesc));

  const delay = await timelock.getMinDelay();

  // *** Build and write schedule JSON ***
  const scheduleFilePath = path.resolve(
    __dirname,
    `./../deployments/${networkName}/operations/${deployName}.schedule.json`
  );
  const scheduleContractMethod = constructContractMethod(
    timelock,
    "scheduleBatch(address[],uint256[],bytes[],bytes32,bytes32,uint256)"
  );
  const scheduleInputValues = {
    targets: JSON.stringify(propArgs[0]),
    values: JSON.stringify(propArgs[1].map((arg) => arg.toString())),
    payloads: JSON.stringify(payloads),
    predecessor:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    salt: salt,
    delay: delay.toString(),
  };
  const scheduleJson = await buildGnosisSafeJson(
    guardianAddr,
    [timelockAddr],
    [scheduleContractMethod],
    [scheduleInputValues]
  );
  fs.writeFileSync(
    scheduleFilePath,
    JSON.stringify(scheduleJson, undefined, 2)
  );
  console.log("Schedule JSON written to", scheduleFilePath);

  // *** Build and write execute JSON ***
  const executeFilePath = path.resolve(
    __dirname,
    `./../deployments/${networkName}/operations/${deployName}.execute.json`
  );
  const executeContractMethod = constructContractMethod(
    timelock,
    "executeBatch(address[],uint256[],bytes[],bytes32,bytes32)"
  );
  const executeInputValues = {
    targets: JSON.stringify(propArgs[0]),
    values: JSON.stringify(propArgs[1].map((arg) => arg.toString())),
    payloads: JSON.stringify(payloads),
    predecessor:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    salt: salt,
  };
  const executeJson = await buildGnosisSafeJson(
    guardianAddr,
    [timelockAddr],
    [executeContractMethod],
    [executeInputValues]
  );
  fs.writeFileSync(executeFilePath, JSON.stringify(executeJson, undefined, 2));
  console.log("Execute JSON written to", executeFilePath);

  // Simulate the operations
  await simulateTimelockOperations(deployName);
}

async function simulateTimelockOperations(deployName) {
  if (!isFork) {
    console.log("Skipping governance simulation on non-fork");
    return false;
  }

  const networkName = getNetworkName();

  const scheduleFilePath = path.resolve(
    __dirname,
    `./../deployments/${networkName}/operations/${deployName}.schedule.json`
  );
  if (!fs.existsSync(scheduleFilePath)) {
    // Skip if no generated file is found
    return false;
  }

  const scheduleFile = require(scheduleFilePath);

  const { timelockAddr, guardianAddr } = await getNamedAccounts();
  const guardian = await impersonateAndFund(guardianAddr);

  const timelock = await ethers.getContractAt(
    "ITimelockController",
    timelockAddr
  );
  const timelockSigner = await impersonateAndFund(timelockAddr);

  const inputs = scheduleFile.transactions[0].contractInputsValues;

  // Figure out timelock hash
  const opHash = await timelock.hashOperationBatch(
    JSON.parse(inputs.targets),
    JSON.parse(inputs.values),
    JSON.parse(inputs.payloads),
    inputs.predecessor.toString(),
    inputs.salt.toString()
  );

  // Check if it has already been executed
  if (await timelock.isOperationDone(opHash)) {
    console.log("Skipping already executed proposal");
    return true;
  }

  const isScheduled = await timelock.isOperation(opHash);
  // Reduce timelock delay to 60s if not scheduled
  const reduceWaitTime = !isScheduled;
  const actualDelay = await timelock.getMinDelay();
  const delay = reduceWaitTime ? 60 : actualDelay;

  if (!isScheduled) {
    // Needs to be scheduled
    console.log(`Reducing required queue time to 60 seconds`);
    await timelock.connect(timelockSigner).updateDelay(60);

    console.log("Scheduling batch on Timelock...");
    await timelock
      .connect(guardian)
      .scheduleBatch(
        JSON.parse(inputs.targets),
        JSON.parse(inputs.values),
        JSON.parse(inputs.payloads),
        inputs.predecessor,
        inputs.salt,
        delay
      );
  }

  if (!(await timelock.isOperationReady(opHash))) {
    console.log("Preparing to execute...");
    await advanceTime((await timelock.getMinDelay()) + 10);
    await advanceBlocks(2);
  }

  // Execute operations
  console.log("Executing operations...");
  await timelock
    .connect(guardian)
    .executeBatch(
      JSON.parse(inputs.targets),
      JSON.parse(inputs.values),
      JSON.parse(inputs.payloads),
      inputs.predecessor,
      inputs.salt
    );

  // Reset timelock delay if it was reduced
  if (reduceWaitTime) {
    console.log(`Setting queue time back to ${actualDelay} seconds`);
    await timelock.connect(timelockSigner).updateDelay(actualDelay);
  }

  return true;
}

function deployOnArb(opts, fn) {
  const { deployName, dependencies } = opts;

  const runDeployment = async (hre) => {
    const tools = {
      deployWithConfirmation,
      ethers: hre.ethers,
      getTxOpts: getTxOpts,
      withConfirmation,
    };

    if (isFork) {
      const { deployerAddr } = await getNamedAccounts();
      await impersonateAndFund(deployerAddr);
    }

    await fn(tools);
  };

  const main = async (hre) => {
    console.log(`Running ${deployName} deployment...`);
    if (!hre) {
      hre = require("hardhat");
    }
    await runDeployment(hre);
    console.log(`${deployName} deploy done.`);
    return true;
  };

  main.id = deployName;
  main.dependencies = dependencies || [];

  main.tags = ["arbitrumOne"];

  main.skip = () =>
    !(
      isArbFork ||
      hre.network.name == "arbitrumOne" ||
      hre.network.config.chainId == 42161
    );

  return main;
}

function deployOnBaseWithEOA(opts, fn) {
  const { deployName, dependencies } = opts;

  const runDeployment = async (hre) => {
    const tools = {
      deployWithConfirmation,
      ethers: hre.ethers,
      getTxOpts: getTxOpts,
      withConfirmation,
    };

    if (isFork) {
      const { deployerAddr } = await getNamedAccounts();
      await impersonateAndFund(deployerAddr);
    }

    await fn(tools);
  };

  const main = async (hre) => {
    console.log(`Running ${deployName} deployment...`);
    if (!hre) {
      hre = require("hardhat");
    }
    await runDeployment(hre);
    console.log(`${deployName} deploy done.`);
    return true;
  };

  main.id = deployName;
  main.dependencies = dependencies || [];

  main.tags = ["base"];

  main.skip = () =>
    !(
      isBaseFork ||
      hre.network.name == "base" ||
      hre.network.config.chainId == 8453
    );

  return main;
}

function deployOnL2WithGuardianOrTimelock(opts, fn, tags) {
  const { deployName, dependencies, onlyOnFork, forceSkip, useTimelock } = opts;

  const runDeployment = async (hre) => {
    // Check if it has any pending governance operations to be simulated
    const foundAndExecuted = await simulateTimelockOperations(deployName);
    if (foundAndExecuted) {
      // If governance operations were found and executed, skip the deployment
      return;
    }

    const tools = {
      deployWithConfirmation,
      ethers: hre.ethers,
      getTxOpts: getTxOpts,
      withConfirmation,
    };
    const { guardianAddr } = await getNamedAccounts();

    if (onlyOnFork && !isFork) {
      console.log("Skipping fork-only script");
      return;
    }

    if (isFork) {
      const { deployerAddr } = await getNamedAccounts();
      await impersonateAndFund(deployerAddr);
      await impersonateGuardian(guardianAddr);
    }

    const proposal = await fn(tools);

    if (!proposal?.actions?.length) {
      return;
    }

    if (useTimelock != false) {
      // Using `!= false` because we want to treat `== undefined` as true by default as well
      const propDescription = proposal.name || deployName;
      const propArgs = await proposeGovernanceArgs(proposal.actions);

      await buildAndSimulateTimelockOperations(
        deployName,
        propDescription,
        propArgs
      );
    } else {
      // Handle Guardian governance
      const sGuardian = !isFork
        ? undefined
        : await ethers.provider.getSigner(guardianAddr);
      console.log("guardianAddr", guardianAddr);

      const guardianActions = [];
      for (const action of proposal.actions) {
        const { contract, signature, args } = action;

        if (isFork) {
          log(`Sending governance action ${signature} to ${contract.address}`);
          await withConfirmation(
            contract.connect(sGuardian)[signature](...args, await getTxOpts())
          );
        }

        guardianActions.push({
          sig: signature,
          args: args,
          to: contract.address,
          data: contract.interface.encodeFunctionData(signature, args),
          value: "0",
        });

        console.log(`... ${signature} completed`);
      }

      console.log(
        "Execute the following actions using guardian safe: ",
        guardianActions
      );
    }
  };

  const main = async (hre) => {
    // Mine one block to workaround "No known hardfork for execution on historical block"
    // https://github.com/NomicFoundation/hardhat/issues/5511
    if (isFork) {
      await mine(1);
    }

    console.log(`Running ${deployName} deployment...`);
    if (!hre) {
      hre = require("hardhat");
    }
    await runDeployment(hre);
    console.log(`${deployName} deploy done.`);
    return true;
  };

  main.id = deployName;
  main.dependencies = dependencies || [];

  main.tags = tags || [];

  if (forceSkip) {
    main.skip = () => true;
  } else if (isFork) {
    const networkName = isForkTest ? "hardhat" : "localhost";
    const migrations = require(`./../deployments/${networkName}/.migrations.json`);
    // Skip if execution happened older than 14 days
    const olderProposal =
      Date.now() / 1000 - migrations[deployName] >= 60 * 60 * 24 * 14;

    if (olderProposal) {
      main.skip = () => true;
    } else {
      const migrationDone = !!migrations[deployName];

      // Check if schedule file exists
      const scheduleFilePath = path.resolve(
        __dirname,
        `./../deployments/${process.env.FORK_NETWORK_NAME}/operations/${deployName}.schedule.json`
      );
      const scheduleFileExists = fs.existsSync(scheduleFilePath);
      if (migrationDone && scheduleFileExists) {
        // Never skip so that we can simulate the execution
        main.id = `${deployName}__force`;
      }
    }
  }

  return main;
}

function deployOnBase(opts, fn) {
  return deployOnL2WithGuardianOrTimelock(
    {
      ...opts,
      forceSkip:
        opts.forceSkip ||
        !(
          isBaseFork ||
          hre.network.name == "base" ||
          hre.network.config.chainId == 8453
        ),
    },
    fn,
    ["base"]
  );
}

function deployOnSonic(opts, fn) {
  return deployOnL2WithGuardianOrTimelock(
    {
      ...opts,
      forceSkip:
        opts.forceSkip ||
        !(
          isSonicFork ||
          hre.network.name == "sonic" ||
          hre.network.config.chainId == 146
        ),
    },
    fn,
    ["sonic"]
  );
}

function deployOnPlume(opts, fn) {
  return deployOnL2WithGuardianOrTimelock(
    {
      ...opts,
      // TODO: No timelock on Plume yet
      useTimelock: false,
      forceSkip:
        opts.forceSkip ||
        !(
          isPlumeFork ||
          hre.network.name == "plume" ||
          hre.network.config.chainId == 98866
        ),
    },
    fn,
    ["plume"]
  );
}

module.exports = {
  deployOnArb,
  deployOnBaseWithEOA,
  deployOnBase,
  deployOnSonic,
  deployOnPlume,
};
