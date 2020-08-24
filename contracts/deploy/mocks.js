const { getAssetAddresses } = require("../test/helpers.js");

const deployMocks = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  // Signers
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy mock stablecoins (assets)
  const assetContracts = ["MockUSDT", "MockTUSD", "MockUSDC", "MockDAI"];
  for (const contract of assetContracts) {
    await deploy(contract, { from: deployerAddr });
  }

  // Deploy mock cTokens (Compound)
  await deploy("MockCDAI", {
    args: [(await ethers.getContract("MockDAI")).address],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("MockCUSDC", {
    args: [(await ethers.getContract("MockUSDC")).address],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("MockCOMP", {
    from: deployerAddr,
  });

  // Deploy a mock Vault with additional functions for tests
  await deploy("MockVault", {
    from: governorAddr,
  });

  // Deploy mock oracle and set prices
  await deploy("MockOracle", { from: deployerAddr });
  const oracleContract = await ethers.getContract("MockOracle");
  for (const assetContractName of assetContracts) {
    const token = assetContractName.replace("Mock", "").toUpperCase();
    await oracleContract.setPrice(token, 1000000); // 1USD
  }
};

deployMocks.tags = ["mocks"];
deployMocks.skip = (env) =>
  !["localhost", "buidlerevm", "ganache"].includes(env.network.name);

module.exports = deployMocks;
