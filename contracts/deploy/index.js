const getOracleAddress = async (deployments) => {
  return (await deployments.get("MockOracle")).address;
};

const deployCore = async ({getNamedAccounts, deployments}) => {
  const {deploy, execute} = deployments;
  const {governorAddr} = await getNamedAccounts();

  const oUsd = await deploy("OUSD", {
    from: governorAddr,
  });


  const vault = await deploy("Vault", {
    from: governorAddr,
  });
  const vaultContract = await ethers.getContract("Vault");
  await vaultContract.initialize( // TODO: Tom, does this need to be governer only?
    await getOracleAddress(deployments),
    oUsd.address,
    (await deployments.get("MockDAI")).address,
    "DAI"
  );
  await execute("Vault",{from: governorAddr},"supportAsset",(await deployments.get("MockUSDT")).address,"USDT")
  await execute("Vault",{from: governorAddr},"supportAsset",(await deployments.get("MockUSDC")).address,"USDC")
  await execute("Vault",{from: governorAddr},"supportAsset",(await deployments.get("MockTUSD")).address,"TUSD")
  
  
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
