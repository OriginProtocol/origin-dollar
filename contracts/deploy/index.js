const addresses = require("../utils/addresses");
const { isMainnetOrFork } = require("../test/helpers.js");

const getOracleAddress = async (deployments) => {
  if (isMainnetOrFork) {
    return addresses.mainnet.Oracle;
  } else {
    return (await deployments.get("MockOracle")).address;
  }
};

const getAssetAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    return {
      USDT: addresses.mainnet.USDT,
      USDC: addresses.mainnet.USDC,
      TUSD: addresses.mainnet.TUSD,
      DAI: addresses.mainnet.DAI,
    };
  } else {
    return {
      USDT: (await deployments.get("MockUSDT")).address,
      USDC: (await deployments.get("MockUSDC")).address,
      TUSD: (await deployments.get("MockTUSD")).address,
      DAI: (await deployments.get("MockDAI")).address,
    };
  }
};

const getCTokenAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    return {
      cDAI: addresses.mainnet.cDAI,
      cUSDC: addresses.mainnet.cUSDC,
    };
  } else {
    return {
      cDAI: (await deployments.get("MockCDAI")).address,
      cUSDC: (await deployments.get("MockCUSDC")).address,
    };
  }
};

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();

  await deploy("OUSD", { from: governorAddr });
  await deploy("Vault", { from: governorAddr });
  await deploy("CompoundStrategy", { from: governorAddr });

  const OUSDContract = await ethers.getContract("OUSD");
  const vaultContract = await ethers.getContract("Vault");
  const compoundStrategyContract = await ethers.getContract("CompoundStrategy");

  const assetAddresses = await getAssetAddresses(deployments);

  await OUSDContract.initialize("Origin Dollar", "OUSD", vaultContract.address);

  await vaultContract.initialize(
    // TODO: Tom, does this need to be governer only?
    await getOracleAddress(deployments),
    OUSDContract.address
  );

  const vaultContractGovernor = vaultContract.connect(
    ethers.provider.getSigner(governorAddr)
  );
  await vaultContractGovernor.supportAsset(assetAddresses.DAI, "DAI");
  await vaultContractGovernor.supportAsset(assetAddresses.USDT, "USDT");
  await vaultContractGovernor.supportAsset(assetAddresses.USDC, "USDC");
  await vaultContractGovernor.supportAsset(assetAddresses.TUSD, "TUSD");

  const cTokenAddresses = await getCTokenAddresses(deployments);

  compoundStrategyContract.initialize(
    addresses.dead,
    [assetAddresses.DAI, assetAddresses.USDC],
    [cTokenAddresses.cDAI, cTokenAddresses.cUSDC]
  );

  vaultContractGovernor.addStrategy(compoundStrategyContract.address, 100);
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
