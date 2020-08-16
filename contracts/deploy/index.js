const getAssetAddresses = async (deployments) => {
  return [
    (await deployments.get("MockUSDT")).address,
    (await deployments.get("MockUSDC")).address,
    (await deployments.get("MockTUSD")).address,
    (await deployments.get("MockDAI")).address,
  ];
};

const getOracleAddress = async (deployments) => {
  return (await deployments.get("MockOracle")).address;
};

const deployCore = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const {governorAddr} = await getNamedAccounts();

  const oUsd = await deploy("OUSD", {
    from: governorAddr,
  });

  const vault = await deploy("Vault", {
    from: governorAddr,
  });

  const vaultContract = await ethers.getContract("Vault");
  await vaultContract.initialize(
    await getAssetAddresses(deployments),
    await getOracleAddress(deployments),
    oUsd.address
  );
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
