const deployMocks = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();

  const mockUsdt = await deploy("MockUSDT", {
    from: deployerAddr,
  });

  const mockTusd = await deploy("MockTUSD", {
    from: deployerAddr,
  });

  const mockUsdc = await deploy("MockUSDC", {
    from: deployerAddr,
  });

  const mockDai = await deploy("MockDAI", {
    from: deployerAddr,
  });

  const mockOracle = await deploy("MockOracle", {
    from: deployerAddr,
  });
};

deployMocks.tags = ["mocks"];
// TODO skip on non test networks
deployMocks.skip = (env) => false;

module.exports = deployMocks;
