const deployMocks = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const {deployerAddr} = await getNamedAccounts();

  const assetContracts = ["MockUSDT", "MockTUSD", "MockUSDC", "MockDAI"];
  const allContracts = [...assetContracts, "MockOracle"];

  for (const contract of allContracts) {
    await deploy(contract, {from: deployerAddr});
  }

  const oracleContract = await ethers.getContract("MockOracle");
  for (const assetContractName of assetContracts) {
    const assetContract = await ethers.getContract(assetContractName);
    await oracleContract.setAssetPrice(assetContract.address, 1);
  }
};

deployMocks.tags = ["mocks"];
// TODO skip on non test networks
deployMocks.skip = (env) => false;

module.exports = deployMocks;
