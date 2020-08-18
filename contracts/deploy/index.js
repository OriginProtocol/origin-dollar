const bre = require("@nomiclabs/buidler");

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

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy, execute } = deployments;
  const { governorAddr } = await getNamedAccounts();

  const oUsd = await deploy("OUSD", {
    from: governorAddr,
  });

  await deploy("Vault", {
    from: governorAddr,
  });

  const assetAddresses = await getAssetAddresses(deployments);

  const vaultContract = await ethers.getContract("Vault");
  await vaultContract.initialize(
    // TODO: Tom, does this need to be governer only?
    await getOracleAddress(deployments),
    oUsd.address,
    assetAddresses.DAI,
    "DAI"
  );

  await execute(
    "Vault",
    { from: governorAddr },
    "supportAsset",
    assetAddresses.USDT,
    "USDT"
  );

  await execute(
    "Vault",
    { from: governorAddr },
    "supportAsset",
    assetAddresses.USDC,
    "USDC"
  );

  await execute(
    "Vault",
    { from: governorAddr },
    "supportAsset",
    assetAddresses.TUSD,
    "TUSD"
  );
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
