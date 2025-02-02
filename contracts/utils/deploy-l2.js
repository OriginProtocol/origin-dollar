const {
  isFork,
  isArbFork,
  isBaseFork,
  isSonicFork,
  advanceTime,
  advanceBlocks,
} = require("../test/helpers");
const addresses = require("./addresses");
const {
  deployWithConfirmation,
  withConfirmation,
  impersonateGuardian,
  handleTransitionGovernance,
} = require("./deploy");
const { proposeGovernanceArgs } = require("./governor");
const { isForkTest } = require("./hardhat-helpers");
const { impersonateAndFund } = require("./signers");
const { getTxOpts } = require("./tx");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

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

async function handleTimelockProposalWithGuardian(deployName) {
  if (!isFork) {
    console.log("Skipping governance simulation on non-fork");
    return false;
  }

  const networkName = process.env.FORK_NETWORK_NAME;

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
    /* contracts/timelock/Timelock.sol storage slot layout:
     * slot[0] address admin
     * slot[1] address pendingAdmin
     * slot[2] uint256 delay
     */
    await setStorageAt(
      timelock.address,
      "0x2",
      "0x000000000000000000000000000000000000000000000000000000000000003c" // 60 seconds
    );

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
    console.log("Setting queue time back to 172800 seconds");
    await timelock.updateDelay(actualDelay);
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

function deployOnBase(opts, fn) {
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
function deployOnBaseWithGuardian(opts, fn) {
  const { deployName, dependencies, onlyOnFork, forceSkip, useTimelock } = opts;

  const runDeployment = async (hre) => {
    const tools = {
      deployWithConfirmation,
      ethers: hre.ethers,
      getTxOpts: getTxOpts,
      withConfirmation,
    };

    const guardianAddr = addresses.base.governor;

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

      await handleTransitionGovernance(propDescription, propArgs);
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
    const foundAndExecuted = await handleTimelockProposalWithGuardian(
      deployName
    );
    if (foundAndExecuted) {
      return;
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

  main.tags = ["base"];

  if (
    forceSkip ||
    !(
      isBaseFork ||
      hre.network.name == "base" ||
      hre.network.config.chainId == 8453
    )
  ) {
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

function deployOnSonic(opts, fn) {
  const { deployName, dependencies, onlyOnFork, forceSkip, useTimelock } = opts;

  const runDeployment = async (hre) => {
    const tools = {
      deployWithConfirmation,
      ethers: hre.ethers,
      getTxOpts: getTxOpts,
      withConfirmation,
    };

    // Mine one block to workaround "No known hardfork for execution on historical block"
    // https://github.com/NomicFoundation/hardhat/issues/5511
    await mine(1);

    const adminAddr = addresses.sonic.admin;
    console.log("Sonic Admin addr", adminAddr);

    if (onlyOnFork && !isFork) {
      console.log("Skipping fork-only script");
      return;
    }

    if (isFork) {
      const { deployerAddr } = await getNamedAccounts();
      await impersonateAndFund(deployerAddr);
      await impersonateAndFund(adminAddr);
    }

    const proposal = await fn(tools);

    if (!proposal?.actions?.length) {
      return;
    }

    if (useTimelock != false) {
      // Using `!= false` because we want to treat `== undefined` as true by default as well
      const propDescription = proposal.name || deployName;
      const propArgs = await proposeGovernanceArgs(proposal.actions);

      await handleTransitionGovernance(propDescription, propArgs);
    } else {
      // Handle Admin governance
      const sAdmin = !isFork
        ? undefined
        : await ethers.provider.getSigner(adminAddr);

      const guardianActions = [];
      for (const action of proposal.actions) {
        const { contract, signature, args } = action;

        if (isFork) {
          log(`Sending governance action ${signature} to ${contract.address}`);
          await withConfirmation(
            contract.connect(sAdmin)[signature](...args, await getTxOpts())
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

  main.tags = ["sonic"];

  main.skip = () =>
    forceSkip ||
    !(
      isSonicFork ||
      hre.network.name == "sonic" ||
      hre.network.config.chainId == 146
    );
  return main;
}

module.exports = {
  deployOnArb,
  deployOnBase,
  deployOnBaseWithGuardian,
  deployOnSonic,
};
