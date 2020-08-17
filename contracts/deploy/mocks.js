const deployMocks = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();

  const assetContracts = ["MockUSDT", "MockTUSD", "MockUSDC", "MockDAI"];
  const allContracts = [...assetContracts, "MockOracle"];

  for (const contract of allContracts) {
    await deploy(contract, { from: deployerAddr });
  }

  const oracleContract = await ethers.getContract("MockOracle");
  for (const assetContractName of assetContracts) {
    const token = assetContractName.replace('Mock','').toUpperCase()
    await oracleContract.setPrice(token, 1000000); // 1USD
  }
};

deployMocks.tags = ["mocks"];
deployMocks.skip = (env) =>
  !["localhost", "buidlerevm"].includes(env.network.name);

module.exports = deployMocks;
