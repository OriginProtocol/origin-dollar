const { deployWithConfirmation, withConfirmation } = require("./deploy");
const { getTxOpts } = require("./tx");

function deployOnArb(opts, fn) {
  const { deployName, dependencies } = opts;

  const runDeployment = async (hre) => {
    const tools = {
      deployWithConfirmation,
      ethers: hre.ethers,
      getTxOpts: getTxOpts,
      withConfirmation,
    };

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

  main.tags = ["arbitrum"];

  main.skip = () =>
    hre.network.name !== "arbitrumOne" && hre.network.config.chainId !== 42161;

  return main;
}

module.exports = {
  deployOnArb,
};
