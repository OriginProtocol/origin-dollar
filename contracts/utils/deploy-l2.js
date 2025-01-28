const {
  isFork,
  isArbFork,
  isBaseFork,
  isSonicFork,
} = require("../test/helpers");
const addresses = require("./addresses");
const {
  deployWithConfirmation,
  withConfirmation,
  impersonateGuardian,
  handleTransitionGovernance,
} = require("./deploy");
const { proposeGovernanceArgs } = require("./governor");
const { impersonateAndFund } = require("./signers");
const { getTxOpts } = require("./tx");

function log(msg, deployResult = null) {
  if (isBaseFork || isArbFork || process.env.VERBOSE) {
    if (deployResult && deployResult.receipt) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
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
    forceSkip ||
    !(
      isBaseFork ||
      hre.network.name == "base" ||
      hre.network.config.chainId == 8453
    );

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
